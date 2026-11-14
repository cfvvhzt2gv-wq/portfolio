# Portfólio de produção musical — especificação

Data: 2026-11-14 · Estado: para revisão

## 1. Objetivo

Um site minimalista, de uma só página, que apresenta as produções do Afonso Duarte e deixa ouvi-las de imediato. Público: potenciais clientes e artistas. O site tem sucesso se, em poucos segundos, quem o visita percebe o que o Afonso faz, consegue ouvir os trabalhos de cada categoria e sabe como o contactar.

## 2. Decisões tomadas

- Design: opção **B · Ficha técnica** (claro, editorial, serifado), com as alterações pedidas. Mockup: https://claude.ai/artifact/VyWxEc2S4zVYcwpyzY8b7a (privado).
- Ordem das categorias: **01 Instrumentais**, **02 Mistura e masterização**, **03 Áudio cinematográfico**.
- Secção «Sobre» sem texto corrido: só três tópicos, por esta ordem — **DAWs**, **Formação**, **Técnicas**.
- Sem vídeos. Todas as categorias são listas de faixas de áudio.
- Áudio em ficheiros **MP3** alojados no próprio site (recomendado 320 kbps; WAV não).
- Mistura e masterização com botão **Antes / Depois**.
- Alojamento: **GitHub Pages**, neste repositório (`cfvvhzt2gv-wq/portfolio`), separado do repositório `cv`.
- Tecnologia: HTML, CSS e JavaScript simples. Sem frameworks, sem passo de compilação, sem dependências em produção.
- Idioma: só português (pt-PT).

## 3. Estrutura de ficheiros

```
index.html          página (estrutura fixa: cabeçalho, topo, secções vazias, rodapé)
estilo.css          todo o estilo
leitor.js           lê o conteúdo, preenche a página e controla o áudio
conteudo.js         ÚNICO ficheiro a editar: faixas, DAWs, técnicas, contactos
audio/
  instrumentais/    MP3 dos instrumentais
  mistura/          MP3 «antes» e «depois» de cada trabalho
  cinematografico/  MP3 do áudio cinematográfico
fontes/             Instrument Serif e Inter (woff2), alojadas no próprio site
_config.yml         exclui docs/, tests/ e README.md do site publicado
tests/              testes automáticos e verificação do conteúdo (não publicados)
docs/               esta especificação e o plano (não publicados)
README.md           como acrescentar uma faixa e como publicar
```

As fontes ficam no próprio site (sem pedidos aos servidores do Google), por privacidade (RGPD) e rapidez.

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

## 5. Página

Ordem, tal como no mockup B:

1. **Cabeçalho** — nome (serifado, 26 px) à esquerda; navegação «Trabalhos · Sobre · Contacto» à direita.
2. **Topo** — título «Produção *musical*» (serifado, até 156 px, «musical» em itálico); por baixo, «Instrumentais, mistura e masterização, áudio cinematográfico — por {nome}.» e, à direita, o `local` em maiúsculas pequenas. Linha preta a fechar.
3. **Índice de categorias** — três colunas (uma no telemóvel): número, nome serifado, contador. Cada uma liga à sua secção.
4. **Secções das categorias** — à esquerda: número, nome (48 px), descrição; à direita: lista de faixas. Cada linha: botão play/pausa redondo (44 px), título serifado (28 px), detalhes (13 px, cinzento), duração à direita. Na mistura, a duração dá lugar ao seletor «Antes | Depois».
5. **Sobre** — título «Sobre» à esquerda; à direita, três colunas: DAWs, Formação (título + período em cinzento), Técnicas.
6. **Rodapé / Contacto** — «CONTACTO» em maiúsculas pequenas; e-mail grande em serifado itálico (ligação `mailto:`); linha com as redes sociais (abrem noutro separador) e «© {ano atual} {nome}».

Visual:
- Cores: fundo `#FFFFFF`; texto `#111111`; texto secundário `#5C5C5C` (contraste 6,7:1); subtítulo `#3D3D3D`; linhas `#E3E3E3`; linhas fortes `#111111`.
- Fontes: Instrument Serif (títulos, faixas, e-mail) e Inter 400/500 (texto, navegação, detalhes).
- Largura máxima de conteúdo 1120 px com 24 px de margem lateral; secções com 72 px de espaço vertical.
- Deslocamento suave para as âncoras. Sem animações além disso.

## 6. Leitor de áudio

Estados de uma faixa: **parada**, **a tocar**, **em pausa**, **indisponível**.

- Só toca uma faixa de cada vez. Carregar em play noutra faixa pausa a anterior e volta a pô-la no início.
- Faixa a tocar ou em pausa: botão preto preenchido (ícone de pausa ou play); aparece por baixo da linha uma barra de progresso fina e o tempo «0:42 / 3:15». A barra é um `<input type="range">` com rótulo «Posição na faixa», por isso funciona com rato, toque e teclado.
- Duração: lida do próprio MP3 com `preload="metadata"` (só o início do ficheiro); o ficheiro completo só é descarregado ao carregar em play. Enquanto não se sabe, mostra «—:—».
- Fim da faixa: volta ao estado parada. Não passa sozinho para a seguinte.
- **Antes / Depois** (mistura): começa sempre em «Depois». Trocar de versão durante a reprodução continua no mesmo segundo, sem parar. Trocar com a faixa parada só muda a versão que vai tocar. As duas versões só carregam quando a faixa começa a tocar.
- Erro ao carregar um ficheiro (inexistente ou inválido): a linha mostra «Indisponível» no lugar da duração, o botão fica desativado e o resto da página continua a funcionar. Na mistura, basta faltar uma das versões para o trabalho ficar indisponível.

## 7. Telemóvel e acessibilidade

- A 640 px de largura ou menos tudo passa a uma coluna; nenhuma deslocação horizontal.
- Botões reais (`<button>`) com `aria-label` («Ouvir {título}», «Pausar {título}»); o seletor Antes/Depois usa `aria-pressed`.
- Alvos de toque de pelo menos 44 px; contraste mínimo 4,5:1 em todo o texto.
- Foco visível em todos os elementos interativos.
- `lang="pt-PT"`, `<title>` «{nome} — Produção musical» e `<meta name="description">`.

## 8. Publicação

- O trabalho é feito no ramo `claude/quirky-johnson-w78lqq`. Junta-se ao `main` só quando o Afonso aprovar **e** a verificação do conteúdo (secção 9) passar.
- GitHub Pages: Settings → Pages → «Deploy from a branch» → `main` / `(root)`. Endereço: https://cfvvhzt2gv-wq.github.io/portfolio.
- `_config.yml` exclui `docs/`, `tests/` e `README.md` do site publicado.
- Limite prático: cada MP3 abaixo de 100 MB (limite do GitHub); o repositório idealmente abaixo de 1 GB.

## 9. Testes e verificação

**Testes automáticos** (`node --test tests/`), com Playwright (já disponível no ambiente de desenvolvimento) e um pequeno servidor local em Node, sem outras dependências. Usam um conteúdo de teste e ficheiros de áudio curtos gerados pelos próprios testes:

- a página mostra as três categorias pela ordem certa, com os contadores certos;
- uma categoria sem faixas não aparece, nem no índice;
- campos em falta não deixam «undefined» nem separadores soltos;
- «Sobre» mostra DAWs, Formação e Técnicas por esta ordem;
- tocar uma faixa e depois outra deixa só a segunda a tocar;
- Antes/Depois mantém a posição (diferença inferior a 0,3 s) e continua a tocar;
- um ficheiro inexistente mostra «Indisponível» e não afeta as outras faixas;
- a 390 px de largura não há deslocação horizontal.

**Verificação do conteúdo** (`node tests/verificar-conteudo.mjs`), a correr antes de publicar: falha se `conteudo.js` ainda tiver campos entre [parênteses retos] ou se algum ficheiro MP3 indicado não existir.

## 10. Conteúdo a fornecer pelo Afonso

- DAWs (e qual é a principal) e técnicas.
- Local (cidade, país) — ou deixar em branco.
- E-mail de contacto e ligações das redes sociais.
- Para cada faixa: MP3 e os campos da secção 4; na mistura, as versões antes e depois.
- Opcional: uma frase de descrição por categoria.

## 11. Fora de âmbito

Vídeo, outras línguas, modo escuro, leitor fixo no fundo do ecrã, reprodução contínua, painel de administração, estatísticas de visitas, formulário de contacto, domínio próprio (pode juntar-se mais tarde sem mudar o site).
