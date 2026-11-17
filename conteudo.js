/*
  CONTEÚDO DO SITE — este é o único ficheiro que precisas de editar.

  Como editar
  - Substitui tudo o que está entre [parênteses retos] pelo teu texto, sem os parênteses.
    Enquanto houver [parênteses retos] por preencher, o site não é publicado.
  - Para esconder um campo opcional (o local, o género, o ano, o tipo...), apaga a linha inteira dele.
    O título e o(s) ficheiro(s) de cada faixa nunca se apagam: sem eles a faixa desaparece do site.
  - Numa lista (as DAWs, as técnicas), apaga só o item que não queres, com a vírgula a seguir:
    ["Logic Pro", "Outra DAW"] passa a ["Logic Pro"].
  - Mantém as aspas "..." e a vírgula no fim de cada linha.
  - Se um texto tiver aspas, usa « » ou ’ em vez de " (senão o ficheiro deixa de funcionar).
  - O ano pode ser um número (2026) ou um texto ("2026").

  Como acrescentar uma faixa
  1. Copia o MP3 para a pasta certa: audio/instrumentais/, audio/mistura/ ou audio/cinematografico/.
  2. Na lista "faixas" da categoria, copia um bloco { ... } inteiro, cola-o a seguir (com uma vírgula
     entre blocos) e muda os textos e o nome do ficheiro.
  Na mistura e masterização cada trabalho tem dois ficheiros: "antes" e "depois".

  Em cada faixa só o título e o(s) ficheiro(s) são obrigatórios.
  Uma categoria sem faixas não aparece no site.
*/
window.CONTEUDO = {
  nome: "Afonso Duarte",
  local: "Lisboa, Portugal",
  contacto: {
    email: "afonsodu03@gmail.com",
    redes: [
      { nome: "Instagram", url: "https://www.instagram.com/afonso_ro_duarte/" },
    ],
  },
  sobre: {
    daws: ["Pro Tools", "FL Studio", "REAPER"],
  },
  categorias: {
    instrumentais: {
      faixas: [
        { titulo: "Carpe Diem", ficheiro: "audio/instrumentais/carpe diem.mp3" },
        { titulo: "Grau", ficheiro: "audio/instrumentais/grau.mp3" },
        { titulo: "MDV", ficheiro: "audio/instrumentais/mdv.mp3" },
        { titulo: "Xkzito", ficheiro: "audio/instrumentais/xkzito.mp3" },
      ],
    },
    mistura: {
      descricao: "Projetos feitos no âmbito do curso Técnico de Som na 35mm",
      faixas: [
        {
          titulo: "(Mix e Master) Canção Teste",
          antes: "audio/mistura/antes-mistura-e-masterizacao-cancaoteste.mp3",
          depois: "audio/mistura/mistura-e-marsterizacao-cancao-teste.mp3",
        },
        {
          titulo: "(Mix e Master) Kat Wright - By My Side",
          antes: "audio/mistura/antes-mistura-e-masterizacao-bymyside.mp3",
          depois: "audio/mistura/mistura-e-masterizacao-by-my-side.mp3",
        },
        {
          titulo: "(Mix) Hurray For The Riff Raff - Living In The City",
          antes: "audio/mistura/antes-mistura-livinginthecity.mp3",
          depois: "audio/mistura/mistura-living-in-the-city.mp3",
        },
      ],
    },
    cinematografico: {
      faixas: [
        { titulo: "Mixed Feelings", ficheiro: "audio/cinematografico/mixed-feelings.mp3" },
      ],
    },
  },
};
