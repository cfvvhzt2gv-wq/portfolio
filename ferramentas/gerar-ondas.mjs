#!/usr/bin/env node
// Formas de onda: para cada MP3 da pasta escreve ao lado um <nome>.onda.json com a duração e 800 picos (0 a 255).
// Uso: node ferramentas/gerar-ondas.mjs [pasta = audio]
// Escreve tudo em stdout; sai com 0 (mesmo que alguma faixa não possa ser lida) e com 1 se faltar o ffmpeg.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const TAXA = 22050;                    // amostras por segundo da decodificação
const NUM_PICOS = 800;
const PICO_MAXIMO = 255;
const MAXIMO_16_BITS = 32768;
const MAX_BUFFER = 512 * 1024 * 1024;  // folga para faixas muito longas

const temFfmpeg = () => !spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).error;

// Caminhos dos MP3 (qualquer caixa, em subpastas) como se chega a eles a partir de `pasta`, por ordem.
function procurarMp3(pasta) {
  let nomes;
  try {
    nomes = fs.readdirSync(pasta, { recursive: true });
  } catch {
    return []; // pasta inexistente: um site sem áudio é válido
  }
  return nomes
    .filter((nome) => /\.mp3$/i.test(nome))
    .map((nome) => path.join(pasta, nome))
    .filter((caminho) => fs.statSync(caminho).isFile())
    .sort();
}

// Decodifica com o ffmpeg para PCM de 16 bits, mono. Devolve { amostras } (Int16Array) ou { motivo }.
function decodificar(ficheiro) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-nostdin', '-i', ficheiro, '-f', 's16le', '-ac', '1', '-ar', String(TAXA), 'pipe:1'], { maxBuffer: MAX_BUFFER });
  if (r.error || r.status !== 0) return { motivo: 'o ffmpeg não conseguiu descodificar o ficheiro' };
  const n = Math.floor(r.stdout.length / 2), amostras = new Int16Array(n);
  for (let i = 0; i < n; i++) amostras[i] = r.stdout.readInt16LE(2 * i);
  if (n < NUM_PICOS) return { motivo: 'o ficheiro é demasiado curto' };
  return { amostras };
}

// Máximo absoluto de cada um dos 800 blocos, de 0 a 255.
function calcularPicos(amostras) {
  const n = amostras.length, picos = [];
  for (let i = 0; i < NUM_PICOS; i++) {
    const de = Math.floor(i * n / NUM_PICOS), ate = Math.floor((i + 1) * n / NUM_PICOS);
    let maximo = 0;
    for (let j = de; j < ate; j++) maximo = Math.max(maximo, Math.abs(amostras[j]));
    picos.push(Math.min(PICO_MAXIMO, Math.round(maximo * PICO_MAXIMO / MAXIMO_16_BITS)));
  }
  return picos;
}

const caminhoOnda = (mp3) => mp3.replace(/\.mp3$/i, '.onda.json');

// Grava o JSON ao lado do MP3 e devolve a duração (segundos, 2 casas).
function gravarOnda(mp3, amostras) {
  const duracao = Math.round(amostras.length / TAXA * 100) / 100;
  fs.writeFileSync(caminhoOnda(mp3), JSON.stringify({ duracao, picos: calcularPicos(amostras) }));
  return duracao;
}

// Uma falha não deixa um .onda.json antigo para trás: sem ele, a página mostra só a barra de progresso.
const removerOnda = (mp3) => fs.rmSync(caminhoOnda(mp3), { force: true });

const virgula = (numero) => numero.toFixed(2).replace('.', ',');

function principal() {
  if (!temFfmpeg()) {
    console.log('É preciso o ffmpeg instalado para preparar as formas de onda.');
    return 1;
  }
  const ficheiros = procurarMp3(process.argv[2] || 'audio');
  let preparados = 0;
  for (const mp3 of ficheiros) {
    const { amostras, motivo } = decodificar(mp3);
    if (!amostras) {
      removerOnda(mp3);
      console.log(`Aviso: não consegui ler ${mp3} (${motivo}). Essa faixa fica sem forma de onda.`);
      continue;
    }
    console.log(`${mp3}: ${virgula(gravarOnda(mp3, amostras))} s`);
    preparados++;
  }
  console.log(`${preparados} de ${ficheiros.length} ficheiros preparados.`);
  return 0;
}

process.exitCode = principal();
