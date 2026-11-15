/*
  CONTEÚDO DO SITE — este é o único ficheiro que precisas de editar.

  Como editar
  - Substitui tudo o que está entre [parênteses retos] pelo teu texto, sem os parênteses.
    Enquanto houver [parênteses retos] por preencher, o site não é publicado.
  - Se não quiseres mostrar um campo (o local, o género, o ano...), apaga essa linha.
  - Mantém as aspas "..." e a vírgula no fim de cada linha.
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
  local: "[Cidade, País]",
  contacto: {
    email: "[endereco@exemplo.pt]",
    redes: [
      { nome: "[Instagram]", url: "[https://...]" },
      { nome: "[SoundCloud]", url: "[https://...]" },
      { nome: "[YouTube]", url: "[https://...]" },
    ],
  },
  sobre: {
    daws: ["[DAW principal]", "[Outra DAW]"],
    formacao: [
      { titulo: "Orquestra do Colégio Militar", periodo: "2013–2021" },
    ],
    tecnicas: ["[Técnica]", "[Técnica]", "[Técnica]"],
  },
  categorias: {
    instrumentais: {
      descricao: "[Uma frase sobre os teus instrumentais.]",
      faixas: [
        { titulo: "[Nome da faixa]", genero: "[Género]", ano: "[Ano]", ficheiro: "[audio/instrumentais/ficheiro.mp3]" },
      ],
    },
    mistura: {
      descricao: "[Ouve cada trabalho antes e depois da mistura.]",
      faixas: [
        {
          artista: "[Artista]", titulo: "[Faixa]", servico: "[Mistura e master]", ano: "[Ano]",
          antes: "[audio/mistura/faixa-antes.mp3]", depois: "[audio/mistura/faixa-depois.mp3]",
        },
      ],
    },
    cinematografico: {
      descricao: "[Uma frase sobre o teu áudio cinematográfico.]",
      faixas: [
        { titulo: "[Título do projeto]", tipo: "[Tipo de projeto]", ano: "[Ano]", ficheiro: "[audio/cinematografico/ficheiro.mp3]" },
      ],
    },
  },
};
