// tests/apoio/conteudo.cjs
// Conteúdo de teste (uma faixa por categoria) e a sua forma de `conteudo.js`.
const base = () => ({
  nome: 'Ana Teste',
  local: 'Lisboa, Portugal',
  contacto: {
    email: 'ana@exemplo.pt',
    redes: [{ nome: 'Instagram', url: 'https://exemplo.pt/anateste' }],
  },
  sobre: {
    daws: ['Ableton Live', 'Logic Pro'],
    formacao: [{ titulo: 'Conservatório de Teste', periodo: '2010–2014' }],
    tecnicas: ['Mistura em estéreo', 'Masterização'],
  },
  categorias: {
    instrumentais: {
      descricao: 'Instrumentais de teste.',
      faixas: [{ titulo: 'Primeira', genero: 'Trap', ano: 2026, ficheiro: 'audio/i1.mp3' }],
    },
    mistura: {
      descricao: 'Antes e depois da mistura.',
      faixas: [{ artista: 'Artista', titulo: 'Faixa', servico: 'Mistura e master', ano: 2026, antes: 'audio/m1-antes.mp3', depois: 'audio/m1-depois.mp3' }],
    },
    cinematografico: {
      descricao: 'Projetos de teste.',
      faixas: [{ titulo: 'Projeto', tipo: 'Curta-metragem', ano: 2026, ficheiro: 'audio/c1.mp3' }],
    },
  },
});

const comoJs = (conteudo) => `window.CONTEUDO = ${JSON.stringify(conteudo)};`;

module.exports = { base, comoJs };
