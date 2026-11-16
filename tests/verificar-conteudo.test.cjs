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

// R3 + M6.1 + M6.2: o caminho de cada MP3 tem de estar dentro de audio/ e ser um ficheiro, senão o site publicado não o tem.
const comCaminho = (caminho, ficheiros, pastas = []) => {
  const c = base(); c.categorias.instrumentais.faixas[0].ficheiro = caminho;
  const dir = projeto(comoJs(c), [...MP3, ...ficheiros]);
  for (const p of pastas) fs.mkdirSync(path.join(dir, p), { recursive: true });
  return correr(dir);
};
const MSG_PASTA_AUDIO = /tem de estar dentro da pasta audio\//;
test('falha com um MP3 fora da pasta audio/ (na raiz do projeto)', () => {
  const r = comCaminho('noite.mp3', ['noite.mp3']); assert.equal(r.status, 1);
  assert.match(r.stdout, /«noite\.mp3» \(faixa «Primeira»\)/); assert.match(r.stdout, MSG_PASTA_AUDIO); assert.match(r.stdout, /1 problema\(s\) encontrado\(s\)/);
});
test('falha com um caminho que começa por /', () => { const r = comCaminho('/audio/i1.mp3', []); assert.equal(r.status, 1); assert.match(r.stdout, /«\/audio\/i1\.mp3» \(faixa «Primeira»\)/); assert.match(r.stdout, MSG_PASTA_AUDIO); });
test('falha com # ? % \\ e .. no caminho', () => {
  for (const [caminho, ficheiros] of [['audio/a#1.mp3', ['audio/a#1.mp3']], ['audio/a?1.mp3', ['audio/a?1.mp3']], ['audio/a%201.mp3', ['audio/a 1.mp3']], ['audio/a\\1.mp3', []], ['audio/../audio/i1.mp3', []]]) {
    const r = comCaminho(caminho, ficheiros); assert.equal(r.status, 1, caminho); assert.match(r.stdout, /faixa «Primeira»\)/, caminho); assert.match(r.stdout, /não pode ter/, caminho);
  }
});
test('falha com um ficheiro que não é .mp3 e aceita .MP3', () => {
  const r = comCaminho('audio/i1.wav', ['audio/i1.wav']); assert.equal(r.status, 1); assert.match(r.stdout, /«audio\/i1\.wav» \(faixa «Primeira»\): tem de ser um ficheiro \.mp3/);
  assert.equal(comCaminho('audio/I1.MP3', ['audio/I1.MP3']).status, 0);
});
test('falha com uma pasta no lugar do MP3', () => {
  for (const [caminho, pastas] of [['audio', ['audio']], ['audio/pasta.mp3', ['audio/pasta.mp3']]]) {
    const r = comCaminho(caminho, [], pastas); assert.equal(r.status, 1, caminho); assert.match(r.stdout, /faixa «Primeira»\)/, caminho); assert.match(r.stdout, /MP3|pasta/, caminho);
  }
});
test('um caminho em subpastas de audio/ passa, e um valor por preencher conta uma só vez', () => {
  assert.equal(comCaminho('audio/instrumentais/noite-em-lisboa.mp3', ['audio/instrumentais/noite-em-lisboa.mp3']).status, 0);
  const r = comCaminho('[audio/instrumentais/nome.mp3]', []); assert.equal(r.status, 1); assert.match(r.stdout, /1 problema\(s\) encontrado\(s\)/);
});

// R2 + M2.4: as ligações das redes sociais têm de ser endereços web completos.
const comRede = (url) => { const c = base(); c.contacto.redes = [{ nome: 'Instagram', url }]; return correr(projeto(comoJs(c))); };
test('falha com uma rede sem https:// e com javascript:', () => {
  for (const url of ['instagram.com/x', 'www.instagram.com/x', 'javascript:alert(1)', 'mailto:a@b.pt']) {
    const r = comRede(url); assert.equal(r.status, 1, url); assert.match(r.stdout, /A ligação da rede «Instagram» tem de começar por https:\/\//, url); assert.match(r.stdout, /1 problema\(s\) encontrado\(s\)/);
  }
});
test('aceita redes com https://, http:// (qualquer caixa) e sem redes', () => {
  for (const url of ['https://instagram.com/x', 'http://exemplo.pt', 'HTTPS://Exemplo.pt/x']) assert.equal(comRede(url).status, 0, url);
  const c = base(); delete c.contacto.redes; assert.equal(correr(projeto(comoJs(c))).status, 0);
});
test('uma rede por preencher conta uma só vez', () => { const r = comRede('[https://...]'); assert.equal(r.status, 1); assert.match(r.stdout, /1 problema\(s\) encontrado\(s\)/); });

// M6.6: singular na linha de sucesso.
test('linha de sucesso no singular com uma faixa e um ficheiro', () => {
  const c = base(); delete c.categorias.mistura; delete c.categorias.cinematografico;
  const r = correr(projeto(comoJs(c))); assert.equal(r.status, 0); assert.match(r.stdout, /Conteúdo completo: 1 faixa, 1 ficheiro de áudio\./);
});
