// tests/instrumentos.test.cjs
const test = require('node:test'), assert = require('node:assert/strict');
const { comPagina } = require('./apoio/navegador.cjs');
const perto = (v, esperado, tol) => assert.ok(Math.abs(v - esperado) <= tol, `${v} ≉ ${esperado} ± ${tol}`);
const html = (w, h) => `<!doctype html><meta charset=utf-8><style>canvas{display:block;width:${w}px;height:${h}px}</style><canvas id=c></canvas><script src="js/instrumentos.js"></script>`;
// corre `corpo` no browser (com I = Portfolio.Instrumentos e t = Tela) e devolve os pixéis do canvas
const capturar = (w, h, corpo) => comPagina({ ficheiros: { '/harness.html': html(w, h) }, pagina: '/harness.html' }, (page) =>
  page.evaluate(`(() => { const I = Portfolio.Instrumentos, t = I.criarTela(document.getElementById('c')); t.ajustar(); ${corpo}; const d = t.ctx.getImageData(0, 0, t.canvas.width, t.canvas.height); return { w: d.width, h: d.height, px: Array.from(d.data) }; })()`));
const at = (img, x, y) => img.px.slice((y * img.w + x) * 4, (y * img.w + x) * 4 + 4);       // [r, g, b, a]
const escuro = (p) => p[3] > 200 && p[0] < 40;
const ponto = (p) => p[3] > 100 && p[0] < 40;
const conta = (img, x0, x1, y0, y1, f) => { let n = 0; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (f(at(img, x, y))) n++; return n; };

test('criarTela.ajustar: true em canvases normais, false em canvases minúsculos', async () => {
  const r = await comPagina({ ficheiros: { '/harness.html': html(400, 56) + '<canvas id=p style="width:10px;height:10px"></canvas>' }, pagina: '/harness.html' }, (page) =>
    page.evaluate(() => { const I = Portfolio.Instrumentos; return [I.criarTela(document.getElementById('c')).ajustar(), I.criarTela(document.getElementById('p')).ajustar()]; }));
  assert.deepEqual(r, [true, false]);
});
test('onda: tocado a preto, resto a cinzento, cursor na posição', async () => {
  const img = await capturar(400, 56, 'I.desenharOnda(t, Array(800).fill(255), 0.5)');
  assert.ok(escuro(at(img, 100, 28)));
  const r = at(img, 300, 28)[0]; assert.ok(r > 180 && r < 215, `cinzento por tocar: ${r}`);
  assert.ok(escuro(at(img, 200, 2)));
});
test('onda: barras de 2 px com 1 px de intervalo', async () => {
  const img = await capturar(400, 56, 'I.desenharOnda(t, Array(800).fill(255), 0)');
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((x) => at(img, x, 28)[3] > 0), [true, true, false, true, true, false]);
});
test('onda sem picos: só a linha de progresso fina', async () => {
  const img = await capturar(400, 56, 'I.desenharOnda(t, null, 0.25)');
  assert.ok(escuro(at(img, 50, 28)));
  const p = at(img, 300, 28); assert.ok(p[3] > 0 && p[0] > 215 && p[0] < 240);
  assert.equal(at(img, 50, 10)[3], 0);
});
test('espectro: a altura é proporcional ao valor de cada banda', async () => {
  const img = await capturar(400, 208, 'const e = { val: new Float32Array(44), pico: new Float32Array(44) }; e.val[10] = 1; e.val[20] = 0.5; I.desenharEspectro(t, e)');
  const alt = Array.from({ length: img.w }, (_, x) => conta(img, x, x, 0, img.h - 1, escuro));
  const altos = [...new Set(alt.filter((n) => n >= 20))].sort((a, b) => b - a);
  assert.equal(altos.length, 2); perto(altos[1] / altos[0], 0.5, 0.05);
});
test('estéreo: som ao centro desenha uma linha vertical', async () => {
  const img = await capturar(208, 208, 'const L = Float32Array.from({ length: 882 }, (_, i) => 0.5 * Math.sin(i / 8)); I.desenharEstereo(t, I.criarEstereo(), L, L, 44100)');
  assert.ok(conta(img, 102, 106, 40, 176, ponto) > 20);
  assert.equal(conta(img, 120, 190, 100, 116, ponto), 0);
});
test('estéreo: som em oposição de fase abre para os lados', async () => {
  const img = await capturar(208, 208, 'const L = Float32Array.from({ length: 882 }, (_, i) => 0.5 * Math.sin(i / 8)); I.desenharEstereo(t, I.criarEstereo(), L, L.map((v) => -v), 44100)');
  assert.ok(conta(img, 130, 180, 104, 112, ponto) > 10);
  assert.equal(conta(img, 102, 106, 30, 90, ponto), 0);
});
test('estéreo sem amostras só desenha a moldura', async () => {
  const img = await capturar(208, 208, 'I.desenharEstereo(t, I.criarEstereo(), null, null, 44100)');
  assert.equal(conta(img, 0, 207, 0, 207, ponto), 0);
});

// ---- Além dos oito do briefing: fixam o que o Step 3 e a interface pedem e aqueles testes não tocam ----

test('o módulo carrega em Node, sem DOM, e exporta só a interface', () => {
  assert.deepEqual(Object.keys(require('../js/instrumentos.js')).sort(), ['criarEstereo', 'criarTela', 'desenharEspectro', 'desenharEstereo', 'desenharOnda']);
});
test('criarTela.ajustar: usa o devicePixelRatio até ao máximo de 2 e repõe a transformação', async () => {
  const r = await comPagina({ ficheiros: { '/harness.html': html(400, 56) }, pagina: '/harness.html' }, (page) =>
    page.evaluate(() => {
      const c = document.getElementById('c'), t = Portfolio.Instrumentos.criarTela(c);
      return [1, 1.5, 3].map((dpr) => { window.devicePixelRatio = dpr; t.ajustar(); return [c.width, c.height, t.w, t.h, t.ctx.getTransform().a]; });
    }));
  assert.deepEqual(r, [[400, 56, 400, 56, 1], [600, 84, 400, 56, 1.5], [800, 112, 400, 56, 2]]);
});
test('onda: a altura da barra é (v/255)^0,7 do espaço útil, com mínimo de 1 px', async () => {
  const coluna = async (v, f) => conta(await capturar(400, 56, `I.desenharOnda(t, Array(800).fill(${v}), 0)`), 1, 1, 0, 55, f);
  perto(await coluna(128, (p) => p[3] > 127), (128 / 255) ** 0.7 * (56 - 4), 1.5);      // ≈ 32 px
  const minimo = await coluna(0, (p) => p[3] > 0); assert.ok(minimo >= 1 && minimo <= 2, `barra sem som: ${minimo} linhas`);
});
test('as cores vêm das variáveis CSS --ink, --muted, --line e --ghost', async () => {
  const pagina = '<!doctype html><meta charset=utf-8><style>:root{--ink:#ff0000;--muted:#0000ff;--line:#00ff00;--ghost:#ffff00}canvas{display:block;width:400px;height:208px}</style>'
    + '<canvas id=a></canvas><canvas id=b></canvas><script src="js/instrumentos.js"></script>';
  const r = await comPagina({ ficheiros: { '/harness.html': pagina }, pagina: '/harness.html' }, (page) => page.evaluate(`(() => {
    const I = Portfolio.Instrumentos, a = I.criarTela(document.getElementById('a')), b = I.criarTela(document.getElementById('b')), px = (t, x, y) => Array.from(t.ctx.getImageData(x, y, 1, 1).data);
    a.ajustar(); b.ajustar(); I.desenharOnda(a, Array(800).fill(255), 0.5);
    const e = { val: new Float32Array(44), pico: new Float32Array(44) }; e.pico[10] = 0.5; I.desenharEspectro(b, e);
    return { tocado: px(a, 100, 104), porTocar: px(a, 300, 104), base: px(b, 0, 188), marcaDePico: px(b, 92, 95) };
  })()`));
  assert.deepEqual(r, { tocado: [255, 0, 0, 255], porTocar: [255, 255, 0, 255], base: [0, 255, 0, 255], marcaDePico: [0, 0, 255, 255] });
});
test('espectro: marcas em 100, 1k e 10k Hz com rótulo, e «Hz» só quando há largura', async () => {
  const vazio = 'I.desenharEspectro(t, { val: new Float32Array(44), pico: new Float32Array(44) })', visivel = (p) => p[3] > 0;
  const estreito = await capturar(400, 208, vazio);                                      // barras de 8 px com 1 px de intervalo: 395 px de largura
  for (const x of [72, 219, 365]) {
    assert.equal(conta(estreito, x, x, 189, 192, visivel), 4, `marca em x = ${x}`);
    assert.ok(conta(estreito, x - 8, x + 8, 194, 207, visivel) > 3, `rótulo em x = ${x}`);
  }
  assert.equal(conta(estreito, 150, 160, 189, 192, visivel), 0);
  assert.equal(conta(estreito, 380, 395, 194, 207, visivel), 0, '«Hz» numa tela estreita');
  const largo = await capturar(540, 208, vazio);                                         // barras de 10 px com 2 px de intervalo: 526 px de largura
  assert.ok(conta(largo, 508, 526, 194, 207, visivel) > 3, 'sem «Hz» numa tela larga');
});
test('estéreo: a moldura tem o losango, os eixos e as letras M, L e R', async () => {
  const img = await capturar(208, 208, 'I.desenharEstereo(t, I.criarEstereo(), null, null, 44100)');
  const desenhado = (x, y) => conta(img, x - 1, x + 1, y - 1, y + 1, (p) => p[3] > 0) > 0;
  assert.ok([[148, 64], [60, 64], [148, 152], [60, 152]].every(([x, y]) => desenhado(x, y)), 'contorno do losango');
  assert.ok(desenhado(104, 60) && desenhado(60, 108), 'eixos');
  for (const [letra, x, y] of [['M', 104, 11], ['L', 50, 54], ['R', 158, 54]]) assert.ok(conta(img, x - 6, x + 6, y - 6, y + 6, (p) => p[3] > 0) > 5, `letra ${letra}`);
});
test('estéreo: ampliado 1,5× e limitado ao losango', async () => {
  // amplitude 0,5 ao centro: ampliada chega a y ≈ 42; sem ampliação ficaria em y ≈ 64
  const centro = await capturar(208, 208, 'const L = Float32Array.from({ length: 882 }, (_, i) => 0.5 * Math.sin(i / 8)); I.desenharEstereo(t, I.criarEstereo(), L, L, 44100)');
  assert.ok(conta(centro, 100, 108, 40, 58, ponto) > 0, 'não chega a y ≈ 42');
  assert.equal(conta(centro, 100, 108, 0, 38, ponto), 0);
  // oposição de fase a fundo: sem o limite saía a 132 px do centro; os vértices do losango estão a 88 px (x = 16 e x = 192)
  const largo = await capturar(208, 208, 'const L = Float32Array.from({ length: 882 }, (_, i) => Math.sin(i / 8)); I.desenharEstereo(t, I.criarEstereo(), L, L.map((v) => -v), 44100)');
  assert.equal(conta(largo, 0, 13, 0, 207, ponto), 0);
  assert.equal(conta(largo, 195, 207, 0, 207, ponto), 0);
  assert.ok(conta(largo, 186, 193, 100, 116, ponto) > 0, 'não chega ao vértice');
});
test('estéreo: só conta os últimos 20 ms, que estão no fim dos arrays', async () => {
  // 40 ms: os primeiros 20 ms em oposição de fase (abertos), os últimos 20 ms ao centro
  const img = await capturar(208, 208, `const L = Float32Array.from({ length: 1764 }, (_, i) => 0.5 * Math.sin(i / 8)), R = L.map((v, i) => (i < 882 ? -v : v));
    I.desenharEstereo(t, I.criarEstereo(), L, R, 44100)`);
  assert.ok(conta(img, 102, 106, 40, 176, ponto) > 20);
  assert.equal(conta(img, 130, 180, 104, 112, ponto), 0);
});
test('estéreo: o rasto fica alguns quadros, esmorece e some quando deixa de haver amostras', async () => {
  // quadro 0: som ao centro (linha vertical); depois, n quadros em oposição de fase (linha horizontal) ou sem amostras
  const quadros = (n, ultimo) => capturar(208, 208, `const C = Float32Array.from({ length: 882 }, (_, i) => 0.5 * Math.sin(i / 8)), O = C.map((v) => -v), e = I.criarEstereo();
    I.desenharEstereo(t, e, C, C, 44100); for (let k = 0; k < ${n}; k++) I.desenharEstereo(t, e, ${ultimo})`);
  const forte = (p) => p[3] > 40 && p[0] < 40;                                   // por cima da linha vertical, longe da horizontal
  assert.ok(conta(await quadros(1, 'C, O, 44100'), 102, 106, 60, 75, forte) > 3, 'o rasto não ficou');
  assert.equal(conta(await quadros(20, 'C, O, 44100'), 102, 106, 60, 75, forte), 0);
  assert.equal(conta(await quadros(1, 'null, null, 44100'), 0, 207, 0, 207, ponto), 0);   // sem amostras: só a moldura
});
test('estéreo: sem amostras apaga o rasto todo, também com devicePixelRatio abaixo de 1', async () => {
  // zoom a 50 % num ecrã normal: o rasto guarda a transformação do quadro anterior (scale 0,5) e o `null` tem de o apagar por inteiro
  // o `capturar` não serve: chama `ajustar()` antes de o corpo mudar o devicePixelRatio
  const [antes, depois] = await comPagina({ ficheiros: { '/harness.html': html(208, 208) }, pagina: '/harness.html' }, (page) =>
    page.evaluate(() => {
      window.devicePixelRatio = 0.5;
      const I = Portfolio.Instrumentos, t = I.criarTela(document.getElementById('c')), e = I.criarEstereo();
      t.ajustar();
      const C = Float32Array.from({ length: 882 }, (_, i) => 0.5 * Math.sin(i / 8)), O = C.map((v) => -v);
      const pixeis = () => { const d = t.ctx.getImageData(0, 0, t.canvas.width, t.canvas.height); return { w: d.width, h: d.height, px: Array.from(d.data) }; };
      for (let k = 0; k < 5; k++) I.desenharEstereo(t, e, C, O, 44100);       // oposição de fase: linha horizontal
      for (let k = 0; k < 5; k++) I.desenharEstereo(t, e, C, C, 44100);       // ao centro: linha vertical
      const antes = pixeis();
      I.desenharEstereo(t, e, null, null, 44100);
      return [antes, pixeis()];
    }));
  const fortes = (img) => conta(img, 0, img.w - 1, 0, img.h - 1, ponto);
  assert.equal(antes.w, 104, 'o canvas devia ter 208 × 0,5 pixéis');
  assert.ok(fortes(antes) > 20, 'sem rasto antes de apagar');
  assert.equal(fortes(depois), 0);
});
