// tests/gerar-ondas.test.cjs
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { spawnSync } = require('node:child_process');
const { wav } = require('./apoio/sinal.cjs');
const FERR = path.join(__dirname, '..', 'ferramentas', 'gerar-ondas.mjs');
const temFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
function pasta() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'go-')); fs.mkdirSync(path.join(dir, 'mistura'));
  fs.writeFileSync(path.join(dir, 'a.wav'), wav({ segundos: 3, db: -6 }));
  for (const destino of ['a.mp3', 'mistura/x-antes.MP3']) assert.equal(spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(dir, 'a.wav'), '-b:a', '192k', path.join(dir, destino)]).status, 0);
  return dir;
}
const correr = (dir, env) => spawnSync(process.execPath, [FERR, dir], { encoding: 'utf8', env });

test('cria o .onda.json com a duração e 800 picos', { skip: !temFfmpeg }, () => {
  const dir = pasta(), r = correr(dir); assert.equal(r.status, 0); assert.match(r.stdout, /2 de 2 ficheiros preparados\./);
  const j = JSON.parse(fs.readFileSync(path.join(dir, 'a.onda.json'), 'utf8'));
  assert.ok(Math.abs(j.duracao - 3) <= 0.05); assert.equal(j.picos.length, 800); assert.ok(j.picos.every((p) => Number.isInteger(p) && p >= 0 && p <= 255));
  const mediana = [...j.picos].sort((a, b) => a - b)[400]; assert.ok(mediana >= 120 && mediana <= 135, `mediana ${mediana}`);   // −6 dB ≈ 124–128 (medido: 124, por causa da reamostragem a 22,05 kHz)
  assert.ok(fs.existsSync(path.join(dir, 'mistura', 'x-antes.onda.json')));
});
test('ficheiro ilegível: avisa e continua', { skip: !temFfmpeg }, () => {
  const dir = pasta(); fs.writeFileSync(path.join(dir, 'lixo.mp3'), 'isto não é áudio');
  const r = correr(dir); assert.equal(r.status, 0); assert.match(r.stdout, /Aviso: não consegui ler .*lixo\.mp3/); assert.match(r.stdout, /2 de 3 ficheiros preparados\./);
  assert.ok(!fs.existsSync(path.join(dir, 'lixo.onda.json'))); assert.ok(fs.existsSync(path.join(dir, 'a.onda.json')));
});
test('sem ffmpeg: falha com uma mensagem clara', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'go-')); fs.writeFileSync(path.join(dir, 'a.mp3'), 'x');
  const r = correr(dir, { PATH: '' }); assert.equal(r.status, 1); assert.match(r.stdout, /É preciso o ffmpeg instalado/);
});
