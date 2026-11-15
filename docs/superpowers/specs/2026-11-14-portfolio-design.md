# Portfólio de produção musical — especificação

Data: 2026-11-14 · Estado: para revisão (2.ª versão, com o painel de instrumentos do leitor)

## 1. Objetivo

Um site minimalista, de uma só página, que apresenta as produções do Afonso Duarte e deixa ouvi-las de imediato. Público: potenciais clientes e artistas. O site tem sucesso se, em poucos segundos, quem o visita percebe o que o Afonso faz, consegue ouvir os trabalhos de cada categoria e sabe como o contactar.

## 2. Decisões tomadas

- Design: opção **B · Ficha técnica** (claro, editorial, serifado), com as alterações pedidas. Mockup: https://claude.ai/artifact/VyWxEc2S4zVYcwpyzY8b7a (privado).
- Ordem das categorias: **01 Instrumentais**, **02 Mistura e masterização**, **03 Áudio cinematográfico**.
- Secção «Sobre» sem texto corrido: só três tópicos, por esta ordem — **DAWs**, **Formação**, **Técnicas**.
- Sem vídeos. Todas as categorias são listas de faixas de áudio.
- Áudio em ficheiros **MP3** alojados no próprio site (recomendado 320 kbps; WAV não).
- Mistura e masterização com botão **Antes / Depois**.
- Leitor com **painel de instrumentos**, opção **2 · Completa** do protótipo: todas as faixas mostram forma de onda, espectro, campo estéreo e leituras. Protótipo: https://claude.ai/artifact/WUthhU6paP255s8PQaRMNU (privado).
- Alojamento: **GitHub Pages**, neste repositório (`cfvvhzt2gv-wq/portfolio`), separado do repositório `cv`.
- Publicação por uma **automação do GitHub** que verifica o conteúdo e prepara as formas de onda antes de pôr o site no ar (secção 8).
- Tecnologia: HTML, CSS e JavaScript simples. Sem frameworks e sem dependências em produção.
- Idioma: só português (pt-PT).

## 3. Estrutura de ficheiros

```
index.html            página (estrutura fixa: cabeçalho, topo, secções vazias, rodapé)
estilo.css            todo o estilo
conteudo.js           ÚNICO ficheiro a editar: faixas, DAWs, técnicas, contactos
js/
  pagina.js           constrói a página a partir do conteúdo
  leitor.js           reprodução: tocar, pausar, procurar, Antes / Depois
  analise.js          medições do som: nível, pico, RMS, LUFS, correlação, espectro
  instrumentos.js     desenho da forma de onda, do espectro e do campo estéreo
audio/
  instrumentais/      MP3 dos instrumentais
  mistura/            MP3 «antes» e «depois» de cada trabalho
  cinematografico/    MP3 do áudio cinematográfico
fontes/               Instrument Serif, Inter e IBM Plex Mono (woff2), alojadas no próprio site
ferramentas/
  verificar-conteudo.mjs   confirma que o conteúdo está completo e que os MP3 existem
  gerar-ondas.mjs          prepara a forma de onda e a duração de cada MP3
.github/workflows/publicar.yml   verifica, prepara e publica o site (secção 8)
tests/                testes automáticos (não publicados)
docs/                 esta especificação e o plano (não publicados)
README.md             como acrescentar uma faixa e como publicar
```

- As fontes ficam no próprio site (sem pedidos aos servidores do Google), por privacidade (RGPD) e rapidez.
- Os quatro ficheiros de `js/` são scripts simples, carregados por esta ordem pelo `index.html`. Cada um tem uma só função; `analise.js` e `instrumentos.js` não tocam na página nem no leitor, só recebem dados e devolvem números ou desenham.
- Para cada MP3 publicado existe ao lado um ficheiro `nome.onda.json` com a duração e a forma de onda. É gerado pela automação ao publicar; não se edita nem se guarda no repositório.

## 4. Conteúdo — `conteudo.js`

O ficheiro define um único objeto global. Formato:

```js
window.CONTEUDO = {
  nome: "Afonso Duarte",
  local: "Cidade, País",
  contacto: {
    email: "endereco@exemplo.pt",
    redes: [
      { nome: "Instagram", url: "https://..." }
    ]
  },
  sobre: {
    daws: ["DAW principal", "Outra DAW"],
    formacao: [
      { titulo: "Orquestra do Colégio Militar", periodo: "2013–2021" }
    ],
    tecnicas: ["Técnica", "Técnica"]
  },
  categorias: {
    instrumentais: {
      descricao: "Uma frase opcional.",
      faixas: [
        { titulo: "Nome", genero: "Género", ano: 2026, ficheiro: "audio/instrumentais/nome.mp3" }
      ]
    },
    mistura: {
      descricao: "Ouve cada trabalho antes e depois da mistura.",
      faixas: [
        { artista: "Artista", titulo: "Faixa", servico: "Mistura e master", ano: 2026,
          antes: "audio/mistura/faixa-antes.mp3", depois: "audio/mistura/faixa-depois.mp3" }
      ]
    },
    cinematografico: {
      descricao: "Uma frase opcional.",
      faixas: [
        { titulo: "Projeto", tipo: "Curta-metragem", ano: 2026, ficheiro: "audio/cinematografico/projeto.mp3" }
      ]
    }
  }
};
```

Regras:
- Campos em falta são omitidos na página (não aparecem vazios nem como `undefined`). Só `titulo` e o(s) ficheiro(s) são obrigatórios.
- A linha de detalhes de cada faixa junta os campos presentes com « · »: instrumentais `genero · ano`; mistura `servico · ano`; cinematográfico `tipo · ano`.
- Na mistura, o título mostrado é «Artista — Faixa» (ou só «Faixa» sem artista).
- Uma categoria sem faixas não aparece (nem a secção nem a entrada no índice). A numeração 01/02/03 acompanha as categorias visíveis.
- Os contadores do índice são calculados: «1 faixa» / «N faixas» (instrumentais), «N trabalhos» (mistura), «N projetos» (cinematográfico).
- Listas vazias em «Sobre» escondem esse tópico; se os três estiverem vazios, a secção desaparece.
- O leitor não precisa de mais nenhum campo: não há BPM nem MIDI a indicar.

## 5. Página

Ordem, tal como no mockup B:

1. **Cabeçalho** — nome (serifado, 26 px) à esquerda; navegação «Trabalhos · Sobre · Contacto» à direita.
2. **Topo** — título «Produção *musical*» (serifado, até 156 px, «musical» em itálico); por baixo, «Instrumentais, mistura e masterização, áudio cinematográfico — por {nome}.» e, à direita, o `local` em maiúsculas pequenas. Linha preta a fechar.
3. **Índice de categorias** — três colunas (uma no telemóvel): número, nome serifado, contador. Cada uma liga à sua secção.
4. **Secções das categorias** — à esquerda: número, nome (48 px), descrição; à direita: lista de faixas. Cada linha: botão play/pausa redondo (44 px), título serifado (28 px), detalhes (13 px, cinzento) e, à direita, a duração. Na mistura, o seletor «Antes | Depois» fica antes da duração. A faixa ativa abre por baixo o painel de instrumentos (secção 6).
5. **Sobre** — título «Sobre» à esquerda; à direita, três colunas: DAWs, Formação (título + período em cinzento), Técnicas.
6. **Rodapé / Contacto** — «CONTACTO» em maiúsculas pequenas; e-mail grande em serifado itálico (ligação `mailto:`); linha com as redes sociais (abrem noutro separador) e «© {ano atual} {nome}».

Visual:
- Cores: fundo `#FFFFFF`; texto `#111111`; texto secundário `#5C5C5C` (contraste 6,7:1); subtítulo `#3D3D3D`; linhas `#E3E3E3`; linhas fortes `#111111`; cinzento dos gráficos `#C9C9C9` (só em desenhos, nunca em texto). Tudo a preto e branco, sem cor de destaque.
- Fontes: Instrument Serif (títulos, faixas, e-mail), Inter 400/500 (texto, navegação, detalhes) e IBM Plex Mono 400/500 (rótulos dos instrumentos, leituras e tempos).
- Largura máxima de conteúdo 1120 px com 24 px de margem lateral; secções com 72 px de espaço vertical.
- Deslocamento suave para as âncoras. A única animação é a dos instrumentos enquanto a faixa toca.

## 6. Leitor de áudio

### 6.1 Reprodução

Estados de uma faixa: **parada**, **a tocar**, **em pausa**, **indisponível**.

- Só toca uma faixa de cada vez. Carregar em play noutra faixa para a anterior, volta a pô-la no início e fecha o painel dela.
- Faixa a tocar ou em pausa (a faixa **ativa**): botão preto preenchido (ícone de pausa ou play), painel aberto e, no lugar da duração, o tempo «0:42 / 3:15».
- O som começa logo: o MP3 é transmitido à medida que toca, sem esperar pelo ficheiro inteiro.
- Duração e forma de onda vêm do ficheiro `nome.onda.json`, pedido quando a página abre (são ficheiros de poucos kB). Enquanto não chega, a duração mostra «—:—». Na mistura, a duração mostrada é a da versão «Depois».
- Fim da faixa: volta ao estado parada, com o painel fechado. Não passa sozinho para a seguinte.
- Erro ao carregar um MP3 (inexistente ou inválido): a linha mostra «Indisponível» no lugar da duração, o botão fica desativado e o resto da página continua a funcionar. Na mistura, basta faltar uma das versões para o trabalho ficar indisponível.

### 6.2 Painel de instrumentos

Igual em todas as faixas e categorias. De cima para baixo:

1. **Forma de onda** (56 px de altura, a toda a largura) — a faixa inteira em barras de 2 px com 1 px de intervalo; a parte já tocada a preto, o resto a cinzento `#C9C9C9`; um cursor vertical marca a posição. Clicar ou arrastar muda a posição; durante o arrasto o som pausa e retoma ao largar.
2. **Espectro** (à esquerda, largo) e **Campo estéreo** (à direita, quadrado de 208 px), cada um com o seu rótulo em letra mono. No telemóvel ficam um por baixo do outro.
   - *Espectro*: 44 barras pretas, em escala logarítmica de 32 Hz a 16 kHz, com marcas em 100, 1k e 10k Hz. Cada barra deixa uma marca de pico cinzenta que desce devagar. O desenho é compensado em +4,5 dB por oitava, como nos analisadores de mistura, para a música aparecer equilibrada.
   - *Campo estéreo*: losango com M no topo e L e R nos lados de cima. Cada ponto é um par de amostras (esquerda, direita) dos últimos 20 ms: som ao centro desenha uma linha vertical, som largo abre para os lados. Os pontos deixam um rasto que desaparece em cerca de 0,2 s. O desenho é ampliado 1,5× e limitado ao losango.
3. **Leituras**, numa linha, com rótulo em cima e valor por baixo (secção 6.3).

Os instrumentos só são desenhados enquanto a faixa toca e o separador está visível. Em pausa ficam parados na última imagem.

### 6.3 Leituras

| Leitura | O que mede |
|---|---|
| **Nível** | Barra horizontal: RMS dos últimos 45 ms, de −48 a 0 dB. Uma marca fina guarda o máximo recente durante 0,75 s e depois desce. |
| **Pico** | Maior amostra dos últimos 3 s, em dB. |
| **RMS** | Média dos dois canais numa janela de 300 ms, em dB. |
| **LUFS** | Loudness momentâneo: janela de 400 ms com a ponderação K da norma ITU-R BS.1770. |
| **Correlação** | Correlação entre os canais esquerdo e direito em 300 ms, de −1 a +1. |

- Os valores atualizam 10 vezes por segundo e escrevem-se à portuguesa: vírgula decimal, sinal «−», uma casa decimal («−13,0»); a correlação tem duas casas e sinal sempre («+0,83»).
- Antes de haver som, ou em silêncio, mostram «—».
- Referência para os testes: um seno de 1 kHz a −20 dB nos dois canais tem de dar Pico −20,0, RMS −23,0, LUFS −20,0 e Correlação +1,00.

### 6.4 Antes / Depois (mistura e masterização)

- Começa sempre em «Depois».
- Trocar de versão durante a reprodução continua no mesmo ponto, sem parar, com uma passagem de 30 ms entre as duas.
- A forma de onda passa a ser a da versão escolhida e o Pico recomeça a contar, para a diferença se ver logo nas leituras.
- Trocar com a faixa parada só muda a versão que vai tocar.
- As duas versões só começam a carregar quando a faixa toca pela primeira vez.

### 6.5 Modo simples

O painel reduz-se a uma linha de progresso fina (onde se clica para mudar a posição) e ao tempo, sem instrumentos nem leituras, quando:

- o browser não permite analisar o som;
- a página é aberta diretamente do disco, com duplo clique no `index.html` (os browsers bloqueiam a análise de ficheiros locais);
- é um iPhone ou iPad com iOS anterior a 16.4, onde a análise faria o som depender do botão de silêncio.

Outros casos:

- Falta o `nome.onda.json` de uma faixa: a forma de onda dá lugar à linha de progresso fina; o resto do painel funciona.
- «Reduzir movimento» ativo no sistema: o espectro e o campo estéreo não aparecem; ficam a forma de onda e as leituras, atualizadas 2 vezes por segundo.
- iPhone em modo silencioso (iOS 16.4 ou posterior): o som toca na mesma.

## 7. Telemóvel e acessibilidade

- A 640 px de largura ou menos tudo passa a uma coluna; nenhuma deslocação horizontal, com o painel aberto ou fechado.
- Botões reais (`<button>`) com `aria-label` («Ouvir {título}», «Pausar {título}»); o seletor Antes/Depois usa `aria-pressed`.
- A forma de onda é um controlo de posição (`role="slider"`, rótulo «Posição na faixa»): setas avançam ou recuam 5 % da faixa (no mínimo 1 s), Home e End vão para o início e o fim.
- Os desenhos dos instrumentos são decorativos para leitores de ecrã (`aria-hidden`); as leituras são texto, mas não são anunciadas a cada atualização.
- Alvos de toque de pelo menos 44 px; contraste mínimo 4,5:1 em todo o texto.
- Foco visível em todos os elementos interativos.
- `lang="pt-PT"`, `<title>` «{nome} — Produção musical» e `<meta name="description">`.

## 8. Publicação

- O trabalho é feito no ramo `claude/quirky-johnson-w78lqq` e junta-se ao `main` quando o Afonso aprovar.
- Cada alteração no `main` arranca a automação **Publicar** (GitHub Actions), que faz três coisas por ordem:
  1. **Verifica o conteúdo** (`ferramentas/verificar-conteudo.mjs`): falha se o `conteudo.js` tiver um erro de escrita, campos ainda entre [parênteses retos] ou MP3 indicados que não existem. As mensagens dizem em português o que falta e em que faixa.
  2. **Prepara as formas de onda** (`ferramentas/gerar-ondas.mjs`): para cada MP3 cria o `nome.onda.json`, no formato `{"duracao": 213.42, "picos": [...]}`, com a duração em segundos e 800 valores de pico inteiros de 0 a 255. Se um MP3 não puder ser lido, avisa e continua; essa faixa fica sem forma de onda.
  3. **Publica** só os ficheiros do site: `index.html`, `estilo.css`, `conteudo.js`, `js/`, `audio/` e `fontes/`.
- Se a verificação falhar, nada é publicado: o site fica como estava e o GitHub envia um e-mail a avisar. O erro lê-se no separador **Actions** do repositório.
- Configuração, uma só vez, feita pelo Afonso: Settings → Pages → Source → **GitHub Actions**.
- Endereço: https://cfvvhzt2gv-wq.github.io/portfolio.
- Limite prático: cada MP3 abaixo de 100 MB (limite do GitHub); o repositório idealmente abaixo de 1 GB.

## 9. Testes e verificação

Correm com `node --test --test-concurrency=1` (um ficheiro de cada vez). Usam um conteúdo de teste e ficheiros de áudio curtos gerados pelos próprios testes (senos com níveis conhecidos).

**Medições** (funções de `analise.js`, sem browser):
- seno de 1 kHz a −20 dB nos dois canais: Pico −20,0 ± 0,1; RMS −23,0 ± 0,1; LUFS −20,0 ± 0,2; Correlação +1,00;
- o mesmo seno com um canal invertido: Correlação −1,00;
- o mesmo seno só num canal: LUFS −23,0 ± 0,2;
- silêncio: todas as leituras dão «—»;
- a forma de onda de um ficheiro conhecido tem o número de barras pedido e os máximos certos.

**Ferramentas:**
- `verificar-conteudo.mjs` falha com [parênteses retos], com um MP3 em falta e com um erro de escrita; passa com conteúdo completo;
- `gerar-ondas.mjs` cria, para um ficheiro de teste, a duração certa (± 0,05 s) e 800 valores.

**Página e leitor** (com Playwright, já disponível no ambiente de desenvolvimento, e um pequeno servidor local em Node):
- a página mostra as três categorias pela ordem certa, com os contadores certos;
- uma categoria sem faixas não aparece, nem no índice;
- campos em falta não deixam «undefined» nem separadores soltos;
- «Sobre» mostra DAWs, Formação e Técnicas por esta ordem;
- tocar uma faixa abre o painel só nessa faixa; tocar outra deixa só a segunda a tocar e fecha o painel da primeira;
- com um seno de −20 dB a tocar, as leituras mostram LUFS −20,0 ± 0,5 e Correlação +1,00;
- Antes/Depois mantém a posição (diferença inferior a 0,3 s), continua a tocar e muda o LUFS de acordo com os dois ficheiros de teste (12 dB de diferença, ± 1);
- clicar a meio da forma de onda põe a faixa a meio (± 0,5 s);
- um MP3 inexistente mostra «Indisponível» e não afeta as outras faixas;
- sem `nome.onda.json`, a faixa toca e deixa mudar a posição na linha de progresso;
- com «reduzir movimento», o painel não tem espectro nem campo estéreo, mas tem leituras;
- a 390 px de largura não há deslocação horizontal, com o painel aberto.

**À mão, antes de publicar pela primeira vez:** ouvir o site num iPhone real, com e sem modo silencioso, e num computador.

## 10. Conteúdo a fornecer pelo Afonso

- DAWs (e qual é a principal) e técnicas.
- Local (cidade, país) — ou deixar em branco.
- E-mail de contacto e ligações das redes sociais.
- Para cada faixa: MP3 e os campos da secção 4; na mistura, as versões antes e depois.
- Opcional: uma frase de descrição por categoria.

## 11. Fora de âmbito

Vídeo, outras línguas, modo escuro, cor de destaque, leitor fixo no fundo do ecrã, reprodução contínua, painel de administração, estatísticas de visitas, formulário de contacto, domínio próprio (pode juntar-se mais tarde sem mudar o site). Do protótipo ficam de fora os instrumentos das opções 1 e 3: rolo de piano, órbita do compasso e bandas impressas. Nas medições ficam de fora o LUFS integrado e o pico verdadeiro (true peak).
