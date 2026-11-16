// tests/verificar-conteudo.test.cjs
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { spawnSync } = require('node:child_process');
const { base, comoJs } = require('./apoio/conteudo.cjs');
const FERR = path.join(__dirname, '..', 'ferramentas', 'verificar-conteudo.mjs');
const MP3 = ['audio/i1.mp3', 'audio/m1-antes.mp3', 'audio/m1-depois.mp3', 'audio/c1.mp3'];
function projeto(js, ficheiros = MP3) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-'));
  if (js !== null) fs.writeFileSync(path.join(dir, 'conteudo.js'), js);
  for (const f of ficheiros) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), 'x'); }
  return dir;
}
const correr = (dir) => spawnSync(process.execPath, [FERR, dir], { encoding: 'utf8' });

test('passa com conteúdo completo', () => { const r = correr(projeto(comoJs(base()))); assert.equal(r.status, 0); assert.match(r.stdout, /Conteúdo completo: 3 faixas, 4 ficheiros de áudio\./); });
test('falha com um valor entre parênteses retos', () => {
  const c = base(); c.categorias.instrumentais.faixas[0].titulo = '[Nome da faixa]';
  const r = correr(projeto(comoJs(c))); assert.equal(r.status, 1); assert.match(r.stdout, /Falta preencher «categorias\.instrumentais\.faixas\[0\]\.titulo»: ainda tem «\[Nome da faixa\]»\./); assert.match(r.stdout, /1 problema\(s\) encontrado\(s\)\. Nada foi publicado\./);
});
test('um valor com parênteses a meio é válido', () => { const c = base(); c.categorias.instrumentais.faixas[0].titulo = 'Song [Remix]'; assert.equal(correr(projeto(comoJs(c))).status, 0); });
test('falha com um MP3 em falta', () => { const r = correr(projeto(comoJs(base()), MP3.slice(1))); assert.equal(r.status, 1); assert.match(r.stdout, /Falta o ficheiro «audio\/i1\.mp3» \(faixa «[^»]+»\)\./); });
test('falha com erro de escrita', () => { const r = correr(projeto('window.CONTEUDO = { nome: "X" categorias: {} };')); assert.equal(r.status, 1); assert.match(r.stdout, /conteudo\.js: erro de escrita na linha 1 — /); });
test('falha com campo obrigatório em falta', () => {
  const c = base(); delete c.categorias.instrumentais.faixas[0].titulo; delete c.categorias.mistura.faixas[0].antes; delete c.nome;
  const r = correr(projeto(comoJs(c))); assert.equal(r.status, 1);
  assert.match(r.stdout, /Falta o campo «titulo» na faixa 1 de «instrumentais»\./); assert.match(r.stdout, /Falta o campo «antes» na faixa 1 de «mistura»\./); assert.match(r.stdout, /Falta o campo «nome»/);
});
test('falha com categoria desconhecida', () => { const c = base(); c.categorias.instrumental = c.categorias.instrumentais; const r = correr(projeto(comoJs(c))); assert.equal(r.status, 1); assert.match(r.stdout, /Categoria desconhecida «instrumental»\./); });
test('falha sem conteudo.js', () => { const r = correr(projeto(null, [])); assert.equal(r.status, 1); assert.match(r.stdout, /Não encontrei o conteudo\.js/); });
