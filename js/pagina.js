(function (raiz) {
  // Página: transforma o conteúdo (conteudo.js) num modelo, monta o DOM com ele e arranca sozinha.
  // O texto do conteúdo entra no DOM só com createElement e textContent, nunca como HTML.

  const NS_SVG = 'http://www.w3.org/2000/svg';
  const SEM_TEMPO = '—:—';

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
      redes: lista(contacto.redes).map(objeto).map((r) => ({ nome: comoTexto(r.nome), url: comoTexto(r.url) })).filter((r) => r.nome && r.url),
      categorias,
      sobre: lerSobre(c.sobre),
    };
  }

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

  function iconePlay(doc) {
    const svg = doc.createElementNS(NS_SVG, 'svg'), caminho = doc.createElementNS(NS_SVG, 'path');
    for (const [k, v] of [['width', '14'], ['height', '14'], ['viewBox', '0 0 24 24'], ['aria-hidden', 'true']]) svg.setAttribute(k, v);
    caminho.setAttribute('d', 'M7 4.5v15l13-7.5z');
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
        no(doc, 'button', { classe: 'play', type: 'button', 'aria-label': `Ouvir ${faixa.titulo}` }, iconePlay(doc)),
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

  function iniciar(conteudo, janela = window) {
    const modelo = preparar(conteudo);
    montar(janela.document, modelo);
    janela.document.title = modelo.nome ? `${modelo.nome} — Produção musical` : 'Produção musical';
  }

  const Pagina = { preparar, montar, iniciar };
  raiz.Pagina = Pagina;
  if (typeof module === 'object' && module.exports) module.exports = Pagina;
  if (typeof document !== 'undefined' && typeof window !== 'undefined' && window.CONTEUDO) iniciar(window.CONTEUDO, window);
})(typeof window !== 'undefined' ? (window.Portfolio = window.Portfolio || {}) : {});
