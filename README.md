# Portefólio

Site de uma página com a tua produção musical: instrumentais, mistura e masterização, e áudio cinematográfico.

## Onde pôr o texto e os áudios

**O texto.** Todo o texto do site está num só ficheiro, o `conteudo.js`, na raiz do repositório. No GitHub: abre o ficheiro, clica no lápis, muda o texto e clica em **Commit changes**.
- Substitui tudo o que está entre [parênteses retos] pelo teu texto, sem os parênteses.
- Para esconder um campo opcional (o local, o género, o ano...), apaga a linha inteira dele. O título e os ficheiros de cada faixa nunca se apagam: sem eles a faixa desaparece do site.
- Numa lista (as DAWs, as técnicas), apaga só o item que não queres, com a vírgula a seguir.
- Mantém as aspas e as vírgulas. Se um texto tiver aspas, usa « » ou ’ em vez de ".
- O que lá vai: nome, local, e-mail, redes, DAWs (a principal primeiro), formação, técnicas, uma frase opcional por categoria e a lista de faixas.

**Os áudios.** São ficheiros MP3 e vão para três pastas: `audio/instrumentais/`, `audio/mistura/` (dois ficheiros por trabalho, por exemplo `nome-antes.mp3` e `nome-depois.mp3`) e `audio/cinematografico/`. No GitHub: abre a pasta, clica em **Add file** → **Upload files**, arrasta os MP3 e clica em **Commit changes**.

**Os nomes dos ficheiros.** Só MP3, em minúsculas, sem espaços e sem acentos (por exemplo `noite-em-lisboa.mp3`). No `conteudo.js` escreves o caminho completo, a começar por `audio/`, por exemplo `audio/instrumentais/noite-em-lisboa.mp3`.

**Tamanho.** Pelo site do GitHub, cada ficheiro pode ter no máximo 25 MB. Para ficheiros maiores (até 100 MB) é preciso usar o Git no computador. No total, o site inteiro (MP3 incluídos) deve ficar abaixo de cerca de 1 GB.

**Para ser publicado.** Em **Commit changes**, deixa selecionada a opção **Commit directly to the main branch**. A automação **Publicar** corre sozinha. Se faltar alguma coisa (um campo ainda entre [parênteses retos], um MP3 que não existe), nada é publicado e o site fica como estava. O erro lê-se no separador **Actions**.

## Como acrescentar uma faixa

1. Carrega o MP3 para a pasta certa de `audio/`.
2. No `conteudo.js`, na lista `faixas` da categoria, copia um bloco `{ ... }` inteiro, cola-o a seguir (com uma vírgula entre blocos) e muda os textos e o nome do ficheiro.
3. Na mistura, indica os dois ficheiros: `antes` e `depois`.

Só o título e o(s) ficheiro(s) são obrigatórios.

## Ver no computador

É opcional e não é preciso para publicar: serve só para veres o site no teu computador antes.

- Duplo clique no `index.html`: abre o modo simples.
- Para o painel completo, corre `npx http-server` na pasta do projeto (precisa do Node.js) e abre `http://localhost:8080`.
- As formas de onda locais vêm de `node ferramentas/gerar-ondas.mjs`. Precisa do ffmpeg instalado.
- Para ver o que ainda falta antes de publicar: `node ferramentas/verificar-conteudo.mjs`.

## Publicar

- Grava as alterações com **Commit changes**, deixando selecionada a opção **Commit directly to the main branch**. A automação **Publicar** corre sozinha: verifica o conteúdo, prepara as formas de onda e publica o site. Também a podes correr à mão no separador **Actions**.
- Só uma vez: **Settings** → **Pages** → **Source** → **GitHub Actions**.
- Endereço: https://cfvvhzt2gv-wq.github.io/portfolio
- Se falhar, lê o erro no separador **Actions**.

## Testes

`node --test --test-concurrency=1`

Precisa de Playwright e, para as ferramentas, de ffmpeg.
