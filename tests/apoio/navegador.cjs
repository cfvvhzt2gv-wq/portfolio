// tests/apoio/navegador.cjs
// Abre a página num Chromium (Playwright), corre `fn(page, { url, erros, externos, pedidos })` e fecha tudo no fim.
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { iniciarServidor } = require('./servidor.cjs');

async function comPagina(opcoes, fn) {
  const { conteudo, ficheiros, pagina = '/index.html', ficheiro, largura = 1280, altura = 900, movimentoReduzido = false } = opcoes || {};
  const erros = [], externos = [], pedidos = [];
  let servidor = null, browser = null;
  try {
    if (!ficheiro) servidor = await iniciarServidor({ conteudo, ficheiros });
    const origem = servidor && new URL(servidor.url).origin;
    browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const contexto = await browser.newContext({ viewport: { width: largura, height: altura }, reducedMotion: movimentoReduzido ? 'reduce' : 'no-preference' });
    const page = await contexto.newPage();
    page.on('pageerror', (erro) => erros.push(String((erro && erro.message) || erro)));
    page.on('console', (msg) => { if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) erros.push(msg.text()); });
    page.on('request', (pedido) => {
      const u = pedido.url();
      pedidos.push(u);
      if (/^https?:/i.test(u) && new URL(u).origin !== origem) externos.push(u);
    });
    await page.goto(ficheiro ? pathToFileURL(ficheiro).href : servidor.url + pagina);
    return await fn(page, { url: servidor ? servidor.url : null, erros, externos, pedidos });
  } finally {
    if (browser) await browser.close();
    if (servidor) await servidor.fechar();
  }
}

module.exports = { comPagina };
