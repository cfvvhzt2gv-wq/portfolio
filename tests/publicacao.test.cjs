// tests/publicacao.test.cjs
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const raiz = path.join(__dirname, '..'), ler = (f) => fs.readFileSync(path.join(raiz, f), 'utf8');

test('o workflow publica no push para main e verifica antes de preparar e publicar', () => {
  const y = ler('.github/workflows/publicar.yml');
  assert.match(y, /push:\s*\n\s*branches:\s*\[main\]/); assert.match(y, /workflow_dispatch:/); assert.match(y, /pages: write/); assert.match(y, /id-token: write/);
  const i = (s) => y.indexOf(s);
  assert.ok(i('verificar-conteudo.mjs') > 0 && i('verificar-conteudo.mjs') < i('gerar-ondas.mjs') && i('gerar-ondas.mjs') < i('upload-pages-artifact') && i('upload-pages-artifact') < i('deploy-pages'));
});
test('o workflow copia só os ficheiros do site para _site', () => {
  const linha = ler('.github/workflows/publicar.yml').split('\n').find((l) => /cp -r .* _site\/?\s*$/.test(l));
  assert.ok(linha, 'falta o cp -r para _site'); assert.deepEqual(linha.trim().replace(/^cp -r /, '').replace(/ _site\/?$/, '').split(' ').sort(), ['audio', 'conteudo.js', 'estilo.css', 'fontes', 'index.html', 'js']);
});
test('.gitignore ignora as formas de onda geradas e a pasta de publicação', () => { const g = ler('.gitignore').split('\n'); assert.ok(g.includes('*.onda.json') && g.includes('_site/')); });
