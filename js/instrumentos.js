(function (raiz) {
  // Desenho dos instrumentos do leitor, em canvas: forma de onda, espectro e campo estéreo.
  // Só recebe dados e desenha: do ambiente só lê as cores (variáveis CSS do :root) e o devicePixelRatio, e não toca na página nem no leitor.
  // O que precisa de `document` ou `window` só corre dentro das funções, para o ficheiro se poder carregar em Node.

  // Cores: variáveis CSS do :root, com os valores do spec como alternativa. Lidas uma só vez, no primeiro desenho.
  const CORES = { ink: ['--ink', '#111111'], muted: ['--muted', '#5C5C5C'], line: ['--line', '#E3E3E3'], ghost: ['--ghost', '#C9C9C9'], bg: ['--bg', '#FFFFFF'] };
  const ROTULO = '400 10px "IBM Plex Mono", ui-monospace, monospace';

  const DPR_MAXIMO = 2, TAMANHO_MINIMO = 16;                 // acima de 2 pixéis por px a nitidez não compensa; abaixo de 16 px não se desenha

  // Forma de onda: barras de 2 px com 1 px de intervalo; altura (v/255)^0,7 × (h − 4), no mínimo 1 px.
  const LARGURA_BARRA = 2, PASSO_BARRA = 3, PICO_MAXIMO = 255, EXPOENTE_BARRA = 0.7, MARGEM_VERTICAL = 4;
  const ESPESSURA_PROGRESSO = 2;                             // linha fina, sem picos

  // Espectro: bandas em escala logarítmica de 32 Hz a 16 kHz (as de analise.js), com marcas em 100, 1k e 10k.
  const FREQ_MIN = 32, FREQ_MAX = 16000;
  const MARCAS_FREQ = [[100, '100'], [1000, '1k'], [10000, '10k']];
  const LARGURA_ESTREITA = 420, LARGURA_COM_UNIDADE = 400;   // abaixo de 420 px o intervalo entre barras é de 1 px; o «Hz» só aparece com 400 px ou mais
  const RODAPE_ESPECTRO = 20, FOLGA_ESPECTRO = 8;            // espaço por baixo da linha de base (marcas e rótulos) e por cima das barras
  const PICO_VISIVEL = 0.03;                                 // abaixo disto não se marca o pico

  // Estéreo: cada par de amostras (esquerda, direita) é um ponto do losango, com M = (E + D) / 2 na vertical e S = (D − E) / 2 na horizontal.
  const JANELA_ESTEREO = 0.02, AMPLIACAO_ESTEREO = 1.5;      // segundos de amostras; ampliação do desenho
  const QUEDA_RASTO = 0.22;                                  // parte do rasto que se apaga em cada quadro: some em cerca de 0,2 s a 60 quadros por segundo
  const FRACAO_PONTOS = 320 / 1024;                          // os pontos só na parte mais recente da janela; o traço fino vai por ela toda
  const LARGURA_TRACO = 0.6, ALFA_TRACO = 0.1, ALFA_PONTO = 0.85, LADO_PONTO = 1.4;
  const ALFA_CONTORNO = 0.34, ALFA_GRELHA = 0.12;            // moldura: losango de fora e, mais ténues, os interiores e os eixos

  const limitar = (v, min, max) => Math.min(max, Math.max(min, v));

  let cores = null;
  function lerCores() {
    if (!cores) {
      const estilo = getComputedStyle(document.documentElement);
      cores = {};
      for (const [nome, [variavel, alternativa]] of Object.entries(CORES)) cores[nome] = estilo.getPropertyValue(variavel).trim() || alternativa;
    }
    return cores;
  }

  // A tela de um canvas. ajustar() acompanha o tamanho no ecrã (CSS px × devicePixelRatio, no máximo 2) e diz se há espaço para desenhar.
  function criarTela(canvas) {
    const t = { canvas, ctx: canvas.getContext('2d'), w: 0, h: 0 };
    let dpr = 1;
    t.ajustar = () => {
      const r = canvas.getBoundingClientRect(), novoDpr = Math.min(window.devicePixelRatio || 1, DPR_MAXIMO);
      const w = Math.round(r.width), h = Math.round(r.height);
      if (w !== t.w || h !== t.h || novoDpr !== dpr) {          // mexer no tamanho apaga o canvas: só quando mudou
        t.w = w; t.h = h; dpr = novoDpr;
        canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(h * dpr));
      }
      t.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return w >= TAMANHO_MINIMO && h >= TAMANHO_MINIMO;
    };
    return t;
  }

  // picos: inteiros de 0 a 255 (800 no site; qualquer quantidade se reparte pelas barras); fracao: a parte já tocada, de 0 a 1.
  // Sem picos (null) fica só a linha de progresso fina, sem cursor; com picos, as barras e o cursor na posição.
  function desenharOnda(tela, picos, fracao) {
    const { ctx, w, h } = tela, c = lerCores(), meio = h / 2, px = limitar(fracao, 0, 1) * w;
    ctx.clearRect(0, 0, w, h);
    if (!picos) {
      const corte = Math.round(px), y = Math.round(meio) - ESPESSURA_PROGRESSO / 2;
      ctx.fillStyle = c.ink; ctx.fillRect(0, y, corte, ESPESSURA_PROGRESSO);
      ctx.fillStyle = c.line; ctx.fillRect(corte, y, w - corte, ESPESSURA_PROGRESSO);
      return;
    }
    const n = Math.floor(w / PASSO_BARRA);
    for (let i = 0; i < n; i++) {
      const a = Math.floor(i / n * picos.length), b = Math.max(a + 1, Math.floor((i + 1) / n * picos.length));
      let maximo = 0;
      for (let k = a; k < b; k++) if (picos[k] > maximo) maximo = picos[k];
      const alt = Math.max(1, (maximo / PICO_MAXIMO) ** EXPOENTE_BARRA * (h - MARGEM_VERTICAL)), x = i * PASSO_BARRA;
      ctx.fillStyle = x + LARGURA_BARRA <= px ? c.ink : c.ghost;
      ctx.fillRect(x, meio - alt / 2, LARGURA_BARRA, alt);
    }
    ctx.fillStyle = c.ink; ctx.fillRect(limitar(Math.round(px), 0, w - 1), 0, 1, h);
  }

  // estado: { val, pico }, um valor de 0 a 1 por banda (como o de analise.js); o número de bandas é o de val.
  function desenharEspectro(tela, estado) {
    const { ctx, w, h } = tela, c = lerCores(), n = estado.val.length;
    ctx.clearRect(0, 0, w, h);
    const esp = w < LARGURA_ESTREITA ? 1 : 2, bw = Math.max(2, Math.floor((w - (n - 1) * esp) / n)), total = n * bw + (n - 1) * esp;
    const base = h - RODAPE_ESPECTRO, alt = base - FOLGA_ESPECTRO;
    ctx.fillStyle = c.line; ctx.fillRect(0, base, total, 1);
    for (let i = 0; i < n; i++) {
      const x = i * (bw + esp), bh = Math.max(1, Math.round(estado.val[i] * alt));
      ctx.fillStyle = c.ink; ctx.fillRect(x, base - bh, bw, bh);
      if (estado.pico[i] > PICO_VISIVEL) { ctx.fillStyle = c.muted; ctx.fillRect(x, base - Math.round(estado.pico[i] * alt) - 3, bw, 1); }
    }
    ctx.fillStyle = c.muted; ctx.font = ROTULO; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
    for (const [freq, texto] of MARCAS_FREQ) {
      const x = Math.log(freq / FREQ_MIN) / Math.log(FREQ_MAX / FREQ_MIN) * total;
      ctx.fillRect(Math.round(x), base + 1, 1, 4); ctx.fillText(texto, x, h - 3);
    }
    if (total >= LARGURA_COM_UNIDADE) { ctx.textAlign = 'right'; ctx.fillText('Hz', total, h - 3); }
  }

  // O estado do campo estéreo: `rasto` é um canvas fora do ecrã, do tamanho da tela, que guarda os últimos quadros (nasce no primeiro desenho).
  function criarEstereo() {
    return { rasto: null };
  }

  // Par de amostras → posição no losango, de −1 a 1: x para o lado (S), y para cima (M). Ampliado e limitado a |M| + |S| ≤ 1.
  function posicaoNoLosango(esq, dir) {
    let m = (esq + dir) / 2 * AMPLIACAO_ESTEREO, s = (dir - esq) / 2 * AMPLIACAO_ESTEREO;
    const q = Math.abs(m) + Math.abs(s);
    if (q > 1) { m /= q; s /= q; }
    return [s, m];
  }

  // Esmorece o rasto e acrescenta-lhe a janela de 20 ms mais recente (o fim dos arrays): um traço fino por toda ela e, na ponta, os pontos.
  // `transformacao` é a da tela, para o rasto e o desenho principal coincidirem. `onde(esq, dir)` dá a posição em px.
  function atualizarRasto(rasto, transformacao, esq, dir, taxa, onde, cor) {
    const tc = rasto.getContext('2d');
    tc.setTransform(1, 0, 0, 1, 0, 0);
    tc.globalCompositeOperation = 'destination-out'; tc.globalAlpha = 1;
    tc.fillStyle = `rgba(0, 0, 0, ${QUEDA_RASTO})`; tc.fillRect(0, 0, rasto.width, rasto.height);

    const n = Math.min(Math.round(taxa * JANELA_ESTEREO), esq.length, dir.length), ie = esq.length - n, id = dir.length - n;
    const ponto = (i) => onde(esq[ie + i], dir[id + i]);
    tc.globalCompositeOperation = 'source-over'; tc.setTransform(transformacao);
    tc.strokeStyle = cor; tc.lineWidth = LARGURA_TRACO; tc.globalAlpha = ALFA_TRACO; tc.beginPath();
    for (let i = 0; i < n; i += 2) { const [x, y] = ponto(i); if (i === 0) tc.moveTo(x, y); else tc.lineTo(x, y); }
    tc.stroke();
    tc.fillStyle = cor; tc.globalAlpha = ALFA_PONTO;
    for (let i = n - Math.round(n * FRACAO_PONTOS); i < n; i += 2) { const [x, y] = ponto(i); tc.fillRect(x - LADO_PONTO / 2, y - LADO_PONTO / 2, LADO_PONTO, LADO_PONTO); }
    tc.globalAlpha = 1;
  }

  // A moldura: losango com M no topo e L e R nos lados de cima, e os eixos.
  function desenharMoldura(ctx, cx, cy, r, c) {
    const losango = (k, alfa) => {
      ctx.globalAlpha = alfa; ctx.beginPath();
      ctx.moveTo(cx, cy - r * k); ctx.lineTo(cx + r * k, cy); ctx.lineTo(cx, cy + r * k); ctx.lineTo(cx - r * k, cy); ctx.closePath(); ctx.stroke();
    };
    ctx.strokeStyle = c.ink; ctx.lineWidth = 1;
    losango(1, ALFA_CONTORNO); losango(2 / 3, ALFA_GRELHA); losango(1 / 3, ALFA_GRELHA);
    ctx.globalAlpha = ALFA_GRELHA; ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = c.muted; ctx.font = ROTULO; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('M', cx, cy - r - 9); ctx.fillText('L', cx - r / 2 - 10, cy - r / 2 - 10); ctx.fillText('R', cx + r / 2 + 10, cy - r / 2 - 10);
  }

  // esq e dir: amostras com as mais recentes no fim; taxa: amostras por segundo. Sem amostras (null) fica só a moldura e o rasto apaga-se.
  function desenharEstereo(tela, estado, esq, dir, taxa) {
    const { ctx, w, h, canvas } = tela, c = lerCores(), cx = w / 2, cy = h / 2 + 4, r = Math.min(w, h) / 2 - 16;
    if (!estado.rasto || estado.rasto.width !== canvas.width || estado.rasto.height !== canvas.height) {
      estado.rasto = document.createElement('canvas');
      estado.rasto.width = canvas.width; estado.rasto.height = canvas.height;
    }
    if (esq && dir) {
      atualizarRasto(estado.rasto, ctx.getTransform(), esq, dir, taxa, (e, d) => { const [s, m] = posicaoNoLosango(e, d); return [cx + s * r, cy - m * r]; }, c.ink);
    } else {
      estado.rasto.getContext('2d').clearRect(0, 0, estado.rasto.width, estado.rasto.height);
    }
    ctx.clearRect(0, 0, w, h);
    desenharMoldura(ctx, cx, cy, r, c);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(estado.rasto, 0, 0); ctx.restore();
  }

  const Instrumentos = { criarTela, desenharOnda, desenharEspectro, criarEstereo, desenharEstereo };
  raiz.Instrumentos = Instrumentos;
  if (typeof module === 'object' && module.exports) module.exports = Instrumentos;
})(typeof window !== 'undefined' ? (window.Portfolio = window.Portfolio || {}) : {});
