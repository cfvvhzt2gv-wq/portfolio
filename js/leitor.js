(function (raiz) {
  // Motor de reprodução: uma faixa de cada vez, com uma versão («depois») ou duas («antes» e «depois»), cada uma num elemento <audio>.
  // Com análise, o som passa por um só AudioContext e por analisadores, de onde os instrumentos leem amostras e espectro; sem análise
  // (modo simples) há só os elementos <audio>, e a versão que não se ouve fica com o som desligado (muted).
  // Do ambiente (Audio, AudioContext, navigator) só se toca dentro das funções, para o ficheiro se poder carregar em Node.

  const JANELA = 32768, BINS = 4096;           // amostras de cada canal no tempo; valores do espectro, em dB
  const SUAVIZACAO_ESPECTRO = 0.72;
  const PASSAGEM = 0.03;                       // s: passagem de ganhos entre as duas versões
  const DESALINHAMENTO = 0.05;                 // s: acima desta diferença de posição, a versão que entra é alinhada com a que sai
  const TENTATIVAS_INSTANTANEO = 4;            // leituras de esq, dir e esq até os dois canais serem do mesmo instante
  const FOLGA_FIM = 0.05;                      // s: procurar nunca passa de duração − FOLGA_FIM, para a faixa terminar em ordem

  // O grafo comum a todas as faixas: cada versão chega à entrada (estéreo) por um ganho; a entrada vai para o destino e para os analisadores.
  function criarGrafo(contexto) {
    const analisador = (tamanho) => { const a = contexto.createAnalyser(); a.fftSize = tamanho; return a; };
    const entrada = contexto.createGain(), divisor = contexto.createChannelSplitter(2);
    entrada.channelCount = 2; entrada.channelCountMode = 'explicit'; entrada.channelInterpretation = 'speakers';
    const esq = analisador(JANELA), dir = analisador(JANELA), espectro = analisador(2 * BINS);
    espectro.smoothingTimeConstant = SUAVIZACAO_ESPECTRO;
    entrada.connect(contexto.destination);
    entrada.connect(divisor); divisor.connect(esq, 0); divisor.connect(dir, 1);
    entrada.connect(espectro);
    return { entrada, esq, dir, espectro };
  }

  function criar({ analise = false } = {}) {
    let contexto = null, grafo = null;         // só com análise; criados no primeiro tocar, dentro do gesto do utilizador
    let emCurso = null;                        // a faixa em curso, ou null: { el, ganho, nos, ativa } (elementos e ganhos por versão)
    let geracao = 0;                           // sobe em cada tocar e parar; o que pertence a uma geração antiga é ignorado

    const ativo = () => (emCurso ? emCurso.el[emCurso.ativa] : null);
    const elementos = () => (emCurso ? Object.values(emCurso.el) : []);
    // resume() só rejeita (InvalidStateError) com o contexto fechado, e este contexto nunca se fecha: ignorar a rejeição é seguro.
    const acordar = () => { if (contexto) contexto.resume().catch(() => {}); };

    // Um pause() ou um load() depois do play() rejeita-o com AbortError: nunca é erro. Qualquer outra rejeição falha a geração g.
    const arrancar = (el, g) => Promise.resolve(el.play()).catch((e) => { if (!e || e.name !== 'AbortError') falhar(g); });

    // Liberta a faixa em curso: os ficheiros (um elemento descartado ainda pode disparar «error», que a geração faz ignorar) e os nós do grafo.
    function descartar() {
      if (!emCurso) return;
      const { el, nos } = emCurso;
      emCurso = null;
      for (const audio of Object.values(el)) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
      for (const no of nos) no.disconnect();
    }
    function parar() { geracao++; descartar(); }

    // Pára antes de avisar: parar sobe a geração, e com isso o «error» do elemento e o play() rejeitado (chegam os dois) só avisam uma vez;
    // e quem recebe o aviso já encontra o motor parado, podendo tocar outra faixa sem ser interrompido.
    function falhar(g) {
      if (g !== geracao) return;
      parar();
      if (leitor.aoErro) leitor.aoErro();
    }
    function terminar() {
      parar();
      if (leitor.aoFim) leitor.aoFim();
    }

    // Cria o elemento de uma versão da faixa em curso (com o seu ganho, se houver análise) e liga-lhe os eventos da geração g.
    function adicionar(versao, url, g) {
      const el = new Audio(url), audivel = emCurso.ativa === versao;
      el.preload = 'auto';
      emCurso.el[versao] = el;
      if (analise) {
        const fonte = contexto.createMediaElementSource(el), ganho = contexto.createGain();
        ganho.gain.value = audivel ? 1 : 0;
        fonte.connect(ganho); ganho.connect(grafo.entrada);
        emCurso.ganho[versao] = ganho; emCurso.nos.push(fonte, ganho);
      } else {
        el.muted = !audivel;
      }
      el.addEventListener('error', () => falhar(g));
      el.addEventListener('ended', () => { if (g === geracao && el === ativo()) terminar(); });
    }

    // true se a faixa começou a tocar; false se outra chamada a substituiu, se falhou (e aoErro avisou) ou se foi posta em pausa durante o arranque.
    // Tudo o que depende do gesto do utilizador (contexto, resume, play) acontece antes do primeiro await.
    async function tocar(faixa, versao = 'depois') {
      const g = ++geracao;
      descartar();
      emCurso = { el: {}, ganho: {}, nos: [], ativa: versao === 'antes' && faixa.urlAntes ? 'antes' : 'depois' };
      try {
        if (analise) {
          if (!contexto) {
            try { navigator.audioSession.type = 'playback'; } catch {}     // iOS 16.4 ou posterior: toca mesmo com o telefone em silêncio
            const novo = new AudioContext();
            grafo = criarGrafo(novo); contexto = novo;
          }
          acordar();
        }
        adicionar('depois', faixa.url, g);
        if (faixa.urlAntes) adicionar('antes', faixa.urlAntes, g);
      } catch (erro) {
        console.error(erro);
        falhar(g);
        return false;
      }
      await Promise.all(elementos().map((el) => arrancar(el, g)));
      return g === geracao && aTocar();
    }

    function pausar() { for (const el of elementos()) el.pause(); }
    async function retomar() {
      if (!emCurso) return;
      const g = geracao, lista = elementos();
      acordar();
      await Promise.all(lista.map((el) => arrancar(el, g)));
    }

    function procurar(seg) {
      const d = duracao(), alvo = Math.max(0, d === null ? seg : Math.min(seg, d - FOLGA_FIM));
      if (Number.isFinite(alvo)) for (const el of elementos()) el.currentTime = alvo;
    }

    // Quem entra é alinhado com quem sai se andarem a mais de DESALINHAMENTO; depois os ganhos (ou o muted) passam de um para o outro.
    function trocarVersao(versao) {
      const nova = versao === 'antes' ? 'antes' : 'depois';
      if (!emCurso || nova === emCurso.ativa || !emCurso.el[nova]) return;
      const sai = ativo(), entra = emCurso.el[nova];
      if (Math.abs(entra.currentTime - sai.currentTime) > DESALINHAMENTO) entra.currentTime = sai.currentTime;
      // Uma versão mais curta pode já ter acabado (o seu «ended» só conta quando está ativa): então a faixa termina em ordem, em vez de ficar
      // presa em silêncio. Se apenas ficou parada (voltou-se atrás depois de acabar) e quem sai toca, arranca-se para a troca se ouvir.
      // O fim vem primeiro: um play() num elemento que acabou recomeçaria do 0. Depois do seek do alinhamento o «ended» pode ler false com a
      // posição já no fim (Chromium, num elemento que acabou a tocar), por isso a posição também conta.
      if (entra.ended || entra.currentTime >= entra.duration) { terminar(); return; }
      if (!sai.paused && entra.paused) arrancar(entra, geracao);
      if (analise) {
        const t = contexto.currentTime;
        for (const [v, alvo] of [[emCurso.ativa, 0], [nova, 1]]) {
          const parametro = emCurso.ganho[v].gain, atual = parametro.value;
          parametro.cancelScheduledValues(t);
          parametro.setValueAtTime(atual, t);
          parametro.linearRampToValueAtTime(alvo, t + PASSAGEM);
        }
      } else {
        sai.muted = true; entra.muted = false;
      }
      emCurso.ativa = nova;
    }

    function posicao() { const a = ativo(); return a ? a.currentTime : 0; }
    function duracao() { const a = ativo(); return a && Number.isFinite(a.duration) ? a.duration : null; }
    function versao() { return emCurso ? emCurso.ativa : 'depois'; }
    function aTocar() { const a = ativo(); return !!a && !a.paused && !a.ended; }

    // Os dois analisadores leem-se um a seguir ao outro e o áudio pode avançar entre as leituras: lê-se esq, dir e esq outra vez, e se esq
    // mudou repete-se (poucas vezes; depois aceita-se a última), para os dois canais serem do mesmo instante.
    let conferencia = null;
    function amostras(esq, dir) {
      if (!grafo) return false;
      if (!conferencia || conferencia.length !== esq.length) conferencia = new Float32Array(esq.length);
      for (let tentativa = 0; tentativa < TENTATIVAS_INSTANTANEO; tentativa++) {
        grafo.esq.getFloatTimeDomainData(esq); grafo.dir.getFloatTimeDomainData(dir); grafo.esq.getFloatTimeDomainData(conferencia);
        let igual = true;
        for (let i = 0; i < esq.length && igual; i++) igual = esq[i] === conferencia[i];
        if (igual) break;
      }
      return true;
    }
    function espectro(saida) {
      if (!grafo) return 0;
      grafo.espectro.getFloatFrequencyData(saida);
      return contexto.sampleRate;
    }

    const leitor = {
      tocar, pausar, retomar, parar, procurar, trocarVersao, posicao, duracao, versao, aTocar, amostras, espectro,
      get taxa() { return contexto ? contexto.sampleRate : 0; },     // 0 sem análise (e antes do primeiro tocar, que cria o contexto)
      aoFim: null, aoErro: null,
    };
    return leitor;
  }

  const Leitor = { JANELA, BINS, criar };
  raiz.Leitor = Leitor;
  if (typeof module === 'object' && module.exports) module.exports = Leitor;
})(typeof window !== 'undefined' ? (window.Portfolio = window.Portfolio || {}) : {});
