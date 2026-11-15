// tests/apoio/servidor.cjs
// Servidor local dos testes: serve os ficheiros reais do repositório (sem sair da raiz),
// com `/conteudo.js` e outros ficheiros substituíveis por cada teste.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');

const RAIZ = path.resolve(__dirname, '..', '..');
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg',
};
const tipoDe = (caminho, emMemoria) => (emMemoria && caminho.endsWith('.mp3') ? 'audio/wav' : TIPOS[path.extname(caminho)] || 'application/octet-stream');

// Intervalo pedido em `Range: bytes=…` (um só); `null` se não houver ou não se perceber, `false` se não for satisfazível.
function intervalo(cabecalho, total) {
  const m = /^bytes=(\d*)-(\d*)$/.exec((cabecalho || '').trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;
  const inicio = m[1] === '' ? Math.max(0, total - Number(m[2])) : Number(m[1]);
  const fim = m[1] === '' || m[2] === '' ? total - 1 : Math.min(Number(m[2]), total - 1);
  return inicio >= total || inicio > fim ? false : { inicio, fim };
}

function responder(req, res, tipo, corpo) {
  const total = corpo.length, r = intervalo(req.headers.range, total);
  const cabecalhos = { 'Content-Type': tipo, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
  if (r === false) { res.writeHead(416, { ...cabecalhos, 'Content-Range': `bytes */${total}` }); return res.end(); }
  const parte = r ? corpo.subarray(r.inicio, r.fim + 1) : corpo;
  res.writeHead(r ? 206 : 200, { ...cabecalhos, 'Content-Length': parte.length, ...(r && { 'Content-Range': `bytes ${r.inicio}-${r.fim}/${total}` }) });
  res.end(req.method === 'HEAD' ? undefined : parte);
}

function iniciarServidor({ conteudo, ficheiros = {} } = {}) {
  const memoria = new Map(Object.entries(ficheiros).map(([c, v]) => [c.startsWith('/') ? c : `/${c}`, Buffer.from(v)]));
  if (typeof conteudo === 'string' && !memoria.has('/conteudo.js')) memoria.set('/conteudo.js', Buffer.from(conteudo));

  const servidor = http.createServer((req, res) => {
    const naoEncontrado = () => { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('404'); };
    if (req.method !== 'GET' && req.method !== 'HEAD') return naoEncontrado();
    let caminho;
    try { caminho = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { return naoEncontrado(); }
    if (memoria.has(caminho)) return responder(req, res, tipoDe(caminho, true), memoria.get(caminho));
    const ficheiro = path.resolve(RAIZ, `.${caminho}`);
    if (!ficheiro.startsWith(RAIZ + path.sep)) return naoEncontrado();
    fs.readFile(ficheiro, (erro, corpo) => (erro ? naoEncontrado() : responder(req, res, tipoDe(ficheiro, false), corpo)));
  });

  return new Promise((resolve, reject) => {
    servidor.once('error', reject);
    servidor.listen(0, '127.0.0.1', () => resolve({
      url: `http://127.0.0.1:${servidor.address().port}`,
      fechar: () => new Promise((fim) => { servidor.close(() => fim()); servidor.closeAllConnections(); }),
    }));
  });
}

module.exports = { iniciarServidor };
