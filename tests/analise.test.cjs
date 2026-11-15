// tests/analise.test.cjs
const test = require('node:test'), assert = require('node:assert/strict');
const A = require('../js/analise.js');
const seno = (db, taxa = 44100, seg = 1) => Float32Array.from({ length: Math.round(taxa * seg) }, (_, i) => 10 ** (db / 20) * Math.sin(2 * Math.PI * 1000 * i / taxa));
const mudo = (n = 44100) => new Float32Array(n);
const perto = (v, esperado, tol) => assert.ok(Math.abs(v - esperado) <= tol, `${v} ≉ ${esperado} ± ${tol}`);

test('seno de 1 kHz a −20 dB nos dois canais', () => {
  const x = seno(-20), r = A.criarMedidor(44100).atualizar(x, x, 0);
  perto(r.picoDb, -20, 0.1); perto(r.rmsDb, -23, 0.1); perto(r.lufs, -20, 0.2); perto(r.correlacao, 1, 0.01);
});
test('o mesmo seno a 48 kHz', () => { const x = seno(-20, 48000); perto(A.criarMedidor(48000).atualizar(x, x, 0).lufs, -20, 0.2); });
test('canal direito invertido: correlação −1', () => { const x = seno(-20); perto(A.criarMedidor(44100).atualizar(x, x.map(v => -v), 0).correlacao, -1, 0.01); });
test('seno só num canal: LUFS −23', () => { perto(A.criarMedidor(44100).atualizar(seno(-20), mudo(), 0).lufs, -23, 0.2); });
test('silêncio: leituras sem valor e nível 0', () => {
  const r = A.criarMedidor(44100).atualizar(mudo(), mudo(), 0);
  assert.deepEqual([r.picoDb, r.rmsDb, r.lufs, r.correlacao], [null, null, null, null]); assert.equal(r.nivel, 0);
});
test('as leituras lentas atualizam 10 vezes por segundo', () => {
  const m = A.criarMedidor(44100), x = seno(-20);
  perto(m.atualizar(x, x, 0).lufs, -20, 0.2);
  perto(m.atualizar(mudo(), mudo(), 0.05).lufs, -20, 0.2);        // ainda não passaram 0,1 s
  assert.equal(m.atualizar(mudo(), mudo(), 0.11).lufs, null);
});
test('a marca do nível fica 0,75 s e depois desce 0,36 por segundo', () => {
  const m = A.criarMedidor(44100), x = seno(-20), alto = m.atualizar(x, x, 0).nivel;
  perto(m.atualizar(mudo(), mudo(), 0.5).marcaNivel, alto, 1e-6);
  perto(m.atualizar(mudo(), mudo(), 1.5).marcaNivel, alto - 0.27, 0.01);
});
test('o pico guarda os últimos 3 s', () => {
  const m = A.criarMedidor(44100), x = seno(-20), baixo = seno(-50);
  m.atualizar(x, x, 0);
  for (let i = 1; i <= 29; i++) perto(m.atualizar(baixo, baixo, i / 10).picoDb, -20, 0.1);   // até t = 2,9 s
  perto(m.atualizar(baixo, baixo, 3.0).picoDb, -50, 0.1);
});
test('reiniciarPico apaga o pico e só conta o que vem 50 ms depois do reinício', () => {
  const m = A.criarMedidor(44100), x = seno(-20), baixo = seno(-50);
  m.atualizar(x, x, 0); m.reiniciarPico();
  assert.equal(m.atualizar(x, x, 0.01).picoDb, null);             // apagado; o som ainda é o anterior
  assert.equal(m.atualizar(x, x, 0.05).picoDb, null);             // dentro da margem de 50 ms, sem nova leitura lenta
  perto(m.atualizar(baixo, baixo, 0.2).picoDb, -50, 0.1);         // só entram os 0,14 s depois da margem
});
test('bandasEspectro: 44 bandas, 1 kHz cai na banda 24, queda e marca de pico', () => {
  const bins = new Float32Array(4096).fill(-120), e = A.novoEstadoEspectro();
  bins[186] = -30;                                                // 186 × 44100 / 8192 ≈ 1001 Hz
  A.bandasEspectro(bins, 44100, e);
  assert.equal(e.val.length, 44); perto(e.val[24], 0.84, 0.01); assert.equal(e.val[23] + e.val[25], 0);
  const v = e.val[24]; A.bandasEspectro(new Float32Array(4096).fill(-120), 44100, e);
  perto(e.val[24], v - 0.035, 1e-6); perto(e.pico[24], v - 0.012, 1e-6);
});
test('formatação à portuguesa', () => {
  assert.equal(A.formatarDb(-13.04), '−13,0'); assert.equal(A.formatarDb(-0.04), '0,0');
  assert.equal(A.formatarDb(null), '—'); assert.equal(A.formatarDb(-Infinity), '—');
  assert.equal(A.formatarCorrelacao(0.834), '+0,83'); assert.equal(A.formatarCorrelacao(-1), '−1,00');
  assert.equal(A.formatarCorrelacao(-0.004), '+0,00'); assert.equal(A.formatarCorrelacao(null), '—');
  assert.deepEqual([0, 42.9, 195, 3725].map((s) => A.formatarTempo(s)), ['0:00', '0:42', '3:15', '62:05']);
  assert.equal(A.formatarTempo(null), '—:—');
});
