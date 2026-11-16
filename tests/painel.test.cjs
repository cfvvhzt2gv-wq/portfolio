// tests/painel.test.cjs
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { comPagina } = require('./apoio/navegador.cjs'), { base, comoJs } = require('./apoio/conteudo.cjs'), { faixasTeste, wav } = require('./apoio/sinal.cjs');
const abrir = (extra, fn) => comPagina({ conteudo: comoJs(base()), ficheiros: faixasTeste(), ...extra }, fn);
const perto = (v, esperado, tol) => assert.ok(Math.abs(v - esperado) <= tol, `${v} ≉ ${esperado} ± ${tol}`);
const faixa = (id) => `.faixa[data-faixa="${id}"]`, I = 'instrumentais-0', M = 'mistura-0';
const estado = (page, id) => page.getAttribute(faixa(id), 'data-estado');
const pos = async (page, id) => Number(await page.getAttribute(`${faixa(id)} .onda`, 'aria-valuenow'));
const valor = async (page, id, l) => (await page.textContent(`${faixa(id)} [data-leitura="${l}"] dd`)).trim();
const num = (t) => parseFloat(t.replace('−', '-').replace(',', '.'));
const tocar = async (page, id, ms = 0) => { await page.click(`${faixa(id)} .play`); await page.waitForTimeout(ms); };

test('tocar abre o painel só nessa faixa; tocar outra fecha o primeiro', () => abrir({}, async (page) => {
  await tocar(page, I, 400);
  assert.equal(await estado(page, I), 'a-tocar'); assert.equal(await page.locator(`${faixa(I)} .painel`).count(), 1);
  await tocar(page, M, 400);
  assert.deepEqual(await page.$$eval('.faixa', (f) => f.map((x) => x.dataset.estado)), ['parada', 'a-tocar', 'parada']);
  assert.equal(await page.locator('.painel').count(), 1); assert.equal(await page.locator(`${faixa(M)} .painel`).count(), 1);
}));
test('pausar mantém o painel e retomar continua', () => abrir({}, async (page) => {
  await tocar(page, I, 400); await tocar(page, I, 200);
  assert.equal(await estado(page, I), 'em-pausa'); assert.equal(await page.locator(`${faixa(I)} .painel`).count(), 1);
  const nome = await page.textContent(`${faixa(I)} .nome`);
  assert.equal(await page.getAttribute(`${faixa(I)} .play`, 'aria-label'), `Ouvir ${nome}`);
  await tocar(page, I, 300); assert.equal(await estado(page, I), 'a-tocar');
  assert.equal(await page.getAttribute(`${faixa(I)} .play`, 'aria-label'), `Pausar ${nome}`);
}));
test('nenhum MP3 é pedido antes do play; na mistura pedem-se as duas versões ao tocar', () => abrir({}, async (page, { pedidos }) => {
  await page.waitForTimeout(500); assert.deepEqual(pedidos.filter((u) => u.endsWith('.mp3')), []);
  await tocar(page, M, 600); const mp3 = pedidos.filter((u) => u.endsWith('.mp3'));
  assert.ok(mp3.some((u) => u.endsWith('m1-antes.mp3')) && mp3.some((u) => u.endsWith('m1-depois.mp3')));
}));
test('leituras: seno de −20 dB dá LUFS −20,0 e correlação +1,00, sem anúncios a cada atualização', () => abrir({}, async (page) => {
  await tocar(page, I, 1500);
  perto(num(await valor(page, I, 'lufs')), -20, 0.5); perto(num(await valor(page, I, 'pico')), -20, 0.5); assert.equal(await valor(page, I, 'correlacao'), '+1,00');
  assert.equal(await page.locator('.leituras [aria-live]').count(), 0);
  assert.equal(await page.locator(`${faixa(I)} canvas[aria-hidden="true"]`).count(), 3); assert.equal(await page.locator(`${faixa(I)} canvas:not([aria-hidden])`).count(), 0);
}));
test('Antes/Depois: mantém a posição, continua a tocar, muda o LUFS em 12 dB e reinicia o pico', () => abrir({}, async (page) => {
  await tocar(page, M, 1500);
  assert.equal(await page.getAttribute(`${faixa(M)} [data-versao="depois"]`, 'aria-pressed'), 'true');
  const depois = num(await valor(page, M, 'lufs')), p1 = await pos(page, M);
  await page.click(`${faixa(M)} [data-versao="antes"]`); const p2 = await pos(page, M);
  assert.ok(Math.abs(p2 - p1) < 0.3); await page.waitForTimeout(1200);
  assert.equal(await estado(page, M), 'a-tocar'); assert.ok(await pos(page, M) > p2 + 0.8);
  perto(num(await valor(page, M, 'lufs')), depois - 12, 1); perto(num(await valor(page, M, 'pico')), -32, 0.5);
}));
test('escolher «Antes» com a faixa parada: ao tocar, começa nessa versão', () => abrir({}, async (page) => {
  await page.click(`${faixa(M)} [data-versao="antes"]`);
  assert.equal(await estado(page, M), 'parada'); assert.equal(await page.getAttribute(`${faixa(M)} [data-versao="antes"]`, 'aria-pressed'), 'true');
  await tocar(page, M, 1200);
  assert.equal(await page.getAttribute(`${faixa(M)} [data-versao="antes"]`, 'aria-pressed'), 'true'); perto(num(await valor(page, M, 'pico')), -32, 0.5);
}));
test('clicar a meio da forma de onda põe a faixa a meio', () => abrir({}, async (page) => {
  await tocar(page, I, 400);
  const c = await page.locator(`${faixa(I)} .onda`).boundingBox(); await page.mouse.click(c.x + c.width / 2, c.y + c.height / 2); await page.waitForTimeout(100);
  perto(await pos(page, I), 3, 0.5); assert.equal(await estado(page, I), 'a-tocar');
}));
test('teclado na forma de onda: setas, Home e End', () => abrir({}, async (page) => {
  await tocar(page, I, 400); await page.focus(`${faixa(I)} .onda`);
  const p0 = await pos(page, I); await page.keyboard.press('ArrowRight'); perto((await pos(page, I)) - p0, 1, 0.4);
  await page.keyboard.press('Home'); assert.ok(await pos(page, I) < 0.6);
}));
test('Review Focus 4: End termina a faixa em ordem e fecha o painel', () => abrir({}, async (page, { erros }) => {
  await tocar(page, I, 400); await page.focus(`${faixa(I)} .onda`); await page.keyboard.press('End'); await page.waitForTimeout(800);
  assert.equal(await estado(page, I), 'parada'); assert.equal(await page.locator('.painel').count(), 0);
  assert.equal((await page.textContent(`${faixa(I)} .tempo`)).trim(), '0:06'); assert.deepEqual(erros, []);
  await tocar(page, I, 400); const c = await page.locator(`${faixa(I)} .onda`).boundingBox(); await page.mouse.click(c.x + c.width - 1, c.y + 10); await page.waitForTimeout(800);
  assert.equal(await estado(page, I), 'parada'); assert.deepEqual(erros, []);
}));
test('ficheiro inexistente: «Indisponível», sem afetar as outras', () => {
  const c = base(); c.categorias.instrumentais.faixas.push({ titulo: 'Em falta', ficheiro: 'audio/nao-existe.mp3' });
  return abrir({ conteudo: comoJs(c) }, async (page) => {
    await tocar(page, 'instrumentais-1', 600);
    assert.equal(await estado(page, 'instrumentais-1'), 'indisponivel'); assert.equal((await page.textContent(`${faixa('instrumentais-1')} .tempo`)).trim(), 'Indisponível');
    assert.ok(await page.isDisabled(`${faixa('instrumentais-1')} .play`)); assert.equal(await page.locator('.painel').count(), 0);
    await tocar(page, I, 400); assert.equal(await estado(page, I), 'a-tocar');
  });
});
test('sem onda.json a faixa toca e a linha de progresso muda a posição', () => abrir({ ficheiros: faixasTeste({ semOnda: true }) }, async (page) => {
  assert.equal((await page.textContent(`${faixa(I)} .tempo`)).trim(), '—:—');
  await tocar(page, I, 400); assert.equal(await estado(page, I), 'a-tocar');
  const c = await page.locator(`${faixa(I)} .onda`).boundingBox(); await page.mouse.click(c.x + c.width / 4, c.y + c.height / 2); await page.waitForTimeout(100);
  perto(await pos(page, I), 1.5, 0.5); assert.match((await page.textContent(`${faixa(I)} .tempo`)).trim(), /^0:0\d \/ 0:06$/);
}));
test('Review Focus 3: onda.json inválido é tratado como em falta', () => abrir({ ficheiros: { ...faixasTeste(), '/audio/i1.onda.json': '{"duracao":"x"}', '/audio/c1.onda.json': '{' } }, async (page, { erros }) => {
  assert.equal((await page.textContent(`${faixa(I)} .tempo`)).trim(), '—:—');
  await tocar(page, I, 400); assert.equal(await estado(page, I), 'a-tocar'); await tocar(page, 'cinematografico-0', 400); assert.equal(await estado(page, 'cinematografico-0'), 'a-tocar');
  assert.deepEqual(erros, []);
}));
test('movimento reduzido: sem espectro nem campo estéreo, com leituras', () => abrir({ movimentoReduzido: true }, async (page) => {
  await tocar(page, I, 1500);
  assert.equal(await page.locator('figure.inst').count(), 0); assert.notEqual(await valor(page, I, 'lufs'), '—');
}));
test('Review Focus 2: dois cliques no mesmo instante — só toca a última, sem erros', () => abrir({}, async (page, { erros }) => {
  await page.evaluate(() => { document.querySelector('[data-faixa="instrumentais-0"] .play').click(); document.querySelector('[data-faixa="mistura-0"] .play').click(); });
  await page.waitForTimeout(800);
  assert.deepEqual(await page.$$eval('.faixa', (f) => f.map((x) => x.dataset.estado)), ['parada', 'a-tocar', 'parada']); assert.deepEqual(erros, []);
}));
test('abrir o index.html do disco usa o modo simples', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-')), raiz = path.join(__dirname, '..');
  for (const f of ['index.html', 'estilo.css', 'js', 'fontes']) fs.cpSync(path.join(raiz, f), path.join(dir, f), { recursive: true });
  const c = base(); c.categorias.instrumentais.faixas[0].ficheiro = 'audio/i1.wav';
  fs.mkdirSync(path.join(dir, 'audio')); fs.writeFileSync(path.join(dir, 'audio/i1.wav'), wav({ segundos: 6 })); fs.writeFileSync(path.join(dir, 'conteudo.js'), comoJs(c));
  await comPagina({ ficheiro: path.join(dir, 'index.html') }, async (page) => {
    await tocar(page, I, 700); assert.equal(await estado(page, I), 'a-tocar');
    assert.equal(await page.locator('.instrumentos, .leituras').count(), 0); assert.equal(await page.locator(`${faixa(I)} .onda`).count(), 1); assert.ok(await pos(page, I) > 0.3);
  });
});
test('Review Focus 5: título longo, 390 px e rotação com o painel aberto, sem deslocação horizontal', () => {
  const c = base(); c.categorias.instrumentais.faixas[0].titulo = 'A'.repeat(80);
  return abrir({ conteudo: comoJs(c), largura: 390, altura: 800 }, async (page) => {
    const sobra = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(await sobra() <= 0); await tocar(page, I, 600); assert.ok(await sobra() <= 0);
    assert.equal(await page.$eval(`${faixa(I)} .onda`, (e) => getComputedStyle(e).touchAction), 'pan-y');
    await page.setViewportSize({ width: 600, height: 800 }); await page.waitForTimeout(300); assert.ok(await sobra() <= 0);
    const [w, cw] = await page.$eval(`${faixa(I)} .onda`, (e) => [e.getBoundingClientRect().width, e.querySelector('canvas').width]); perto(cw, w, 1);
  });
});
// Entrada de toque: eventos de ponteiro sintéticos com pointerType 'touch' (o Playwright não emite ponteiros de toque que o Chromium
// trate como pan-y; os eventos sintéticos exercitam exatamente os mesmos tratadores).
const toque = (page, id, tipo, fx, extra = {}) => page.evaluate(([sel, tipo, fx, extra]) => {
  const el = document.querySelector(sel), r = el.getBoundingClientRect();
  el.dispatchEvent(new PointerEvent(tipo, { pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0, bubbles: true, cancelable: true,
    clientX: r.left + r.width * fx + (extra.dx || 0), clientY: r.top + r.height / 2 + (extra.dy || 0) }));
}, [`${faixa(id)} .onda`, tipo, fx, extra]);
test('toque: pointerdown seguido de pointercancel (deslizar na vertical) não mexe na posição nem pausa', () => abrir({}, async (page, { erros }) => {
  await tocar(page, I, 1000); const antes = await pos(page, I);
  await toque(page, I, 'pointerdown', 0.8); await page.waitForTimeout(100);
  await toque(page, I, 'pointermove', 0.8, { dy: 30 }); await toque(page, I, 'pointercancel', 0.8, { dy: 30 }); await page.waitForTimeout(400);
  const depois = await pos(page, I);
  assert.ok(depois >= antes && depois - antes < 1.2, `a posição saltou: ${antes} → ${depois}`);
  assert.equal(await estado(page, I), 'a-tocar'); assert.deepEqual(erros, []);
}));
test('toque: um toque (down + up) a um quarto da largura procura aí', () => abrir({}, async (page) => {
  await tocar(page, I, 400);
  await toque(page, I, 'pointerdown', 0.25); await toque(page, I, 'pointerup', 0.25); await page.waitForTimeout(150);
  perto(await pos(page, I), 1.5, 0.5); assert.equal(await estado(page, I), 'a-tocar');
}));
test('toque: arrastar na horizontal pausa e procura; ao largar retoma', () => abrir({}, async (page) => {
  await tocar(page, I, 400);
  await toque(page, I, 'pointerdown', 0.25); await toque(page, I, 'pointermove', 0.75, { dy: 2 }); await toque(page, I, 'pointerup', 0.75); await page.waitForTimeout(150);
  perto(await pos(page, I), 4.5, 0.5); assert.equal(await estado(page, I), 'a-tocar');
}));
test('alvos de toque: a forma de onda mede pelo menos 44 × 44 px, a 1280 e a 390 px', async () => {
  for (const largura of [1280, 390]) {
    const r = await abrir({ largura }, async (page) => { await tocar(page, I, 300); const b = await page.locator(`${faixa(I)} .onda`).boundingBox(); return [b.width, b.height]; });
    assert.ok(r[0] >= 44 && r[1] >= 44, `${largura} px: ${r}`);
  }
});
