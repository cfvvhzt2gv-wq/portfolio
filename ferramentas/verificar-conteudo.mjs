#!/usr/bin/env node
// Verificação do conteúdo: lê <raiz>/conteudo.js e diz, em português, o que ainda falta antes de publicar.
// Uso: node ferramentas/verificar-conteudo.mjs [raiz = .]
// Escreve tudo em stdout; sai com 0 se o conteúdo estiver completo e com 1 se houver problemas.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const CATEGORIAS = ['instrumentais', 'mistura', 'cinematografico'];
const FICHEIROS = { mistura: ['antes', 'depois'] }; // as outras categorias têm só «ficheiro»

const objeto = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const textoPreenchido = (v) => typeof v === 'string' && v.trim() !== '';

// Lê e avalia o conteudo.js. Devolve { conteudo } ou { problema } (nada mais se pode verificar).
function lerConteudo(raiz) {
  let codigo;
  try {
    codigo = fs.readFileSync(path.join(raiz, 'conteudo.js'), 'utf8');
  } catch (erro) {
    if (erro.code === 'ENOENT') return { problema: `Não encontrei o conteudo.js em «${raiz}».` };
    return { problema: `Não consegui ler o conteudo.js em «${raiz}»: ${erro.message}.` };
  }
  const janela = {};
  try {
    new vm.Script(codigo, { filename: 'conteudo.js' }).runInNewContext({ window: janela });
  } catch (erro) {
    const linha = /^conteudo\.js:(\d+)/m.exec(String(erro.stack));
    if (erro instanceof SyntaxError && linha) return { problema: `conteudo.js: erro de escrita na linha ${linha[1]} — ${erro.message}.` };
    return { problema: `conteudo.js: não consegui executá-lo — ${erro && erro.message}.` };
  }
  if (!janela.CONTEUDO || typeof janela.CONTEUDO !== 'object' || Array.isArray(janela.CONTEUDO)) {
    return { problema: 'conteudo.js: não define window.CONTEUDO como um objeto.' };
  }
  return { conteudo: janela.CONTEUDO };
}

// Percorre tudo e junta os textos que ainda estão inteiros entre [parênteses retos].
function procurarMarcadores(valor, caminho, problemas) {
  if (typeof valor === 'string') {
    const texto = valor.trim();
    if (texto.startsWith('[') && texto.endsWith(']')) problemas.push(`Falta preencher «${caminho}»: ainda tem «${texto}».`);
  } else if (Array.isArray(valor)) {
    valor.forEach((item, i) => procurarMarcadores(item, `${caminho}[${i}]`, problemas));
  } else if (valor && typeof valor === 'object') {
    for (const [chave, item] of Object.entries(valor)) procurarMarcadores(item, caminho ? `${caminho}.${chave}` : chave, problemas);
  }
}

// Valida o nome e as categorias; devolve os ficheiros de áudio indicados e quantas faixas há.
function validarCategorias(conteudo, problemas) {
  const ficheiros = []; // { caminho, titulo }
  let faixas = 0;
  if (!textoPreenchido(conteudo.nome)) problemas.push('Falta o campo «nome».');
  const categorias = objeto(conteudo.categorias);
  for (const [chave, categoria] of Object.entries(categorias)) {
    if (!CATEGORIAS.includes(chave)) { problemas.push(`Categoria desconhecida «${chave}».`); continue; }
    const lista = objeto(categoria).faixas;
    if (!Array.isArray(lista)) { problemas.push(`Falta a lista «faixas» na categoria «${chave}».`); continue; }
    lista.forEach((bruta, i) => {
      const faixa = objeto(bruta);
      faixas++;
      const campos = ['titulo', ...(FICHEIROS[chave] || ['ficheiro'])];
      for (const campo of campos) {
        if (!textoPreenchido(faixa[campo])) problemas.push(`Falta o campo «${campo}» na faixa ${i + 1} de «${chave}».`);
      }
      for (const campo of campos.slice(1)) {
        if (textoPreenchido(faixa[campo])) ficheiros.push({ caminho: faixa[campo].trim(), titulo: textoPreenchido(faixa.titulo) ? faixa.titulo.trim() : `faixa ${i + 1}` });
      }
    });
  }
  return { ficheiros, faixas };
}

const eMarcador = (texto) => texto.startsWith('[') && texto.endsWith(']');

// O que está errado num caminho de áudio, ou null. O site publicado só leva a pasta audio/, e o endereço do MP3 é o próprio caminho.
function defeitoDoCaminho(caminho) {
  if (!caminho.startsWith('audio/')) return 'o MP3 tem de estar dentro da pasta audio/ e o caminho tem de começar por «audio/»';
  if (/\.\.|[\\#?%]/.test(caminho)) return 'o caminho não pode ter «..», «\\», «#», «?» nem «%» (renomeia o ficheiro, só com letras, números e hífenes)';
  if (!/\.mp3$/i.test(caminho)) return 'tem de ser um ficheiro .mp3, dentro da pasta audio/';
  return null;
}

// Confirma que cada ficheiro indicado fica na pasta audio/ e existe (os que ainda são marcadores já foram assinalados).
function verificarFicheiros(raiz, ficheiros, problemas) {
  for (const { caminho, titulo } of ficheiros) {
    if (eMarcador(caminho)) continue;
    const quem = `«${caminho}» (faixa «${titulo}»)`, defeito = defeitoDoCaminho(caminho);
    if (defeito) { problemas.push(`O ficheiro ${quem}: ${defeito}.`); continue; }
    let info = null;
    try { info = fs.statSync(path.join(raiz, caminho)); } catch { /* não existe */ }
    if (!info) problemas.push(`Falta o ficheiro «${caminho}» (faixa «${titulo}»).`);
    else if (!info.isFile()) problemas.push(`O ficheiro ${quem}: é uma pasta, não um MP3; o MP3 tem de estar dentro da pasta audio/.`);
  }
}

// Cada ligação de rede social tem de ser um endereço web completo, senão fica um link partido (ou perigoso) no site.
function verificarRedes(conteudo, problemas) {
  const redes = objeto(conteudo.contacto).redes;
  if (!Array.isArray(redes)) return;
  redes.forEach((bruta, i) => {
    const rede = objeto(bruta), url = textoPreenchido(rede.url) ? rede.url.trim() : '';
    if (!url || eMarcador(url) || /^https?:\/\//i.test(url)) return;
    const nome = textoPreenchido(rede.nome) ? rede.nome.trim() : `rede ${i + 1}`;
    problemas.push(`A ligação da rede «${nome}» tem de começar por https:// (por exemplo https://instagram.com/o-teu-nome); agora está «${url}».`);
  });
}

function verificar(raiz) {
  const { conteudo, problema } = lerConteudo(raiz);
  if (problema) return { problemas: [problema] };
  const problemas = [];
  procurarMarcadores(conteudo, '', problemas);
  const { ficheiros, faixas } = validarCategorias(conteudo, problemas);
  verificarRedes(conteudo, problemas);
  verificarFicheiros(raiz, ficheiros, problemas);
  return { problemas, faixas, ficheiros: ficheiros.length };
}

function imprimir({ problemas, faixas, ficheiros }) {
  const linhas = [...problemas];
  linhas.push(problemas.length
    ? `${problemas.length} problema(s) encontrado(s). Nada foi publicado.`
    : `Conteúdo completo: ${faixas} ${faixas === 1 ? 'faixa' : 'faixas'}, ${ficheiros} ${ficheiros === 1 ? 'ficheiro' : 'ficheiros'} de áudio.`);
  process.stdout.write(linhas.join('\n') + '\n');
}

const resultado = verificar(process.argv[2] || '.');
imprimir(resultado);
process.exitCode = resultado.problemas.length ? 1 : 0;
