// tests/apoio/sinal.cjs
// Sinais de teste. O servidor de teste envia como `audio/wav` os `.mp3` que vêm de `ficheiros`, por isso um WAV serve de MP3.
const FREQUENCIA = 1000;                     // Hz
const MAXIMO_16_BITS = 32767;

// Amplitude de pico, em valores de 16 bits, de um seno com `db` dBFS de pico; `null` é um canal em silêncio.
const amplitude = (db) => (db === null ? 0 : MAXIMO_16_BITS * 10 ** (db / 20));

// WAV de PCM com 16 bits e dois canais: um seno de 1 kHz com o nível de cada canal em `esqDb` e `dirDb` (dBFS de pico).
// `inverterDir` inverte a polaridade do canal direito (correlação −1).
function wav({ segundos = 6, db = -20, esqDb = db, dirDb = db, inverterDir = false, taxa = 44100 } = {}) {
  const n = Math.round(segundos * taxa), dados = Buffer.alloc(n * 4);
  const esq = amplitude(esqDb), dir = amplitude(dirDb) * (inverterDir ? -1 : 1);
  for (let i = 0; i < n; i++) {
    const seno = Math.sin(2 * Math.PI * FREQUENCIA * i / taxa);
    dados.writeInt16LE(Math.round(esq * seno), 4 * i);
    dados.writeInt16LE(Math.round(dir * seno), 4 * i + 2);
  }
  const c = Buffer.alloc(44);
  c.write('RIFF', 0, 'ascii'); c.writeUInt32LE(36 + dados.length, 4); c.write('WAVE', 8, 'ascii');
  c.write('fmt ', 12, 'ascii'); c.writeUInt32LE(16, 16); c.writeUInt16LE(1, 20);        // bloco fmt de 16 bytes, PCM
  c.writeUInt16LE(2, 22); c.writeUInt32LE(taxa, 24); c.writeUInt32LE(taxa * 4, 28);     // canais, taxa, bytes por segundo
  c.writeUInt16LE(4, 32); c.writeUInt16LE(16, 34);                                       // bytes por par de amostras, bits por amostra
  c.write('data', 36, 'ascii'); c.writeUInt32LE(dados.length, 40);
  return Buffer.concat([c, dados]);
}

// JSON de `nome.onda.json`: 800 picos iguais, com o nível de um seno de `db` dBFS (0 a 255).
function onda({ segundos = 6, db = -20 } = {}) {
  return JSON.stringify({ duracao: segundos, picos: Array(800).fill(Math.round(255 * 10 ** (db / 20))) });
}

// Os ficheiros dos quatro MP3 de `base()` (6 s; o «antes» a −32 dB, os outros a −20 dB) e os respetivos `.onda.json` com o mesmo nível.
function faixasTeste({ semOnda = false } = {}) {
  const niveis = { '/audio/i1': -20, '/audio/m1-antes': -32, '/audio/m1-depois': -20, '/audio/c1': -20 }, ficheiros = {};
  for (const [nome, db] of Object.entries(niveis)) {
    ficheiros[`${nome}.mp3`] = wav({ segundos: 6, db });
    if (!semOnda) ficheiros[`${nome}.onda.json`] = onda({ segundos: 6, db });
  }
  return ficheiros;
}

module.exports = { wav, onda, faixasTeste };
