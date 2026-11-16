// tests/pagina.test.cjs
const test = require('node:test'), assert = require('node:assert/strict');
const P = require('../js/pagina.js'), { base, comoJs } = require('./apoio/conteudo.cjs'), { comPagina } = require('./apoio/navegador.cjs');
const textos = (page, sel) => page.$$eval(sel, (els) => els.map((e) => e.textContent.trim()));

test('preparar: três categorias pela ordem certa, numeradas, com contadores', () => {
  const c = base(); c.categorias.instrumentais.faixas.push({ titulo: 'B', ficheiro: 'audio/b.mp3' }, { titulo: 'C', ficheiro: 'audio/c.mp3' });
  assert.deepEqual(P.preparar(c).categorias.map((x) => [x.id, x.numero, x.contador]),
    [['instrumentais', '01', '3 faixas'], ['mistura', '02', '1 trabalho'], ['cinematografico', '03', '1 projeto']]);
});
test('preparar: categoria sem faixas desaparece e a numeração acompanha', () => {
  const c = base(); c.categorias.mistura.faixas = []; delete c.categorias.cinematografico;
  assert.deepEqual(P.preparar(c).categorias.map((x) => [x.id, x.numero]), [['instrumentais', '01']]);
});
test('preparar: os detalhes juntam só os campos presentes', () => {
  const f = (cat, faixa) => P.preparar({ nome: 'N', categorias: { [cat]: { faixas: [faixa] } } }).categorias[0].faixas[0].detalhes;
  assert.equal(f('instrumentais', { titulo: 'T', genero: 'Trap', ano: 2026, ficheiro: 'a.mp3' }), 'Trap · 2026');
  assert.equal(f('instrumentais', { titulo: 'T', ano: 2026, ficheiro: 'a.mp3' }), '2026');
  assert.equal(f('instrumentais', { titulo: 'T', ficheiro: 'a.mp3' }), '');
  assert.equal(f('mistura', { titulo: 'T', servico: 'Mistura', ano: 2025, antes: 'a.mp3', depois: 'b.mp3' }), 'Mistura · 2025');
  assert.equal(f('cinematografico', { titulo: 'T', tipo: 'Curta', ficheiro: 'a.mp3' }), 'Curta');
});
test('preparar: título e ficheiros da mistura', () => {
  const m = P.preparar({ nome: 'N', categorias: { mistura: { faixas: [{ artista: 'Ana', titulo: 'Faixa', antes: 'a.mp3', depois: 'b.mp3' }, { titulo: 'Só', antes: 'c.mp3', depois: 'd.mp3' }] } } });
  assert.deepEqual(m.categorias[0].faixas.map((f) => [f.id, f.titulo, f.url, f.urlAntes]), [['mistura-0', 'Ana — Faixa', 'b.mp3', 'a.mp3'], ['mistura-1', 'Só', 'd.mp3', 'c.mp3']]);
});
test('preparar: «Sobre» esconde listas vazias e, sem nada, desaparece', () => {
  assert.deepEqual(P.preparar({ nome: 'N', sobre: { daws: ['X'], formacao: [], tecnicas: [] } }).sobre, { daws: ['X'], formacao: [], tecnicas: [] });
  assert.equal(P.preparar({ nome: 'N', sobre: { daws: [], formacao: [], tecnicas: [] } }).sobre, null);
  assert.equal(P.preparar({ nome: 'N' }).sobre, null);
});
test('preparar: conteúdo mínimo não rebenta nem deixa «undefined»', () => {
  const m = P.preparar({ nome: 'N' }); assert.deepEqual(m.categorias, []); assert.equal(m.email, null); assert.deepEqual(m.redes, []);
  assert.doesNotMatch(JSON.stringify(P.preparar({ nome: 'N', categorias: { instrumentais: { faixas: [{ titulo: 'T', ficheiro: 'a.mp3' }] } } })), /undefined/);
});

test('página: categorias, índice, contadores e título', () => comPagina({ conteudo: comoJs(base()) }, async (page) => {
  assert.deepEqual(await page.$$eval('section.categoria', (s) => s.map((e) => e.id)), ['instrumentais', 'mistura', 'cinematografico']);
  assert.deepEqual(await textos(page, '#trabalhos .item-indice .contador'), ['1 faixa', '1 trabalho', '1 projeto']);
  assert.deepEqual(await textos(page, 'section.categoria h2'), ['Instrumentais', 'Mistura e masterização', 'Áudio cinematográfico']);
  assert.equal(await page.title(), 'Ana Teste — Produção musical');
  assert.equal(await page.getAttribute('html', 'lang'), 'pt-PT'); assert.ok(await page.getAttribute('meta[name="description"]', 'content'));
}));
test('página: uma categoria sem faixas não aparece, nem no índice, e a numeração acompanha', () => {
  const c = base(); c.categorias.mistura.faixas = [];
  return comPagina({ conteudo: comoJs(c) }, async (page) => {
    assert.deepEqual(await page.$$eval('section.categoria', (s) => s.map((e) => e.id)), ['instrumentais', 'cinematografico']);
    assert.deepEqual(await textos(page, '#trabalhos .item-indice .num'), ['01', '02']); assert.equal(await page.locator('#mistura, a[href="#mistura"]').count(), 0);
  });
});
test('página: a mistura tem Antes/Depois com «Depois» ativo', () => comPagina({ conteudo: comoJs(base()) }, async (page) => {
  assert.equal(await page.locator('.antes-depois').count(), 1);
  assert.equal(await page.getAttribute('[data-versao="depois"]', 'aria-pressed'), 'true');
  assert.equal(await page.getAttribute('[data-versao="antes"]', 'aria-pressed'), 'false');
}));
test('página: campos em falta são omitidos, sem «undefined» nem separadores soltos', () => {
  const c = base(); c.categorias.instrumentais.faixas = [{ titulo: 'Só título', ficheiro: 'audio/i1.mp3' }, { titulo: 'Com ano', ano: 2026, ficheiro: 'audio/i1.mp3' }];
  delete c.local; delete c.contacto.redes;
  return comPagina({ conteudo: comoJs(c) }, async (page) => {
    assert.deepEqual(await textos(page, '#instrumentais .detalhes'), ['2026']);
    assert.equal(await page.locator('.local, .redes').count(), 0);
    assert.doesNotMatch(await page.innerText('body'), /undefined|NaN|· *$/m);
  });
});
test('página: «Sobre» tem DAWs, Formação e Técnicas, por esta ordem', () => comPagina({ conteudo: comoJs(base()) }, async (page) => {
  assert.deepEqual(await page.$$eval('#sobre [data-topico]', (e) => e.map((x) => x.dataset.topico)), ['daws', 'formacao', 'tecnicas']);
  assert.deepEqual(await textos(page, '#sobre dt'), ['DAWs', 'Formação', 'Técnicas']);
}));
test('página: contacto', () => comPagina({ conteudo: comoJs(base()) }, async (page) => {
  assert.equal(await page.getAttribute('footer a.email', 'href'), 'mailto:ana@exemplo.pt');
  assert.equal(await page.getAttribute('.redes a', 'target'), '_blank'); assert.equal(await page.getAttribute('.redes a', 'rel'), 'noopener noreferrer');
  assert.match(await page.textContent('.direitos'), new RegExp(`© ${new Date().getFullYear()} Ana Teste`));
}));
test('página: as três famílias carregam de fontes/, sem pedidos externos', () => comPagina({ conteudo: comoJs(base()) }, async (page, { externos }) => {
  await page.evaluate(() => document.fonts.ready);
  const fam = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')));
  for (const f of ['Instrument Serif', 'Inter', 'IBM Plex Mono']) assert.ok(fam.includes(f), `${f} não carregou (${fam})`);
  assert.deepEqual(externos, []);
}));
test('Review Focus 1: texto do conteúdo nunca vira HTML', () => {
  const c = base(), mau = '<b>x</b> & "y"'; c.nome = 'A<i>B</i>'; c.categorias.instrumentais.faixas[0].titulo = mau; c.contacto.redes[0].nome = mau;
  return comPagina({ conteudo: comoJs(c) }, async (page) => {
    assert.equal(await page.textContent('#instrumentais .nome'), mau); assert.equal(await page.textContent('.nome-site'), 'A<i>B</i>');
    assert.equal(await page.title(), 'A<i>B</i> — Produção musical');
    assert.equal(await page.locator('.faixa b, .cabecalho i, .redes b').count(), 0);
  });
});
test('decidirModo: file:, sem Web Audio e iOS antigo → simples', () => {
  const ok = { protocolo: 'https:', temWebAudio: true, ios: false, temAudioSession: false };
  assert.equal(P.decidirModo(ok), 'completo');
  assert.equal(P.decidirModo({ ...ok, protocolo: 'file:' }), 'simples');
  assert.equal(P.decidirModo({ ...ok, temWebAudio: false }), 'simples');
  assert.equal(P.decidirModo({ ...ok, ios: true, temAudioSession: false }), 'simples');
  assert.equal(P.decidirModo({ ...ok, ios: true, temAudioSession: true }), 'completo');
});
test('validarOnda e ondaUrl', () => {
  const picos = Array(800).fill(10);
  assert.deepEqual(P.validarOnda({ duracao: 6, picos }), { duracao: 6, picos });
  for (const mau of [null, '{', { duracao: 'x', picos }, { duracao: 0, picos }, { duracao: 6, picos: picos.slice(1) }, { duracao: 6, picos: [...picos.slice(1), 256] }, { duracao: 6, picos: [...picos.slice(1), 1.5] }]) assert.equal(P.validarOnda(mau), null);
  assert.equal(P.ondaUrl('audio/a.mp3'), 'audio/a.onda.json'); assert.equal(P.ondaUrl('x/B.MP3'), 'x/B.onda.json');
});
test('página: todos os links e botões visíveis medem pelo menos 44 × 44 px, a 1280 e a 390 px', async () => {
  const c = base(); c.nome = 'Zé'; c.contacto.redes.push({ nome: 'X', url: 'https://exemplo.pt/x' });   // nomes curtos: o alvo não pode encolher com o texto
  const pequenos = [];
  for (const largura of [1280, 390]) {
    const alvos = await comPagina({ conteudo: comoJs(c), largura }, (page) => page.$$eval('a, button, [role=slider], input', (els) => els
      .filter((e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden')
      .map((e) => { const r = e.getBoundingClientRect(); return { nome: e.getAttribute('aria-label') || e.textContent.trim(), w: r.width, h: r.height }; })));
    for (const nome of ['Zé', 'Sobre', 'X', 'Ouvir Primeira', 'Antes', 'Depois']) assert.ok(alvos.some((a) => a.nome === nome), `a ${largura} px, «${nome}» não foi medido`);
    pequenos.push(...alvos.filter((a) => a.w < 44 || a.h < 44).map((a) => `${largura} px: «${a.nome}» ${a.w.toFixed(1)} × ${a.h.toFixed(1)}`));
  }
  assert.deepEqual(pequenos, []);
});
test('R2: só se mostram links de redes com http(s); javascript: e endereços sem esquema ficam de fora', () => {
  const redes = [{ nome: 'Mau', url: 'javascript:alert(1)' }, { nome: 'Sem esquema', url: 'instagram.com/x' }, { nome: 'Bom', url: 'https://exemplo.pt/x' }, { nome: 'Antigo', url: 'HTTP://exemplo.pt' }];
  assert.deepEqual(P.preparar({ nome: 'N', contacto: { redes } }).redes.map((r) => r.nome), ['Bom', 'Antigo']);
  const c = base(); c.contacto.redes = redes.slice(0, 2);
  return comPagina({ conteudo: comoJs(c) }, async (page) => {
    assert.equal(await page.locator('.redes a').count(), 0); assert.equal(await page.locator('a[href^="javascript:"]').count(), 0); assert.equal(await page.locator('.redes').count(), 0);
  });
});
