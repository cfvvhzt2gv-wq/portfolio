(function (raiz) {
  // Página: transforma o conteúdo (conteudo.js) num modelo, monta o DOM com ele e arranca sozinha.
  // O texto do conteúdo entra no DOM só com createElement e textContent, nunca como HTML.

  const NS_SVG = 'http://www.w3.org/2000/svg';
  const SEM_TEMPO = '—:—', SEM_VALOR = '—';

  // As três categorias, pela ordem em que aparecem. «detalhes» são os campos da linha por baixo do título.
  const CATEGORIAS = [
    { id: 'instrumentais', nome: 'Instrumentais', unidade: ['faixa', 'faixas'], detalhes: ['genero', 'ano'], antesDepois: false },
    { id: 'mistura', nome: 'Mistura e masterização', unidade: ['trabalho', 'trabalhos'], detalhes: ['servico', 'ano'], antesDepois: true },
    { id: 'cinematografico', nome: 'Áudio cinematográfico', unidade: ['projeto', 'projetos'], detalhes: ['tipo', 'ano'], antesDepois: false },
  ];
  const TOPICOS_SOBRE = [['daws', 'DAWs'], ['formacao', 'Formação'], ['tecnicas', 'Técnicas']];

  // ---- Modelo (puro: nunca lança, nunca deixa «undefined») ----

  const objeto = (v) => (v && typeof v === 'object' ? v : {});
  const lista = (v) => (Array.isArray(v) ? v : []);
  // Texto sem espaços nas pontas; números valem (o ano pode ser 2026 ou "2026"); o resto é vazio.
  const comoTexto = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');

  // A faixa pronta a mostrar, ou null se faltar o título ou algum ficheiro.
  function lerFaixa(def, bruta) {
    const titulo = comoTexto(bruta.titulo);
    if (!titulo) return null;
    const detalhes = def.detalhes.map((campo) => comoTexto(bruta[campo])).filter(Boolean).join(' · ');
    if (def.antesDepois) {
      const antes = comoTexto(bruta.antes), depois = comoTexto(bruta.depois), artista = comoTexto(bruta.artista);
      return antes && depois ? { titulo: artista ? `${artista} — ${titulo}` : titulo, detalhes, url: depois, urlAntes: antes } : null;
    }
    const ficheiro = comoTexto(bruta.ficheiro);
    return ficheiro ? { titulo, detalhes, url: ficheiro, urlAntes: null } : null;
  }

  function lerCategoria(def, bruta, numero) {
    const faixas = [];
    for (const f of lista(bruta.faixas)) {
      const faixa = lerFaixa(def, objeto(f));
      if (faixa) faixas.push({ id: `${def.id}-${faixas.length}`, ...faixa });
    }
    if (!faixas.length) return null;
    return {
      id: def.id, numero, nome: def.nome, contador: `${faixas.length} ${def.unidade[faixas.length === 1 ? 0 : 1]}`,
      descricao: comoTexto(bruta.descricao) || null, faixas,
    };
  }

  function lerSobre(bruto) {
    const s = objeto(bruto);
    const sobre = {
      daws: lista(s.daws).map(comoTexto).filter(Boolean),
      formacao: lista(s.formacao).map(objeto).map((x) => ({ titulo: comoTexto(x.titulo), periodo: comoTexto(x.periodo) || null })).filter((x) => x.titulo),
      tecnicas: lista(s.tecnicas).map(comoTexto).filter(Boolean),
    };
    return sobre.daws.length || sobre.formacao.length || sobre.tecnicas.length ? sobre : null;
  }

  function preparar(conteudo) {
    const c = objeto(conteudo), contacto = objeto(c.contacto), brutas = objeto(c.categorias), categorias = [];
    for (const def of CATEGORIAS) {
      const numero = String(categorias.length + 1).padStart(2, '0');   // a numeração acompanha as categorias visíveis
      const categoria = lerCategoria(def, objeto(brutas[def.id]), numero);
      if (categoria) categorias.push(categoria);
    }
    return {
      nome: comoTexto(c.nome),
      local: comoTexto(c.local) || null,
      email: comoTexto(contacto.email) || null,
      redes: lista(contacto.redes).map(objeto).map((r) => ({ nome: comoTexto(r.nome), url: comoTexto(r.url) })).filter((r) => r.nome && /^https?:\/\//i.test(r.url)),   // só ligações web: sem esquema seria um link relativo partido, e javascript: seria perigoso
      categorias,
      sobre: lerSobre(c.sobre),
    };
  }

  // ---- Modo e formas de onda (puros) ----

  const NUM_PICOS = 800, PICO_MAXIMO = 255;

  // «simples»: linha de progresso e tempo, sem análise do som (spec 6.5); «completo»: com instrumentos e leituras.
  function decidirModo({ protocolo, temWebAudio, ios, temAudioSession }) {
    return protocolo === 'file:' || !temWebAudio || (ios && !temAudioSession) ? 'simples' : 'completo';
  }

  // O conteúdo de um nome.onda.json, se for válido (duração positiva e 800 inteiros de 0 a 255); senão null.
  function validarOnda(json) {
    const o = objeto(json);
    if (typeof o.duracao !== 'number' || !Number.isFinite(o.duracao) || o.duracao <= 0) return null;
    if (!Array.isArray(o.picos) || o.picos.length !== NUM_PICOS) return null;
    if (!o.picos.every((p) => Number.isInteger(p) && p >= 0 && p <= PICO_MAXIMO)) return null;
    return { duracao: o.duracao, picos: o.picos };
  }

  // 'audio/a.mp3' → 'audio/a.onda.json' (a extensão pode vir em qualquer caixa).
  const ondaUrl = (mp3) => `${mp3.replace(/\.[^./]*$/, '')}.onda.json`;

  // ---- DOM ----

  // Cria um elemento. «texto» e «classe» são atalhos; os outros pares são atributos; os filhos falsos (null, false, '') saltam-se.
  function no(doc, etiqueta, props, ...filhos) {
    const e = doc.createElement(etiqueta);
    for (const [chave, valor] of Object.entries(props || {})) {
      if (chave === 'texto') e.textContent = valor;
      else e.setAttribute(chave === 'classe' ? 'class' : chave, valor);
    }
    e.append(...filhos.filter(Boolean));
    return e;
  }
  const encher = (contentor, ...filhos) => contentor.replaceChildren(...filhos.filter(Boolean));

  const ICONES = { play: 'M7 4.5v15l13-7.5z', pausa: 'M6 4.5h4v15H6zM14 4.5h4v15h-4z' };
  function icone(doc, tipo) {
    const svg = doc.createElementNS(NS_SVG, 'svg'), caminho = doc.createElementNS(NS_SVG, 'path');
    for (const [k, v] of [['width', '14'], ['height', '14'], ['viewBox', '0 0 24 24'], ['aria-hidden', 'true']]) svg.setAttribute(k, v);
    caminho.setAttribute('d', ICONES[tipo]);
    caminho.setAttribute('fill', 'currentColor');
    svg.append(caminho);
    return svg;
  }

  function montarAntesDepois(doc) {
    const botao = (versao, rotulo) => no(doc, 'button', { type: 'button', 'data-versao': versao, 'aria-pressed': String(versao === 'depois'), texto: rotulo });
    return no(doc, 'div', { classe: 'antes-depois', role: 'group', 'aria-label': 'Comparar versões' }, botao('antes', 'Antes'), botao('depois', 'Depois'));
  }

  function montarFaixa(doc, faixa) {
    return no(doc, 'article', { classe: 'faixa', 'data-faixa': faixa.id, 'data-estado': 'parada' },
      no(doc, 'div', { classe: 'linha' },
        no(doc, 'button', { classe: 'play', type: 'button', 'aria-label': `Ouvir ${faixa.titulo}` }, icone(doc, 'play')),
        no(doc, 'div', { classe: 'titulo' },
          no(doc, 'div', { classe: 'nome', texto: faixa.titulo }),
          faixa.detalhes && no(doc, 'div', { classe: 'detalhes', texto: faixa.detalhes })),
        faixa.urlAntes && montarAntesDepois(doc),
        no(doc, 'span', { classe: 'tempo', texto: SEM_TEMPO })));
  }

  function montarCategoria(doc, c) {
    return no(doc, 'section', { classe: 'categoria', id: c.id, 'data-categoria': c.id },
      no(doc, 'div', { classe: 'categoria-cab' },
        no(doc, 'p', { classe: 'num', texto: c.numero }),
        no(doc, 'h2', { texto: c.nome }),
        c.descricao && no(doc, 'p', { classe: 'descricao', texto: c.descricao })),
      no(doc, 'div', { classe: 'categoria-corpo' }, ...c.faixas.map((f) => montarFaixa(doc, f))));
  }

  function montarSobre(doc, sobre) {
    const item = (i) => (typeof i === 'string'
      ? no(doc, 'span', { classe: 'item', texto: i })
      : no(doc, 'span', { classe: 'item' }, i.titulo, i.periodo && no(doc, 'span', { classe: 'periodo', texto: i.periodo })));
    const topicos = TOPICOS_SOBRE.filter(([chave]) => sobre[chave].length)
      .map(([chave, rotulo]) => no(doc, 'div', { 'data-topico': chave }, no(doc, 'dt', { texto: rotulo }), no(doc, 'dd', {}, ...sobre[chave].map(item))));
    return no(doc, 'section', { id: 'sobre' }, no(doc, 'h2', { texto: 'Sobre' }), no(doc, 'dl', { classe: 'sobre' }, ...topicos));
  }

  function montarTopo(doc, m) {
    const frase = 'Instrumentais, mistura e masterização, áudio cinematográfico';
    encher(doc.querySelector('.topo-rodape'),
      no(doc, 'p', { classe: 'apresentacao', texto: m.nome ? `${frase} — por ${m.nome}.` : `${frase}.` }),
      m.local && no(doc, 'p', { classe: 'local', texto: m.local }));
  }

  function montarIndice(doc, categorias) {
    const indice = doc.getElementById('trabalhos');
    if (!categorias.length) { indice.remove(); return; }
    encher(indice, ...categorias.map((c) => no(doc, 'a', { classe: 'item-indice', href: `#${c.id}` },
      no(doc, 'span', { classe: 'num', texto: c.numero }),
      no(doc, 'span', { classe: 'nome', texto: c.nome }),
      no(doc, 'span', { classe: 'contador', texto: c.contador }))));
  }

  function montarContacto(doc, m) {
    const direitos = ['©', new Date().getFullYear(), m.nome].filter(Boolean).join(' ');
    encher(doc.getElementById('contacto'),
      no(doc, 'p', { id: 'contacto-rotulo', classe: 'rotulo', texto: 'Contacto' }),
      m.email && no(doc, 'a', { classe: 'email', href: `mailto:${m.email}`, texto: m.email }),
      no(doc, 'div', { classe: 'rodape-linha' },
        m.redes.length > 0 && no(doc, 'div', { classe: 'redes' },
          ...m.redes.map((r) => no(doc, 'a', { href: r.url, target: '_blank', rel: 'noopener noreferrer', texto: r.nome }))),
        no(doc, 'span', { classe: 'direitos', texto: direitos })));
  }

  function montar(doc, m) {
    const nomeSite = doc.querySelector('.nome-site');
    if (m.nome) nomeSite.textContent = m.nome; else nomeSite.remove();
    montarTopo(doc, m);
    montarIndice(doc, m.categorias);
    encher(doc.getElementById('secoes'), ...m.categorias.map((c) => montarCategoria(doc, c)), m.sobre && montarSobre(doc, m.sobre));
    montarContacto(doc, m);
    // Uma ligação do cabeçalho sem secção para onde ir (sem categorias ou sem «Sobre») não se mostra.
    for (const a of doc.querySelectorAll('.cabecalho nav a[href^="#"]')) if (!doc.querySelector(a.getAttribute('href'))) a.remove();
  }

  // ---- Painel de instrumentos ----

  const LEITURAS = [['nivel', 'Nível'], ['pico', 'Pico'], ['rms', 'RMS'], ['lufs', 'LUFS'], ['correlacao', 'Correlação']];
  const INSTRUMENTOS = [['espectro', 'Espectro'], ['estereo', 'Campo estéreo']];
  const INDISPONIVEL = 'Indisponível';
  const FONTES_ROTULOS = ['400 10px "IBM Plex Mono"', '500 10px "IBM Plex Mono"'];

  const canvasDecorativo = (doc) => no(doc, 'canvas', { 'aria-hidden': 'true' });

  // O painel de uma faixa ativa. O modo simples só tem a forma de onda (que sem picos é a linha de progresso);
  // o completo acrescenta as leituras e, sem «reduzir movimento», o espectro e o campo estéreo.
  // Devolve os nós de que o controlador precisa: onda, canvases por nome e os valores das leituras.
  function montarPainel(doc, completo, reduzido) {
    const canvases = { onda: canvasDecorativo(doc) };
    const onda = no(doc, 'div', {
      classe: 'onda', role: 'slider', tabindex: '0', 'aria-label': 'Posição na faixa',
      'aria-valuemin': '0', 'aria-valuemax': '0', 'aria-valuenow': '0',
    }, canvases.onda);
    const painel = no(doc, 'div', { classe: 'painel' }, onda);
    const dd = {}, nivel = {};
    if (completo && !reduzido) {
      const figuras = INSTRUMENTOS.map(([nome, rotulo]) => {
        canvases[nome] = canvasDecorativo(doc);
        return no(doc, 'figure', { classe: 'inst', 'data-instrumento': nome }, no(doc, 'figcaption', { texto: rotulo }), no(doc, 'div', { classe: 'tela' }, canvases[nome]));
      });
      painel.append(no(doc, 'div', { classe: 'instrumentos' }, ...figuras));
    }
    if (completo) {
      const itens = LEITURAS.map(([nome, rotulo]) => {
        dd[nome] = no(doc, 'dd', { texto: nome === 'nivel' ? '' : SEM_VALOR });
        if (nome === 'nivel') {
          nivel.barra = doc.createElement('i'); nivel.marca = doc.createElement('b');
          dd[nome].append(no(doc, 'span', { classe: 'nivel' }, nivel.barra, nivel.marca));
        }
        return no(doc, 'div', { 'data-leitura': nome }, no(doc, 'dt', { texto: rotulo }), dd[nome]);
      });
      painel.append(no(doc, 'dl', { classe: 'leituras' }, ...itens));
    }
    return { raiz: painel, onda, canvases, dd, nivel };
  }

  // ---- Controlador: liga o leitor, o painel e as faixas ----

  const MS_ENTRE_QUADROS = 15, MS_ENTRE_MEDICOES_REDUZIDO = 100, MS_ENTRE_ESCRITAS_REDUZIDO = 500;   // 60 desenhos/s no máximo; «reduzir movimento»: mede a 10 Hz e mostra 2 vezes por segundo
  const PASSO_TECLADO = 0.05, PASSO_MINIMO = 1;                                                      // setas: 5 % da faixa, no mínimo 1 s

  function detetarModo(janela) {
    const nav = janela.navigator || {};
    return decidirModo({
      protocolo: janela.location.protocol,
      temWebAudio: typeof janela.AudioContext === 'function',
      ios: /iP(hone|ad|od)/.test(nav.userAgent || '') || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1),
      temAudioSession: 'audioSession' in nav,
    });
  }

  function ligarLeitor(janela, modelo) {
    const doc = janela.document, { Analise, Instrumentos, Leitor } = janela.Portfolio;
    const completo = detetarModo(janela) === 'completo';
    const reduzido = !!(janela.matchMedia && janela.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const leitor = Leitor.criar({ analise: completo });
    const faixas = new Map();                        // id → controlo da faixa
    const esq = completo ? new Float32Array(Leitor.JANELA) : null, dir = completo ? new Float32Array(Leitor.JANELA) : null;
    const bins = completo ? new Float32Array(Leitor.BINS) : null;
    let ativa = null, ciclo = 0, ultimoQuadro = 0, ultimaEscrita = 0;

    const fmtTempo = Analise.formatarTempo;
    const fmtDb = (v) => (Number.isFinite(v) ? `${Analise.formatarDb(v)} dB` : SEM_VALOR);
    const limitar = (v, min, max) => Math.min(max, Math.max(min, v));
    // Só toca no DOM quando o valor muda.
    const escreverTexto = (el, texto) => { if (el.textContent !== texto) el.textContent = texto; };
    const escreverAtributo = (el, nome, valor) => { if (el.getAttribute(nome) !== valor) el.setAttribute(nome, valor); };
    const duracaoDe = (c) => c.duracao || leitor.duracao();
    const picosDe = (c) => (c.ondas[c.versao] ? c.ondas[c.versao].picos : null);

    // ---- Estado da faixa ----

    function definirEstado(c, estado) {
      c.estado = estado;
      c.art.setAttribute('data-estado', estado);
      c.play.setAttribute('aria-label', `${estado === 'a-tocar' ? 'Pausar' : 'Ouvir'} ${c.titulo}`);
      c.play.replaceChildren(icone(doc, estado === 'a-tocar' ? 'pausa' : 'play'));
      c.play.disabled = estado === 'indisponivel';
    }

    // Fecha o painel e deixa a faixa parada (ou indisponível), com a duração conhecida no lugar do tempo.
    function fechar(c, estado = 'parada') {
      if (ativa === c) { ativa = null; pararCiclo(); }
      c.arrasto = null;
      const comFoco = !!c.painel && c.painel.raiz.contains(doc.activeElement);   // sem isto o foco do teclado perdia-se no body
      if (c.painel) c.painel.raiz.remove();
      c.painel = null;
      definirEstado(c, estado);
      if (comFoco) {
        const destino = c.play.disabled ? c.art : c.play;                         // indisponível: o botão não aceita foco, fica a linha
        if (destino === c.art) c.art.setAttribute('tabindex', '-1');
        destino.focus();
      }
      escreverTexto(c.tempo, estado === 'indisponivel' ? INDISPONIVEL : c.duracao ? fmtTempo(c.duracao) : SEM_TEMPO);
    }

    function abrir(c) {
      const p = montarPainel(doc, completo, reduzido);
      p.telas = {};
      for (const [nome, canvas] of Object.entries(p.canvases)) p.telas[nome] = Instrumentos.criarTela(canvas);
      c.painel = p;
      c.medidor = null; c.estadoEspectro = completo ? Analise.novoEstadoEspectro() : null; c.estadoEstereo = Instrumentos.criarEstereo();
      c.art.append(p.raiz);
      verPainel(p.raiz);
      ligarOnda(c);
      atualizarPosicao(c);
      redesenharTudo(c);
    }

    // Um painel que abre fora do ecrã (a faixa está no fundo da janela) passa a ver-se, sem animação.
    function verPainel(raiz) {
      try { raiz.scrollIntoView({ block: 'nearest', behavior: 'instant' }); } catch { raiz.scrollIntoView({ block: 'nearest' }); }
    }

    // ---- Desenho ----

    // Tempo «0:42 / 3:15» e controlo de posição, a partir da posição do leitor.
    function atualizarPosicao(c) {
      const p = c.painel;
      if (!p) return;
      if (!c.duracao) c.duracao = leitor.duracao();                   // sem onda.json, a duração é a do áudio, quando já se conhece
      const pos = leitor.posicao(), texto = `${fmtTempo(pos)} / ${c.duracao ? fmtTempo(c.duracao) : SEM_TEMPO}`;
      escreverTexto(c.tempo, texto);
      escreverAtributo(p.onda, 'aria-valuenow', pos.toFixed(2));
      escreverAtributo(p.onda, 'aria-valuemax', (c.duracao || 0).toFixed(2));
      escreverAtributo(p.onda, 'aria-valuetext', texto);
    }

    function redesenharOnda(c) {
      const p = c.painel;
      if (!p || !p.telas.onda.ajustar()) return;
      Instrumentos.desenharOnda(p.telas.onda, picosDe(c), c.duracao ? leitor.posicao() / c.duracao : 0);
    }

    // Espectro com o último estado e campo estéreo só com a moldura (ao abrir, ao mudar de tamanho): nunca com amostras, para não mexer no rasto.
    function redesenharInstrumentos(c) {
      const p = c.painel;
      if (!p || !completo || reduzido) return;
      if (p.telas.espectro.ajustar()) Instrumentos.desenharEspectro(p.telas.espectro, c.estadoEspectro);
      if (p.telas.estereo.ajustar()) Instrumentos.desenharEstereo(p.telas.estereo, c.estadoEstereo, null, null, 0);
    }
    function redesenharTudo(c) { redesenharOnda(c); redesenharInstrumentos(c); }

    function desenharInstrumentos(c) {
      const p = c.painel;
      if (p.telas.espectro.ajustar()) Instrumentos.desenharEspectro(p.telas.espectro, c.estadoEspectro);
      if (p.telas.estereo.ajustar()) Instrumentos.desenharEstereo(p.telas.estereo, c.estadoEstereo, esq, dir, leitor.taxa);
    }

    // Lê o som, atualiza o medidor (com o relógio da página, que nunca recua) e, sem «reduzir movimento», o espectro.
    function medir(c, agora) {
      if (!leitor.taxa || !leitor.amostras(esq, dir)) return null;
      if (!c.medidor) c.medidor = Analise.criarMedidor(leitor.taxa);
      const m = c.medidor.atualizar(esq, dir, agora);
      if (!reduzido) { const taxa = leitor.espectro(bins); Analise.bandasEspectro(bins, taxa, c.estadoEspectro); }
      return m;
    }

    function escreverLeituras(c, m) {
      const { dd, nivel } = c.painel;
      escreverAtributo(nivel.barra, 'style', `width: ${(m.nivel * 100).toFixed(1)}%`);
      escreverAtributo(nivel.marca, 'style', `left: ${(m.marcaNivel * 99).toFixed(1)}%`);
      escreverTexto(dd.pico, fmtDb(m.picoDb)); escreverTexto(dd.rms, fmtDb(m.rmsDb));
      escreverTexto(dd.lufs, Analise.formatarDb(m.lufs)); escreverTexto(dd.correlacao, Analise.formatarCorrelacao(m.correlacao));
    }

    // ---- Ciclo de desenho: só enquanto a faixa toca ----

    function quadro(agoraMs) {
      ciclo = 0;
      const c = ativa;
      if (!c || c.estado !== 'a-tocar' || c.arrasto) return;
      ciclo = janela.requestAnimationFrame(quadro);
      if (agoraMs - ultimoQuadro < (reduzido ? MS_ENTRE_MEDICOES_REDUZIDO : MS_ENTRE_QUADROS)) return;
      ultimoQuadro = agoraMs;
      const m = completo ? medir(c, janela.performance.now() / 1000) : null;
      if (reduzido && agoraMs - ultimaEscrita < MS_ENTRE_ESCRITAS_REDUZIDO) return;
      ultimaEscrita = agoraMs;
      atualizarPosicao(c);
      redesenharOnda(c);
      if (!m) return;
      escreverLeituras(c, m);
      if (!reduzido) desenharInstrumentos(c);
    }
    function iniciarCiclo() {
      if (ciclo || !ativa || ativa.estado !== 'a-tocar' || ativa.arrasto) return;
      ultimoQuadro = -Infinity; ultimaEscrita = -Infinity;
      ciclo = janela.requestAnimationFrame(quadro);
    }
    function pararCiclo() {
      if (ciclo) janela.cancelAnimationFrame(ciclo);
      ciclo = 0;
    }

    // ---- Reprodução ----

    function tocarNova(c) {
      if (ativa) fechar(ativa);                                  // fecha o painel da anterior (o motor só a larga em leitor.tocar)
      ativa = c;
      definirEstado(c, 'a-tocar');
      // O motor tem de trocar de faixa antes de o painel novo ler a duração e a posição, senão lê as da faixa anterior.
      // É síncrono até ao primeiro await, por isso continua dentro do gesto do utilizador; o fim e o erro chegam por aoFim e aoErro.
      leitor.tocar(c.def, c.versao);
      if (ativa !== c) return;                                   // falhou logo (aoErro já fechou a faixa como indisponível)
      abrir(c);
      iniciarCiclo();
    }
    function pausar(c) {
      definirEstado(c, 'em-pausa');
      leitor.pausar();
      pararCiclo();
      atualizarPosicao(c);
      redesenharOnda(c);
    }
    function retomar(c) {
      definirEstado(c, 'a-tocar');
      leitor.retomar();
      iniciarCiclo();
    }
    function aoClicarPlay(c) {
      if (c.estado === 'indisponivel') return;
      if (ativa !== c) tocarNova(c);
      else if (c.estado === 'a-tocar') pausar(c);
      else retomar(c);
    }

    leitor.aoFim = () => { if (ativa) fechar(ativa); };
    leitor.aoErro = () => { if (ativa) fechar(ativa, 'indisponivel'); };

    // ---- Posição ----

    // O leitor limita a posição ao fim da faixa; em pausa só se redesenha a onda (os instrumentos ficam na última imagem).
    function procurar(c, seg) {
      leitor.procurar(seg);
      atualizarPosicao(c);
      redesenharOnda(c);
    }
    function procurarNoPonto(c, x) {
      const d = duracaoDe(c);
      if (!d) return;
      const r = c.painel.onda.getBoundingClientRect();
      procurar(c, limitar((x - r.left) / r.width, 0, 1) * d);
    }

    // Durante o arrasto o som pausa e retoma ao largar (se estava a tocar). Um arrasto cancelado (pointercancel) volta à posição de onde partiu.
    function comecarArrasto(c) {
      c.arrasto = { retomar: c.estado === 'a-tocar', origem: leitor.posicao() };
      if (c.arrasto.retomar) { leitor.pausar(); pararCiclo(); }
    }
    function soltar(c, cancelado) {
      const a = c.arrasto;
      c.arrasto = null;
      if (!a || ativa !== c) return;
      if (cancelado) procurar(c, a.origem);
      if (a.retomar && c.estado === 'a-tocar') { leitor.retomar(); iniciarCiclo(); }
    }

    function alvoDoTeclado(tecla, pos, d) {
      const passo = Math.max(PASSO_MINIMO, d * PASSO_TECLADO);
      switch (tecla) {
        case 'ArrowRight': case 'ArrowUp': return pos + passo;
        case 'ArrowLeft': case 'ArrowDown': return pos - passo;
        case 'Home': return 0;
        case 'End': return d;
        default: return null;
      }
    }

    function ligarOnda(c) {
      const onda = c.painel.onda;
      // Rato: procura logo ao carregar. Toque e caneta: carregar não faz nada (o browser pode estar a começar a deslizar a página na vertical, e
      // então chega pointercancel); um toque procura ao levantar, e o arrasto só começa no primeiro movimento sobretudo horizontal.
      let toque = null;                                            // { x, y } do pointerdown de um toque, até haver arrasto ou toque
      const comRato = (e) => e.pointerType === 'mouse' || !e.pointerType;
      onda.addEventListener('pointerdown', (e) => {
        if (e.button > 0) return;
        try { onda.setPointerCapture(e.pointerId); } catch {}
        if (comRato(e)) { comecarArrasto(c); procurarNoPonto(c, e.clientX); } else toque = { x: e.clientX, y: e.clientY };
      });
      onda.addEventListener('pointermove', (e) => {
        if (toque && Math.abs(e.clientX - toque.x) > Math.abs(e.clientY - toque.y)) { toque = null; comecarArrasto(c); }
        if (c.arrasto) procurarNoPonto(c, e.clientX);
      });
      onda.addEventListener('pointerup', (e) => {
        if (toque) { toque = null; procurarNoPonto(c, e.clientX); return; }
        soltar(c, false);
      });
      onda.addEventListener('pointercancel', () => { toque = null; soltar(c, true); });
      onda.addEventListener('keydown', (e) => {
        const d = duracaoDe(c);
        if (!d || e.altKey || e.ctrlKey || e.metaKey) return;
        const alvo = alvoDoTeclado(e.key, leitor.posicao(), d);
        if (alvo === null) return;
        e.preventDefault();
        procurar(c, limitar(alvo, 0, d));
      });
    }

    // ---- Antes / Depois ----

    function marcarVersao(c) {
      for (const b of c.botoes) b.setAttribute('aria-pressed', String(b.getAttribute('data-versao') === c.versao));
    }
    function escolherVersao(c, versao) {
      if (c.versao === versao) return;
      c.versao = versao;
      marcarVersao(c);
      if (ativa !== c) return;                                   // parada: só muda a versão que vai tocar
      leitor.trocarVersao(versao);
      if (ativa !== c) return;                                   // a versão que entra já tinha acabado: a faixa terminou durante a troca
      c.versao = leitor.versao();
      marcarVersao(c);
      redesenharOnda(c);
      if (c.medidor) c.medidor.reiniciarPico();                  // para a diferença se ver logo nas leituras
    }

    // ---- Formas de onda (só no modo completo) ----

    function aplicarOnda(c, versao, onda) {
      c.ondas[versao] = onda;
      if (!onda) return;
      if (versao === 'depois') {
        c.duracao = onda.duracao;
        if (c.estado === 'parada') escreverTexto(c.tempo, fmtTempo(c.duracao));
      }
      if (ativa === c) { atualizarPosicao(c); redesenharOnda(c); }
    }
    function pedirOndas(c) {
      for (const [versao, url] of [['depois', c.def.url], ['antes', c.def.urlAntes]]) {
        if (!url) continue;
        janela.fetch(ondaUrl(url)).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((json) => aplicarOnda(c, versao, validarOnda(json)));
      }
    }

    // ---- Arranque ----

    for (const categoria of modelo.categorias) {
      for (const def of categoria.faixas) {
        const art = doc.querySelector(`[data-faixa="${def.id}"]`);
        const c = {
          def, art, titulo: def.titulo, play: art.querySelector('.play'), tempo: art.querySelector('.tempo'), botoes: [...art.querySelectorAll('[data-versao]')],
          estado: 'parada', versao: 'depois', ondas: { antes: null, depois: null }, duracao: null, painel: null, arrasto: null,
          medidor: null, estadoEspectro: null, estadoEstereo: null,
        };
        faixas.set(def.id, c);
        c.play.addEventListener('click', () => aoClicarPlay(c));
        for (const b of c.botoes) b.addEventListener('click', () => escolherVersao(c, b.getAttribute('data-versao')));
        if (completo) pedirOndas(c);
      }
    }

    // Mudar de tamanho apaga os canvases: com a faixa parada ou em pausa redesenham-se; a tocar, o próximo quadro trata disso.
    const redesenharSeParado = () => { if (ativa && !ciclo) redesenharTudo(ativa); };
    janela.addEventListener('resize', redesenharSeParado);
    if (doc.fonts && doc.fonts.load) Promise.all(FONTES_ROTULOS.map((f) => doc.fonts.load(f))).then(redesenharSeParado, () => {});
  }

  function iniciar(conteudo, janela = window) {
    const modelo = preparar(conteudo);
    montar(janela.document, modelo);
    ligarLeitor(janela, modelo);
    janela.document.title = modelo.nome ? `${modelo.nome} — Produção musical` : 'Produção musical';
  }

  const Pagina = { preparar, montar, iniciar, decidirModo, validarOnda, ondaUrl };
  raiz.Pagina = Pagina;
  if (typeof module === 'object' && module.exports) module.exports = Pagina;
  if (typeof document !== 'undefined' && typeof window !== 'undefined' && window.CONTEUDO) iniciar(window.CONTEUDO, window);
})(typeof window !== 'undefined' ? (window.Portfolio = window.Portfolio || {}) : {});
