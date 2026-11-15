(function (raiz) {
  // Medições do som, sem DOM: nível, pico, RMS, LUFS momentâneo, correlação e bandas do espectro.
  // Os sinais são Float32Array com as amostras mais recentes no fim; os instantes são em segundos.

  const NUM_BANDAS = 44;

  // Janelas de medição (s). Se o sinal for mais curto, usa-se o que existir.
  const JANELA_NIVEL = 0.045, JANELA_RMS = 0.3, JANELA_PICO = 0.3, JANELA_LUFS = 0.4;
  const FUNDO_NIVEL_DB = 48;                          // a barra do nível vai de −48 a 0 dB
  const RETENCAO_MARCA = 0.75, DESCIDA_MARCA = 0.36;  // segundos a guardar; depois, descida por segundo
  const INTERVALO_LENTO = 0.1, TOLERANCIA = 1e-9;     // pico, RMS, LUFS e correlação: 10 vezes por segundo
  const PICOS_GUARDADOS = 30;                         // 30 × 0,1 s = 3 s
  const MARGEM_REINICIO = 0.05;                       // segundos depois do reinício que ainda não contam para o pico
  const SILENCIO_POTENCIA = 1e-10, SILENCIO_PICO = 1e-5;

  const FREQ_MIN = 32, RAZAO_FREQ = 500;              // 32 Hz a 16 kHz, em 44 bandas logarítmicas
  const INCLINACAO_DB = 4.5, DB_BASE = 82, DB_ALCANCE = 62;
  const QUEDA_BARRA = 0.035, QUEDA_PICO = 0.012;      // por chamada

  const MENOS = '−', SEM_VALOR = '—';       // «−» (não o hífen) e «—»

  const limitar = (v, min, max) => Math.min(max, Math.max(min, v));
  const dbPotencia = (p) => 10 * Math.log10(p);
  const dbAmplitude = (a) => 20 * Math.log10(a);
  const media = (soma, n) => (n > 0 ? soma / n : 0);
  const amostras = (taxa, seg, total) => Math.min(total, Math.round(taxa * seg));

  // Somas sobre as últimas n amostras.
  function energia(a, n) {
    let s = 0;
    for (let i = a.length - n; i < a.length; i++) s += a[i] * a[i];
    return s;
  }
  function produto(a, b, n) {
    let s = 0;
    for (let i = a.length - n; i < a.length; i++) s += a[i] * b[i];
    return s;
  }
  function maximoAbsoluto(a, n) {
    let m = 0;
    for (let i = a.length - n; i < a.length; i++) { const v = Math.abs(a[i]); if (v > m) m = v; }
    return m;
  }
  const potenciaMedia = (esq, dir, n) => (media(energia(esq, n), n) + media(energia(dir, n), n)) / 2;

  // Ponderação K (ITU-R BS.1770): dois biquads em série; y[n] = b0x[n]+b1x[n-1]+b2x[n-2]−a1y[n-1]−a2y[n-2]
  function coefK(fs) {
    const K1 = Math.tan(Math.PI * 1681.974450955533 / fs), Q1 = 0.7071752369554196, Vh = 10 ** (3.999843853973347 / 20);
    const Vb = Vh ** 0.4996667741545416, a01 = 1 + K1 / Q1 + K1 * K1;
    const K2 = Math.tan(Math.PI * 38.13547087602444 / fs), Q2 = 0.5003270373238773, a02 = 1 + K2 / Q2 + K2 * K2;
    return [
      { b: [(Vh + Vb * K1 / Q1 + K1 * K1) / a01, 2 * (K1 * K1 - Vh) / a01, (Vh - Vb * K1 / Q1 + K1 * K1) / a01], a: [1, 2 * (K1 * K1 - 1) / a01, (1 - K1 / Q1 + K1 * K1) / a01] },
      { b: [1, -2, 1], a: [1, 2 * (K2 * K2 - 1) / a02, (1 - K2 / Q2 + K2 * K2) / a02] }];
  }

  function biquad({ b, a }) {
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    return (x) => {
      const y = b[0] * x + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      return y;
    };
  }

  // Soma de y² das amostras a partir do índice `desde`, depois de ponderar o canal inteiro (o filtro aquece).
  function energiaK(canal, k, desde) {
    const [f1, f2] = k.map(biquad);
    let s = 0;
    for (let i = 0; i < canal.length; i++) {
      const y = f2(f1(canal[i]));
      if (i >= desde) s += y * y;
    }
    return s;
  }

  // Leituras lentas, sobre as últimas n amostras. Em silêncio devolvem null.
  function rmsDb(esq, dir, n) {
    const p = potenciaMedia(esq, dir, n);
    return p < SILENCIO_POTENCIA ? null : dbPotencia(p);
  }
  function correlacao(esq, dir, n) {
    const ee = energia(esq, n), ed = energia(dir, n);
    if (media(ee, n) < SILENCIO_POTENCIA || media(ed, n) < SILENCIO_POTENCIA) return null;  // um canal sem energia
    return limitar(produto(esq, dir, n) / Math.sqrt(ee * ed), -1, 1);
  }
  function lufs(esq, dir, n, k) {
    const soma = media(energiaK(esq, k, esq.length - n), n) + media(energiaK(dir, k, dir.length - n), n);
    return soma / 2 < SILENCIO_POTENCIA ? null : -0.691 + dbPotencia(soma);
  }

  function criarMedidor(taxa) {
    const k = coefK(taxa);
    const marca = { valor: 0, desde: -Infinity };   // máximo recente do nível e o instante em que subiu
    let ultima = -Infinity;                         // instante da última leitura lenta
    let lentas = { picoDb: null, rmsDb: null, lufs: null, correlacao: null };
    let picos = [];                                 // pico (amplitude) de cada leitura lenta; os 30 últimos
    let contaDesde = -Infinity;                     // só as amostras posteriores a este instante contam para o pico
    let reinicioPendente = false;

    return {
      // esq e dir têm o mesmo comprimento, com as amostras mais recentes no fim; agora cresce de chamada para chamada.
      atualizar(esq, dir, agora) {
        const total = esq.length;
        const potNivel = potenciaMedia(esq, dir, amostras(taxa, JANELA_NIVEL, total));
        const nivel = limitar((dbPotencia(potNivel) + FUNDO_NIVEL_DB) / FUNDO_NIVEL_DB, 0, 1);

        // A marca sobe de imediato, fica RETENCAO_MARCA s e desce DESCIDA_MARCA por segundo (forma fechada).
        const retida = marca.valor - DESCIDA_MARCA * Math.max(0, agora - marca.desde - RETENCAO_MARCA);
        if (nivel >= retida) { marca.valor = nivel; marca.desde = agora; }
        const marcaNivel = Math.max(nivel, retida);

        if (reinicioPendente) { contaDesde = agora + MARGEM_REINICIO; reinicioPendente = false; }
        if (agora - ultima >= INTERVALO_LENTO - TOLERANCIA) {
          ultima = agora;
          const nPico = amostras(taxa, Math.min(JANELA_PICO, agora - contaDesde), total);
          if (nPico > 0) {
            picos.push(Math.max(maximoAbsoluto(esq, nPico), maximoAbsoluto(dir, nPico)));
            if (picos.length > PICOS_GUARDADOS) picos.shift();
          }
          const maximo = Math.max(0, ...picos);
          const nRms = amostras(taxa, JANELA_RMS, total);
          lentas = {
            picoDb: maximo < SILENCIO_PICO ? null : dbAmplitude(maximo),
            rmsDb: rmsDb(esq, dir, nRms),
            lufs: lufs(esq, dir, amostras(taxa, JANELA_LUFS, total), k),
            correlacao: correlacao(esq, dir, nRms),
          };
        }
        return { nivel, marcaNivel, ...lentas };
      },

      // Apaga o pico e força a leitura lenta seguinte. Sendo `a` o `agora` dessa chamada, daí em diante só contam
      // as amostras posteriores a a + MARGEM_REINICIO (deixa passar a transição do Antes/Depois).
      reiniciarPico() { picos = []; ultima = -Infinity; reinicioPendente = true; },
    };
  }

  function novoEstadoEspectro() {
    return { val: new Float32Array(NUM_BANDAS), pico: new Float32Array(NUM_BANDAS) };
  }

  // dbBins vem de getFloatFrequencyData (fftSize = 2 × dbBins.length). Atualiza estado.val e estado.pico, de 0 a 1.
  function bandasEspectro(dbBins, taxa, estado) {
    const n = dbBins.length, largura = taxa / (2 * n);
    for (let i = 0; i < NUM_BANDAS; i++) {
      const f0 = FREQ_MIN * RAZAO_FREQ ** (i / NUM_BANDAS), f1 = FREQ_MIN * RAZAO_FREQ ** ((i + 1) / NUM_BANDAS);
      const centro = Math.sqrt(f0 * f1);
      let de = Math.ceil(f0 / largura), ate = Math.ceil(f1 / largura);       // bins com o centro em [f0, f1)
      if (ate <= de) { de = Math.round(centro / largura); ate = de + 1; }     // banda mais estreita que um bin: o mais próximo
      let maximo = -Infinity;                                                 // acima do Nyquist não há bins: a banda fica a 0
      for (let b = de; b < Math.min(ate, n); b++) if (dbBins[b] > maximo) maximo = dbBins[b];
      const v = limitar((maximo + INCLINACAO_DB * Math.log2(centro / 1000) + DB_BASE) / DB_ALCANCE, 0, 1);
      estado.val[i] = Math.max(v, estado.val[i] - QUEDA_BARRA);
      estado.pico[i] = Math.max(estado.pico[i] - QUEDA_PICO, estado.val[i]);
    }
  }

  // Número à portuguesa: vírgula decimal e sinal «−». Um valor que arredonda para zero fica sem sinal negativo.
  function numeroPt(v, casas, sinalSempre) {
    if (!Number.isFinite(v)) return SEM_VALOR;
    const texto = Math.abs(v).toFixed(casas);
    const sinal = v < 0 && Number(texto) !== 0 ? MENOS : sinalSempre ? '+' : '';
    return sinal + texto.replace('.', ',');
  }
  const formatarDb = (v, casas = 1) => numeroPt(v, casas, false);
  const formatarCorrelacao = (v) => numeroPt(v, 2, true);

  // m:ss, com os minutos sem limite.
  function formatarTempo(seg) {
    if (!Number.isFinite(seg)) return SEM_VALOR + ':' + SEM_VALOR;
    const total = Math.floor(seg);
    return Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0');
  }

  const Analise = { NUM_BANDAS, criarMedidor, novoEstadoEspectro, bandasEspectro, formatarDb, formatarCorrelacao, formatarTempo };
  raiz.Analise = Analise;
  if (typeof module === 'object' && module.exports) module.exports = Analise;
})(typeof window !== 'undefined' ? (window.Portfolio = window.Portfolio || {}) : {});
