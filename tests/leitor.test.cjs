// tests/leitor.test.cjs
const test = require('node:test'), assert = require('node:assert/strict');
const { comPagina } = require('./apoio/navegador.cjs'), { wav } = require('./apoio/sinal.cjs');
const perto = (v, esperado, tol) => assert.ok(Math.abs(v - esperado) <= tol, `${v} ≉ ${esperado} ± ${tol}`);
const harness = `<!doctype html><meta charset=utf-8><script src="js/leitor.js"></script><script>
  window.__rej = 0; addEventListener('unhandledrejection', () => window.__rej++);
  window.esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  window.picoDb = (l) => { const e = new Float32Array(Portfolio.Leitor.JANELA), d = new Float32Array(e.length); l.amostras(e, d);
    let m = 0; for (let i = e.length - 17640; i < e.length; i++) m = Math.max(m, Math.abs(e[i]), Math.abs(d[i])); return 20 * Math.log10(m); };
</script>`;
const ficheiros = { '/harness.html': harness, '/audio/a.mp3': wav({ segundos: 6, db: -20 }), '/audio/b.mp3': wav({ segundos: 6, db: -32 }), '/audio/curto.mp3': wav({ segundos: 2, db: -32 }) };
const noBrowser = (fn) => comPagina({ ficheiros, pagina: '/harness.html' }, (page) => page.evaluate(fn));

test('toca, pausa, retoma e para', async () => {
  const r = await noBrowser(async () => {
    const l = Portfolio.Leitor.criar({ analise: true }), s = {};
    s.comecou = await l.tocar({ url: 'audio/a.mp3' }); await esperar(600); s.p1 = l.posicao();
    l.pausar(); const p = l.posicao(); await esperar(400); s.parada = Math.abs(l.posicao() - p) < 0.02;
    await l.retomar(); await esperar(500); s.avanco = l.posicao() - p; l.parar(); s.fim = [l.aTocar(), l.posicao()];
    return s;
  });
  assert.equal(r.comecou, true); assert.ok(r.p1 > 0.3 && r.p1 < 1.1); assert.ok(r.parada); assert.ok(r.avanco > 0.3); assert.deepEqual(r.fim, [false, 0]);
});
test('procurar muda a posição; a duração é conhecida', async () => {
  const r = await noBrowser(async () => {
    const l = Portfolio.Leitor.criar({ analise: true }); await l.tocar({ url: 'audio/a.mp3' }); l.procurar(3); await esperar(300);
    return [l.posicao(), l.duracao()];
  });
  perto(r[0], 3.3, 0.4); perto(r[1], 6, 0.05);
});
test('análise: o seno de −20 dB lê-se nas amostras e o pico do espectro está nos 1000 Hz', async () => {
  const r = await noBrowser(async () => {
    const l = Portfolio.Leitor.criar({ analise: true }); await l.tocar({ url: 'audio/a.mp3' }); await esperar(1000);
    const bins = new Float32Array(Portfolio.Leitor.BINS), taxa = l.espectro(bins), k = bins.indexOf(Math.max(...bins));
    return { pico: picoDb(l), taxa: l.taxa, hz: k * taxa / (2 * bins.length), igual: taxa === l.taxa };
  });
  perto(r.pico, -20, 0.2); assert.ok(r.taxa >= 8000 && r.taxa <= 96000 && r.igual); perto(r.hz, 1000, 20);
});
test('Antes/Depois: mantém a posição, continua a tocar e muda o nível', async () => {
  const r = await noBrowser(async () => {
    const l = Portfolio.Leitor.criar({ analise: true }); await l.tocar({ url: 'audio/a.mp3', urlAntes: 'audio/b.mp3' }); await esperar(1000);
    const s = { inicial: l.versao(), depois: picoDb(l), p1: l.posicao() }; l.trocarVersao('antes'); s.p2 = l.posicao(); await esperar(800);
    s.antes = picoDb(l); s.versao = l.versao(); s.aTocar = l.aTocar(); l.trocarVersao('depois'); await esperar(800); s.volta = picoDb(l);
    return s;
  });
  assert.equal(r.inicial, 'depois'); assert.equal(r.versao, 'antes'); assert.ok(r.aTocar); assert.ok(Math.abs(r.p2 - r.p1) < 0.3);
  perto(r.depois, -20, 0.5); perto(r.antes, -32, 0.5); perto(r.volta, -20, 0.5);
});
test('tocar com a versão «antes» começa nessa versão', async () => {
  const r = await noBrowser(async () => {
    const l = Portfolio.Leitor.criar({ analise: true }); await l.tocar({ url: 'audio/a.mp3', urlAntes: 'audio/b.mp3' }, 'antes'); await esperar(900);
    return { versao: l.versao(), pico: picoDb(l) };
  });
  assert.equal(r.versao, 'antes'); perto(r.pico, -32, 0.5);
});
test('ficheiro inexistente: aoErro uma vez, tocar devolve false e o motor continua utilizável', async () => {
  const r = await noBrowser(async () => {
    const l = Portfolio.Leitor.criar({ analise: true }); let erros = 0; l.aoErro = () => erros++;
    const falhou = await l.tocar({ url: 'audio/nao-existe.mp3' }); await esperar(300); const depois = await l.tocar({ url: 'audio/a.mp3' });
    return { falhou, erros, depois, aTocar: l.aTocar() };
  });
  assert.deepEqual(r, { falhou: false, erros: 1, depois: true, aTocar: true });
});
test('mistura com uma versão em falta: aoErro e fica parada', async () => {
  const r = await noBrowser(async () => {
    const l = Portfolio.Leitor.criar({ analise: true }); let erros = 0; l.aoErro = () => erros++;
    await l.tocar({ url: 'audio/a.mp3', urlAntes: 'audio/nao-existe.mp3' }); await esperar(600);
    return { erros, aTocar: l.aTocar() };
  });
  assert.deepEqual(r, { erros: 1, aTocar: false });
});
test('Review Focus 2: duas chamadas seguidas a tocar — só a última toca, sem erros', async () => {
  const r = await noBrowser(async () => {
    const l = Portfolio.Leitor.criar({ analise: true }); let erros = 0; l.aoErro = () => erros++;
    const [a, b] = await Promise.all([l.tocar({ url: 'audio/a.mp3' }), l.tocar({ url: 'audio/b.mp3' })]); await esperar(800);
    l.pausar(); const x = l.tocar({ url: 'audio/a.mp3' }); l.pausar(); await x; await esperar(200);
    return { a, b, erros, rej: window.__rej };
  });
  assert.deepEqual([r.a, r.b, r.erros, r.rej], [false, true, 0, 0]);
});
test('Review Focus 4: procurar muito além do fim termina em ordem', async () => {
  const r = await noBrowser(async () => {
    const l = Portfolio.Leitor.criar({ analise: true }); let fins = 0, erros = 0; l.aoFim = () => fins++; l.aoErro = () => erros++;
    await l.tocar({ url: 'audio/a.mp3' }); l.procurar(1e9); await esperar(800);
    return { fins, erros, aTocar: l.aTocar(), pos: l.posicao() };
  });
  assert.deepEqual(r, { fins: 1, erros: 0, aTocar: false, pos: 0 });
});
test('sem análise (modo simples): toca, troca de versão e não mede', async () => {
  const r = await noBrowser(async () => {
    const l = Portfolio.Leitor.criar({ analise: false });
    await l.tocar({ url: 'audio/a.mp3', urlAntes: 'audio/b.mp3' }); await esperar(500); l.trocarVersao('antes'); await esperar(500);
    return { aTocar: l.aTocar(), pos: l.posicao(), taxa: l.taxa, amostras: l.amostras(new Float32Array(Portfolio.Leitor.JANELA), new Float32Array(Portfolio.Leitor.JANELA)) };
  });
  assert.ok(r.aTocar); assert.ok(r.pos > 0.7); assert.equal(r.taxa, 0); assert.equal(r.amostras, false);
});

// Comportamentos que os testes acima não fixavam. O motor não expõe os seus <audio>, por isso o espião (corre na página, antes de criar
// o motor) guarda cada elemento criado em window.__criados; comEspiao devolve também a lista de erros (consola e página) do comPagina.
const espiarAudio = () => {
  window.__criados = []; const Original = window.Audio;
  window.Audio = function (...args) { const el = new Original(...args); window.__criados.push(el); return el; };
};
const comEspiao = (fn) => comPagina({ ficheiros, pagina: '/harness.html' }, async (page, { erros }) => {
  await page.evaluate(espiarAudio);
  return { r: await page.evaluate(fn), erros };
});

test('só uma faixa toca: os elementos descartados ficam parados, sem src e sem erros (Review Focus 2)', async () => {
  const { r, erros } = await comEspiao(async () => {
    const criados = window.__criados, l = Portfolio.Leitor.criar({ analise: true }); let falhas = 0; l.aoErro = () => falhas++;
    await Promise.all([l.tocar({ url: 'audio/a.mp3' }), l.tocar({ url: 'audio/b.mp3' })]); await esperar(800);
    return { n: criados.length, aTocar: criados.map((el) => !el.paused), temSrc: criados.map((el) => el.hasAttribute('src')), falhas, rej: window.__rej };
  });
  assert.deepEqual(r, { n: 2, aTocar: [false, true], temSrc: [false, true], falhas: 0, rej: 0 }); assert.deepEqual(erros, []);
});
test('o fim da versão inativa mais curta não termina a faixa', async () => {
  const r = await noBrowser(async () => {
    const l = Portfolio.Leitor.criar({ analise: true }); let fins = 0; l.aoFim = () => fins++;
    await l.tocar({ url: 'audio/a.mp3', urlAntes: 'audio/curto.mp3' }); await esperar(2400);
    return { fins, aTocar: l.aTocar(), pos: l.posicao() };
  });
  assert.equal(r.fins, 0); assert.ok(r.aTocar); assert.ok(r.pos > 2, `${r.pos} não é > 2`);
});
test('parar liberta os ficheiros', async () => {
  const { r } = await comEspiao(async () => {
    const criados = window.__criados, l = Portfolio.Leitor.criar({ analise: true });
    await l.tocar({ url: 'audio/a.mp3', urlAntes: 'audio/b.mp3' }); await esperar(300); l.parar();
    return { n: criados.length, parados: criados.map((el) => el.paused), temSrc: criados.map((el) => el.hasAttribute('src')), aTocar: l.aTocar() };
  });
  assert.deepEqual(r, { n: 2, parados: [true, true], temSrc: [false, false], aTocar: false });
});
test('o fim é limitado a 0,05 s antes do fim, nos dois elementos', async () => {
  const { r } = await comEspiao(async () => {
    const criados = window.__criados, l = Portfolio.Leitor.criar({ analise: true });
    await l.tocar({ url: 'audio/a.mp3', urlAntes: 'audio/b.mp3' }); l.pausar(); l.procurar(1e9); await esperar(300);
    return criados.map((el) => el.currentTime);
  });
  assert.equal(r.length, 2); for (const t of r) perto(t, 5.95, 0.02);
});
test('trocar para uma versão que já terminou termina a faixa em ordem', async () => {
  const r = await noBrowser(async () => {
    const l = Portfolio.Leitor.criar({ analise: true }); let fins = 0, erros = 0; l.aoFim = () => fins++; l.aoErro = () => erros++;
    await l.tocar({ url: 'audio/a.mp3', urlAntes: 'audio/curto.mp3' }); await esperar(2400);
    const previos = fins; l.trocarVersao('antes'); await esperar(300);
    return { previos, fins, erros, aTocar: l.aTocar() };
  });
  assert.deepEqual(r, { previos: 0, fins: 1, erros: 0, aTocar: false });
});
test('voltar atrás e trocar para a versão mais curta que já terminou toca-a', async () => {
  const r = await noBrowser(async () => {
    const l = Portfolio.Leitor.criar({ analise: true });
    await l.tocar({ url: 'audio/a.mp3', urlAntes: 'audio/curto.mp3' }); await esperar(2400); l.procurar(0.5); l.trocarVersao('antes'); await esperar(600);
    return { aTocar: l.aTocar(), versao: l.versao(), pico: picoDb(l) };
  });
  assert.deepEqual([r.aTocar, r.versao], [true, 'antes']); perto(r.pico, -32, 0.5);
});
