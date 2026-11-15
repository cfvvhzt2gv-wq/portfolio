# Portfólio de produção musical — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o site de portfólio de uma só página, com leitor de áudio e painel de instrumentos, e a automação do GitHub que verifica o conteúdo, prepara as formas de onda e publica no GitHub Pages.

**Architecture:** Quatro scripts clássicos em `js/` (`analise` → `instrumentos` → `leitor` → `pagina`) partilham `window.Portfolio`; cada um exporta também por `module.exports`, para os testes em Node. `conteudo.js` define `window.CONTEUDO`; `pagina.js` transforma-o num modelo puro (`preparar`), monta o DOM e liga o leitor ao painel. Duas ferramentas Node (`.mjs`) verificam o conteúdo e geram `nome.onda.json` com o ffmpeg; um workflow do GitHub Actions encadeia-as e publica.

**Tech Stack:** HTML, CSS e JavaScript clássico (sem frameworks nem compilação); Web Audio API e Canvas 2D; Node 22 (`node:test`, `vm`, `child_process`); Playwright (já instalado) para os testes de página; ffmpeg; GitHub Actions e Pages.

**Spec:** `docs/superpowers/specs/2026-11-14-portfolio-design.md` (aprovado). Referências visuais aprovadas: `docs/referencias/` (ver o `LEIA-ME.md`). O `leitor-prototipo.html` já tem o código de desenho e o CSS do painel; as tarefas 3 e 5 portam-no.

**Desvio do spec (corrigido na Tarefa 1):** o §9 manda correr `node --test tests/`. No Node 22 esse comando falha (trata `tests/` como um ficheiro). Usa-se `node --test`, sem argumentos.

## Global Constraints

- Scripts clássicos, não módulos, carregados com `defer` por esta ordem: `conteudo.js`, `js/analise.js`, `js/instrumentos.js`, `js/leitor.js`, `js/pagina.js`. Sem frameworks, sem dependências em produção, sem compilação.
- Cada ficheiro de `js/` usa este invólucro (a dependência de outro módulo obtém-se com `raiz.Analise || require('./analise.js')`):
  ```js
  (function (raiz) {
    const Modulo = { /* … */ };
    raiz.Modulo = Modulo;
    if (typeof module === 'object' && module.exports) module.exports = Modulo;
  })(typeof window !== 'undefined' ? (window.Portfolio = window.Portfolio || {}) : {});
  ```
- Texto vindo do conteúdo entra no DOM só com `textContent` / `createElement`, nunca com `innerHTML`.
- Interface em pt-PT; `lang="pt-PT"`; `<title>` «{nome} — Produção musical»; `<meta name="description">`.
- Números à portuguesa: vírgula decimal, sinal «−» (U+2212), uma casa decimal («−13,0»); correlação com duas casas e sinal sempre («+0,83»); sem valor, «—».
- Cores: fundo `#FFFFFF`, texto `#111111`, secundário `#5C5C5C`, subtítulo `#3D3D3D`, linhas `#E3E3E3`, `#C9C9C9` só em desenhos. Sem cor de destaque e sem modo escuro.
- Fontes alojadas em `fontes/`: Instrument Serif, Inter 400/500, IBM Plex Mono 400/500. Nenhum pedido a servidores externos.
- Largura máxima 1120 px, margem lateral 24 px, secções com 72 px; a 640 px ou menos uma só coluna; nunca deslocação horizontal.
- Botões reais, alvos de toque ≥ 44 px, contraste ≥ 4,5:1, foco visível; os `<canvas>` levam `aria-hidden="true"`.
- Painel: forma de onda de 56 px (barras de 2 px, intervalo de 1 px); espectro de 44 barras, 32 Hz a 16 kHz, +4,5 dB por oitava; campo estéreo de 208 px, janela de 20 ms, ampliação 1,5×, rasto ≈ 0,2 s.
- Leituras (atualizam 10 vezes por segundo): Nível (RMS de 45 ms, −48 a 0 dB, marca 0,75 s), Pico (3 s), RMS (300 ms), LUFS momentâneo (400 ms, ponderação K), Correlação (300 ms).
- Antes/Depois: começa em «Depois»; troca em 30 ms, no mesmo ponto.
- Modo simples quando o protocolo é `file:`, não há Web Audio, ou é iOS sem `navigator.audioSession` (iOS < 16.4).
- A automação publica só `index.html estilo.css conteudo.js js/ audio/ fontes/`. Cada MP3 abaixo de 100 MB.
- Testes: `node --test` (nunca `node --test tests/`); ficheiros `tests/*.test.cjs`; Chromium com `--autoplay-policy=no-user-gesture-required`.
- Commits com assunto em inglês (`feat:`, `test:`, `docs:`), corpo terminado pelas linhas de atribuição que a sessão exigir. Depois de cada commit: `git -c push.negotiate=true push -u origin claude/quirky-johnson-w78lqq`.

## Review Focus

1. **Texto do conteúdo com `<`, `&` e aspas** (ex.: «`<b>x</b> & "y"`» num título, no nome ou numa rede): aparece como texto literal, nunca como HTML. (Tarefa 2)
2. **Corrida entre faixas:** clicar noutra faixa, ou duas vezes no mesmo play, antes de a primeira começar a tocar. Só uma toca, nenhuma fica «Indisponível» por engano (um `pause()` a seguir a `play()` rejeita com `AbortError`; apagar o `src` de um elemento dispara `error`) e não há erros na consola. (Tarefas 4 e 5)
3. **`nome.onda.json` presente mas inválido** (JSON partido, `duracao` não numérica, menos ou mais de 800 picos, picos fora de 0–255): tratado como em falta; a faixa toca e a linha de progresso funciona. (Tarefa 5)
4. **Posição extrema na procura:** carregar em End, procurar além do fim ou clicar no extremo direito da onda. A faixa termina em ordem, sem erro e sem deixar o painel preso aberto. (Tarefas 4 e 5)
5. **Título com 80 caracteres sem espaços, janela estreita ou rodada com o painel aberto:** sem deslocação horizontal e com os canvases a acompanhar o novo tamanho; deslizar na vertical sobre a forma de onda continua a deslocar a página (`touch-action: pan-y`). (Tarefa 5)

## Estrutura de ficheiros

```
index.html  estilo.css  conteudo.js  .gitignore  README.md
js/analise.js  js/instrumentos.js  js/leitor.js  js/pagina.js
fontes/                       6 ficheiros woff2 + 3 licenças OFL
ferramentas/verificar-conteudo.mjs  ferramentas/gerar-ondas.mjs
.github/workflows/publicar.yml
tests/apoio/{servidor,navegador,sinal,conteudo}.cjs                      ajudas de teste
tests/{analise,pagina,instrumentos,leitor,painel,verificar-conteudo,gerar-ondas,publicacao}.test.cjs
docs/referencias/             já commitado com este plano
```

### Ajudas de teste (criadas na primeira tarefa que as usa; contratos fixos)

- `tests/apoio/servidor.cjs`: `iniciarServidor({ conteudo?: string, ficheiros?: { [caminho: string]: Buffer | string } }) → Promise<{ url: string, fechar(): Promise<void> }>`. Serve os ficheiros reais da raiz do repositório (sem sair dela); `/conteudo.js` vem da opção `conteudo` quando existe; `ficheiros` (chaves como `/audio/a.mp3`) têm prioridade. Suporta pedidos `Range` (resposta 206) e `.mp3` vindo de `ficheiros` é enviado como `audio/wav`. Tudo o resto: 404.
- `tests/apoio/navegador.cjs`: `comPagina(opcoes, fn) → Promise<T>` (devolve o que `fn` devolver), com `opcoes = { conteudo?: string, ficheiros?: object, pagina = '/index.html', ficheiro?: string, largura = 1280, altura = 900, movimentoReduzido = false }`. Abre Chromium, corre `fn(page, { url, erros, externos, pedidos })` e fecha no `finally`. `ficheiro` é um caminho absoluto aberto por `file://` (sem servidor). `erros`: `pageerror` e `console.error`, exceto os que começam por «Failed to load resource»; `externos`: pedidos `http(s)` para fora do servidor de teste; `pedidos`: URL de todos os pedidos feitos até ao momento (o array vai crescendo).
- `tests/apoio/conteudo.cjs`: `base() → objeto` com nome «Ana Teste», local «Lisboa, Portugal», e-mail `ana@exemplo.pt`, uma rede, «Sobre» com 2 DAWs, 1 formação e 2 técnicas, e uma faixa por categoria (`audio/i1.mp3`; mistura com `audio/m1-antes.mp3` e `audio/m1-depois.mp3`; `audio/c1.mp3`); `comoJs(objeto) → string` (`window.CONTEUDO = …;`).
- `tests/apoio/sinal.cjs`: `wav({ segundos = 6, db = -20, esqDb = db, dirDb = db, inverterDir = false, taxa = 44100 }) → Buffer` (seno de 1 kHz, PCM 16 bits estéreo; `null` num canal = silêncio); `onda({ segundos = 6, db = -20 }) → string` (JSON `{"duracao", "picos"}` com 800 picos iguais); `faixasTeste({ semOnda = false }) → { [caminho]: Buffer | string }` com os quatro MP3 de `base()` (6 s; o «antes» a −32 dB, os outros a −20 dB) e os respetivos `.onda.json` com o mesmo nível.

---

### Task 1: Medições do som (`js/analise.js`)

**Files:**
- Create: `js/analise.js`
- Test: `tests/analise.test.cjs`
- Modify: `docs/superpowers/specs/2026-11-14-portfolio-design.md` (§9, primeira linha: `node --test tests/` → `node --test`)

**Interfaces:**
- Consumes: nada.
- Produces `Portfolio.Analise` (e `module.exports`):
  ```
  NUM_BANDAS = 44
  criarMedidor(taxa: number): Medidor
    Medidor.atualizar(esq: Float32Array, dir: Float32Array, agora: number): Leituras
        // amostras mais recentes no fim; `agora` em segundos, crescente
    Medidor.reiniciarPico(): void
    Leituras = { nivel: number, marcaNivel: number,                      // 0–1
                 picoDb: number|null, rmsDb: number|null, lufs: number|null, correlacao: number|null }
  novoEstadoEspectro(): { val: Float32Array(44), pico: Float32Array(44) }
  bandasEspectro(dbBins: Float32Array, taxa: number, estado): void      // dbBins: getFloatFrequencyData (fftSize = 2 × dbBins.length)
  formatarDb(v: number|null, casas = 1): string
  formatarCorrelacao(v: number|null): string
  formatarTempo(seg: number|null): string
  ```

- [ ] **Step 1: Write the failing tests** — `tests/analise.test.cjs`

```js
// tests/analise.test.cjs
const test = require('node:test'), assert = require('node:assert/strict');
const A = require('../js/analise.js');
const seno = (db, taxa = 44100, seg = 1) => Float32Array.from({ length: Math.round(taxa * seg) }, (_, i) => 10 ** (db / 20) * Math.sin(2 * Math.PI * 1000 * i / taxa));
const mudo = (n = 44100) => new Float32Array(n);
const perto = (v, esperado, tol) => assert.ok(Math.abs(v - esperado) <= tol, `${v} ≉ ${esperado} ± ${tol}`);

test('seno de 1 kHz a −20 dB nos dois canais', () => {
  const x = seno(-20), r = A.criarMedidor(44100).atualizar(x, x, 0);
  perto(r.picoDb, -20, 0.1); perto(r.rmsDb, -23, 0.1); perto(r.lufs, -20, 0.2); perto(r.correlacao, 1, 0.01);
});
test('o mesmo seno a 48 kHz', () => { const x = seno(-20, 48000); perto(A.criarMedidor(48000).atualizar(x, x, 0).lufs, -20, 0.2); });
test('canal direito invertido: correlação −1', () => { const x = seno(-20); perto(A.criarMedidor(44100).atualizar(x, x.map(v => -v), 0).correlacao, -1, 0.01); });
test('seno só num canal: LUFS −23', () => { perto(A.criarMedidor(44100).atualizar(seno(-20), mudo(), 0).lufs, -23, 0.2); });
test('silêncio: leituras sem valor e nível 0', () => {
  const r = A.criarMedidor(44100).atualizar(mudo(), mudo(), 0);
  assert.deepEqual([r.picoDb, r.rmsDb, r.lufs, r.correlacao], [null, null, null, null]); assert.equal(r.nivel, 0);
});
test('as leituras lentas atualizam 10 vezes por segundo', () => {
  const m = A.criarMedidor(44100), x = seno(-20);
  perto(m.atualizar(x, x, 0).lufs, -20, 0.2);
  perto(m.atualizar(mudo(), mudo(), 0.05).lufs, -20, 0.2);        // ainda não passaram 0,1 s
  assert.equal(m.atualizar(mudo(), mudo(), 0.11).lufs, null);
});
test('a marca do nível fica 0,75 s e depois desce 0,36 por segundo', () => {
  const m = A.criarMedidor(44100), x = seno(-20), alto = m.atualizar(x, x, 0).nivel;
  perto(m.atualizar(mudo(), mudo(), 0.5).marcaNivel, alto, 1e-6);
  perto(m.atualizar(mudo(), mudo(), 1.5).marcaNivel, alto - 0.27, 0.01);
});
test('o pico guarda os últimos 3 s; reiniciarPico apaga-o', () => {
  const m = A.criarMedidor(44100), x = seno(-20), baixo = seno(-50);
  m.atualizar(x, x, 0);
  for (let i = 1; i <= 29; i++) perto(m.atualizar(baixo, baixo, i / 10).picoDb, -20, 0.1);   // até t = 2,9 s
  perto(m.atualizar(baixo, baixo, 3.0).picoDb, -50, 0.1);
  const n = A.criarMedidor(44100); n.atualizar(x, x, 0); n.reiniciarPico();
  perto(n.atualizar(baixo, baixo, 0.01).picoDb, -50, 0.1);        // o reinício força nova medição
});
test('bandasEspectro: 44 bandas, 1 kHz cai na banda 24, queda e marca de pico', () => {
  const bins = new Float32Array(4096).fill(-120), e = A.novoEstadoEspectro();
  bins[186] = -30;                                                // 186 × 44100 / 8192 ≈ 1001 Hz
  A.bandasEspectro(bins, 44100, e);
  assert.equal(e.val.length, 44); perto(e.val[24], 0.84, 0.01); assert.equal(e.val[23] + e.val[25], 0);
  const v = e.val[24]; A.bandasEspectro(new Float32Array(4096).fill(-120), 44100, e);
  perto(e.val[24], v - 0.035, 1e-6); perto(e.pico[24], v - 0.012, 1e-6);
});
test('formatação à portuguesa', () => {
  assert.equal(A.formatarDb(-13.04), '−13,0'); assert.equal(A.formatarDb(-0.04), '0,0');
  assert.equal(A.formatarDb(null), '—'); assert.equal(A.formatarDb(-Infinity), '—');
  assert.equal(A.formatarCorrelacao(0.834), '+0,83'); assert.equal(A.formatarCorrelacao(-1), '−1,00');
  assert.equal(A.formatarCorrelacao(-0.004), '+0,00'); assert.equal(A.formatarCorrelacao(null), '—');
  assert.deepEqual([0, 42.9, 195, 3725].map((s) => A.formatarTempo(s)), ['0:00', '0:42', '3:15', '62:05']);
  assert.equal(A.formatarTempo(null), '—:—');
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/analise.test.cjs`
Expected: FAIL (`Cannot find module '../js/analise.js'`).

- [ ] **Step 3: Implement `js/analise.js`** com o invólucro das Global Constraints e a interface acima.
  - Janelas sobre as amostras mais recentes (no máximo as que existirem): nível 45 ms (potência média dos dois canais, `nivel = clamp((10·log10(pot) + 48) / 48, 0, 1)`), RMS e correlação 300 ms, LUFS 400 ms.
  - Leituras lentas (pico, RMS, LUFS, correlação) só recalculam quando `agora − última ≥ 0,1 − 1e-9`, ou na primeira chamada, ou logo a seguir a `reiniciarPico()`; entre recálculos devolvem o último valor. O nível e a marca atualizam sempre.
  - Pico: máximo absoluto dos últimos 300 ms em dB; guarda-se o histórico dos 30 últimos e `picoDb` é o máximo desse histórico.
  - Marca do nível: sobe de imediato; fica 0,75 s; depois desce 0,36 por segundo a contar do fim da retenção (forma fechada, independente do espaçamento das chamadas), nunca abaixo do nível atual.
  - Silêncio: potência média < 1e-10, ou pico < 1e-5, ou um canal sem energia na correlação → `null`.
  - LUFS: aplicar a ponderação K ao array inteiro (aquecimento do filtro), medir os últimos 400 ms: `−0,691 + 10·log10(Σ potência de cada canal)`. Coeficientes (validados: seno de −20 dB dá −19,99 a 44,1 kHz e −19,99 a 48 kHz):
    ```js
    function coefK(fs) {                       // dois biquads em série; y[n] = b0x[n]+b1x[n-1]+b2x[n-2]−a1y[n-1]−a2y[n-2]
      const K1 = Math.tan(Math.PI * 1681.974450955533 / fs), Q1 = 0.7071752369554196, Vh = 10 ** (3.999843853973347 / 20);
      const Vb = Vh ** 0.4996667741545416, a01 = 1 + K1 / Q1 + K1 * K1;
      const K2 = Math.tan(Math.PI * 38.13547087602444 / fs), Q2 = 0.5003270373238773, a02 = 1 + K2 / Q2 + K2 * K2;
      return [
        { b: [(Vh + Vb * K1 / Q1 + K1 * K1) / a01, 2 * (K1 * K1 - Vh) / a01, (Vh - Vb * K1 / Q1 + K1 * K1) / a01], a: [1, 2 * (K1 * K1 - 1) / a01, (1 - K1 / Q1 + K1 * K1) / a01] },
        { b: [1, -2, 1], a: [1, 2 * (K2 * K2 - 1) / a02, (1 - K2 / Q2 + K2 * K2) / a02] }];
    }
    ```
  - `bandasEspectro`: banda `i` cobre `[32·500^(i/44), 32·500^((i+1)/44))` Hz; máximo dos bins da banda (pelo menos um; largura de bin = `taxa / (2·dbBins.length)`); `v = clamp((dB + 4,5·log2(f_centro/1000) + 82) / 62, 0, 1)` com `f_centro = √(f0·f1)`; `val` sobe de imediato e desce no máximo 0,035 por chamada; `pico = max(pico − 0,012, val)`.
  - `formatarDb`: `null`, `NaN` e ±∞ → «—»; resultado que arredonda para zero sem sinal. `formatarTempo`: `m:ss` com os minutos sem limite (62:05); `null`/`NaN` → «—:—».

- [ ] **Step 4: Fix the spec's test command** — editar a primeira linha do §9 do spec para `Correm com \`node --test\`.`

- [ ] **Step 5: Run to verify they pass**

Run: `node --test tests/analise.test.cjs`
Expected: PASS (10 testes).

- [ ] **Step 6: Commit**

```bash
git add js/analise.js tests/analise.test.cjs docs/superpowers/specs/2026-11-14-portfolio-design.md
git commit -m "feat: add sound measurements (level, peak, RMS, LUFS, correlation, spectrum)"
git -c push.negotiate=true push -u origin claude/quirky-johnson-w78lqq
```

---

### Task 2: Página estática (conteúdo, estrutura e estilo)

**Files:**
- Create: `index.html`, `estilo.css`, `conteudo.js`, `js/pagina.js`, `.gitignore`
- Create: `fontes/` (6 woff2 + 3 licenças), `tests/apoio/servidor.cjs`, `tests/apoio/navegador.cjs`, `tests/apoio/conteudo.cjs`
- Test: `tests/pagina.test.cjs`

**Interfaces:**
- Consumes: nada.
- Produces `Portfolio.Pagina`:
  ```
  preparar(conteudo: object): Modelo                    // puro, nunca lança
  montar(documento: Document, modelo: Modelo): void     // preenche o DOM (contrato abaixo)
  iniciar(conteudo: object, janela: Window = window): void   // preparar + montar + definir document.title; arranca sozinho quando há `document` e `window.CONTEUDO`
  Modelo = { nome: string, local: string|null, email: string|null, redes: {nome: string, url: string}[],
             categorias: Categoria[],
             sobre: null | { daws: string[], formacao: {titulo: string, periodo: string|null}[], tecnicas: string[] } }
  Categoria = { id: 'instrumentais'|'mistura'|'cinematografico', numero: '01'|'02'|'03', nome: string, contador: string,
                descricao: string|null, faixas: Faixa[] }
  Faixa = { id: string /* '<categoria>-<índice>' */, titulo: string, detalhes: string /* '' se vazio */,
            url: string /* o único ficheiro, ou o «depois» */, urlAntes: string|null }
  ```
- Contrato do DOM (os testes e a Tarefa 5 dependem destes seletores):

| Elemento | Seletor e atributos |
|---|---|
| Cabeçalho | `header.cabecalho` com `a.nome-site` (texto = nome) e `nav[aria-label="Principal"]` (ligações `#trabalhos`, `#sobre`, `#contacto`) |
| Topo | `section.topo` com `h1` («Produção» + `<em>musical</em>`), `p.apresentacao`, `p.local` (só com local) |
| Índice | `nav#trabalhos[aria-label="Categorias"]` com `a.item-indice[href="#<id>"]` > `.num`, `.nome`, `.contador` |
| Categoria | `section.categoria#<id>[data-categoria]` > `.categoria-cab` (`.num`, `h2`, `p.descricao` só se existir) + `.categoria-corpo` |
| Faixa | `article.faixa[data-faixa="<id>"][data-estado="parada"]` > `.linha`: `button.play[type=button][aria-label="Ouvir {título}"]`, `.titulo` > `.nome` + `.detalhes` (só se não vazio), `.antes-depois` (só mistura), `.tempo` (texto «—:—») |
| Antes/Depois | `div.antes-depois[role=group][aria-label="Comparar versões"]` > `button[type=button][data-versao="antes"\|"depois"][aria-pressed]` («Antes», «Depois»); «Depois» começa a `true` |
| Sobre | `section#sobre` > `h2` «Sobre» + `dl.sobre` > `div[data-topico="daws"\|"formacao"\|"tecnicas"]` > `dt` («DAWs», «Formação», «Técnicas») + `dd`; só os tópicos não vazios; a secção só existe se houver algum |
| Contacto | `footer#contacto` com `a.email[href^="mailto:"]`, `.redes a[target=_blank][rel="noopener noreferrer"]`, `.direitos` («© {ano atual} {nome}») |

- [ ] **Step 1: Write the failing tests** — `tests/pagina.test.cjs`

```js
// tests/pagina.test.cjs
const test = require('node:test'), assert = require('node:assert/strict');
const P = require('../js/pagina.js'), { base, comoJs } = require('./apoio/conteudo.cjs'), { comPagina } = require('./apoio/navegador.cjs');
const textos = (page, sel) => page.$$eval(sel, (els) => els.map((e) => e.textContent.trim()));

test('preparar: três categorias pela ordem certa, numeradas, com contadores', () => {
  const c = base(); c.categorias.instrumentais.faixas.push({ titulo: 'B', ficheiro: 'audio/b.mp3' }, { titulo: 'C', ficheiro: 'audio/c.mp3' });
  assert.deepEqual(P.preparar(c).categorias.map((x) => [x.id, x.numero, x.contador]),
    [['instrumentais', '01', '3 faixas'], ['mistura', '02', '1 trabalho'], ['cinematografico', '03', '1 projeto']]);
});
test('preparar: categoria sem faixas desaparece e a numeração acompanha', () => {
  const c = base(); c.categorias.mistura.faixas = []; delete c.categorias.cinematografico;
  assert.deepEqual(P.preparar(c).categorias.map((x) => [x.id, x.numero]), [['instrumentais', '01']]);
});
test('preparar: os detalhes juntam só os campos presentes', () => {
  const f = (cat, faixa) => P.preparar({ nome: 'N', categorias: { [cat]: { faixas: [faixa] } } }).categorias[0].faixas[0].detalhes;
  assert.equal(f('instrumentais', { titulo: 'T', genero: 'Trap', ano: 2026, ficheiro: 'a.mp3' }), 'Trap · 2026');
  assert.equal(f('instrumentais', { titulo: 'T', ano: 2026, ficheiro: 'a.mp3' }), '2026');
  assert.equal(f('instrumentais', { titulo: 'T', ficheiro: 'a.mp3' }), '');
  assert.equal(f('mistura', { titulo: 'T', servico: 'Mistura', ano: 2025, antes: 'a.mp3', depois: 'b.mp3' }), 'Mistura · 2025');
  assert.equal(f('cinematografico', { titulo: 'T', tipo: 'Curta', ficheiro: 'a.mp3' }), 'Curta');
});
test('preparar: título e ficheiros da mistura', () => {
  const m = P.preparar({ nome: 'N', categorias: { mistura: { faixas: [{ artista: 'Ana', titulo: 'Faixa', antes: 'a.mp3', depois: 'b.mp3' }, { titulo: 'Só', antes: 'c.mp3', depois: 'd.mp3' }] } } });
  assert.deepEqual(m.categorias[0].faixas.map((f) => [f.id, f.titulo, f.url, f.urlAntes]), [['mistura-0', 'Ana — Faixa', 'b.mp3', 'a.mp3'], ['mistura-1', 'Só', 'd.mp3', 'c.mp3']]);
});
test('preparar: «Sobre» esconde listas vazias e, sem nada, desaparece', () => {
  assert.deepEqual(P.preparar({ nome: 'N', sobre: { daws: ['X'], formacao: [], tecnicas: [] } }).sobre, { daws: ['X'], formacao: [], tecnicas: [] });
  assert.equal(P.preparar({ nome: 'N', sobre: { daws: [], formacao: [], tecnicas: [] } }).sobre, null);
  assert.equal(P.preparar({ nome: 'N' }).sobre, null);
});
test('preparar: conteúdo mínimo não rebenta nem deixa «undefined»', () => {
  const m = P.preparar({ nome: 'N' }); assert.deepEqual(m.categorias, []); assert.equal(m.email, null); assert.deepEqual(m.redes, []);
  assert.doesNotMatch(JSON.stringify(P.preparar({ nome: 'N', categorias: { instrumentais: { faixas: [{ titulo: 'T', ficheiro: 'a.mp3' }] } } })), /undefined/);
});

test('página: categorias, índice, contadores e título', () => comPagina({ conteudo: comoJs(base()) }, async (page) => {
  assert.deepEqual(await page.$$eval('section.categoria', (s) => s.map((e) => e.id)), ['instrumentais', 'mistura', 'cinematografico']);
  assert.deepEqual(await textos(page, '#trabalhos .item-indice .contador'), ['1 faixa', '1 trabalho', '1 projeto']);
  assert.deepEqual(await textos(page, 'section.categoria h2'), ['Instrumentais', 'Mistura e masterização', 'Áudio cinematográfico']);
  assert.equal(await page.title(), 'Ana Teste — Produção musical');
  assert.equal(await page.getAttribute('html', 'lang'), 'pt-PT'); assert.ok(await page.getAttribute('meta[name="description"]', 'content'));
}));
test('página: uma categoria sem faixas não aparece, nem no índice, e a numeração acompanha', () => {
  const c = base(); c.categorias.mistura.faixas = [];
  return comPagina({ conteudo: comoJs(c) }, async (page) => {
    assert.deepEqual(await page.$$eval('section.categoria', (s) => s.map((e) => e.id)), ['instrumentais', 'cinematografico']);
    assert.deepEqual(await textos(page, '#trabalhos .item-indice .num'), ['01', '02']); assert.equal(await page.locator('#mistura, a[href="#mistura"]').count(), 0);
  });
});
test('página: a mistura tem Antes/Depois com «Depois» ativo', () => comPagina({ conteudo: comoJs(base()) }, async (page) => {
  assert.equal(await page.locator('.antes-depois').count(), 1);
  assert.equal(await page.getAttribute('[data-versao="depois"]', 'aria-pressed'), 'true');
  assert.equal(await page.getAttribute('[data-versao="antes"]', 'aria-pressed'), 'false');
}));
test('página: campos em falta são omitidos, sem «undefined» nem separadores soltos', () => {
  const c = base(); c.categorias.instrumentais.faixas = [{ titulo: 'Só título', ficheiro: 'audio/i1.mp3' }, { titulo: 'Com ano', ano: 2026, ficheiro: 'audio/i1.mp3' }];
  delete c.local; delete c.contacto.redes;
  return comPagina({ conteudo: comoJs(c) }, async (page) => {
    assert.deepEqual(await textos(page, '#instrumentais .detalhes'), ['2026']);
    assert.equal(await page.locator('.local, .redes').count(), 0);
    assert.doesNotMatch(await page.innerText('body'), /undefined|NaN|· *$/m);
  });
});
test('página: «Sobre» tem DAWs, Formação e Técnicas, por esta ordem', () => comPagina({ conteudo: comoJs(base()) }, async (page) => {
  assert.deepEqual(await page.$$eval('#sobre [data-topico]', (e) => e.map((x) => x.dataset.topico)), ['daws', 'formacao', 'tecnicas']);
  assert.deepEqual(await textos(page, '#sobre dt'), ['DAWs', 'Formação', 'Técnicas']);
}));
test('página: contacto', () => comPagina({ conteudo: comoJs(base()) }, async (page) => {
  assert.equal(await page.getAttribute('footer a.email', 'href'), 'mailto:ana@exemplo.pt');
  assert.equal(await page.getAttribute('.redes a', 'target'), '_blank'); assert.equal(await page.getAttribute('.redes a', 'rel'), 'noopener noreferrer');
  assert.match(await page.textContent('.direitos'), new RegExp(`© ${new Date().getFullYear()} Ana Teste`));
}));
test('página: as três famílias carregam de fontes/, sem pedidos externos', () => comPagina({ conteudo: comoJs(base()) }, async (page, { externos }) => {
  await page.evaluate(() => document.fonts.ready);
  const fam = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')));
  for (const f of ['Instrument Serif', 'Inter', 'IBM Plex Mono']) assert.ok(fam.includes(f), `${f} não carregou (${fam})`);
  assert.deepEqual(externos, []);
}));
test('Review Focus 1: texto do conteúdo nunca vira HTML', () => {
  const c = base(), mau = '<b>x</b> & "y"'; c.nome = 'A<i>B</i>'; c.categorias.instrumentais.faixas[0].titulo = mau; c.contacto.redes[0].nome = mau;
  return comPagina({ conteudo: comoJs(c) }, async (page) => {
    assert.equal(await page.textContent('#instrumentais .nome'), mau); assert.equal(await page.textContent('.nome-site'), 'A<i>B</i>');
    assert.equal(await page.title(), 'A<i>B</i> — Produção musical');
    assert.equal(await page.locator('.faixa b, .cabecalho i, .redes b').count(), 0);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/pagina.test.cjs`
Expected: FAIL (módulos e ajudas em falta).

- [ ] **Step 3: Create the test helpers** `tests/apoio/servidor.cjs`, `navegador.cjs`, `conteudo.cjs` segundo os contratos da secção «Ajudas de teste». (`sinal.cjs` fica para a Tarefa 3.)

- [ ] **Step 4: Fonts, `.gitignore`, `conteudo.js`**
  - Fontes: `npm pack @fontsource/instrument-serif@5.3.0 @fontsource/inter@5.3.0 @fontsource/ibm-plex-mono@5.3.0` numa pasta temporária; de cada pacote copiar `package/files/<família>-latin-<peso>-<estilo>.woff2` para `fontes/` com os nomes `instrument-serif-400.woff2`, `instrument-serif-400-italic.woff2`, `inter-400.woff2`, `inter-500.woff2`, `ibm-plex-mono-400.woff2`, `ibm-plex-mono-500.woff2`, e `package/LICENSE` para `fontes/LICENSE-<família>.txt`. O subconjunto `latin` cobre os acentos do português, «—», «−» e «·».
  - `.gitignore`: `*.onda.json`, `_site/`, `node_modules/`, `.DS_Store`.
  - `conteudo.js`: comentário em português a explicar a edição (substituir o que está entre [parênteses retos]; para acrescentar uma faixa, copiar o MP3 para a pasta certa e juntar um bloco à lista), seguido de `window.CONTEUDO` no formato do spec §4 com um exemplo de cada categoria. Todos os textos de exemplo entre [parênteses retos] (incluindo `ano: "[Ano]"` e os caminhos `"[audio/instrumentais/ficheiro.mp3]"`); fora dos parênteses ficam só `nome: "Afonso Duarte"` e a formação «Orquestra do Colégio Militar», «2013–2021».

- [ ] **Step 5: Implement `index.html`, `estilo.css` and `js/pagina.js`**
  - `index.html`: `lang="pt-PT"`, `<meta charset>`, `<meta name="viewport">`, `<title>Afonso Duarte — Produção musical</title>`, `<meta name="description">`, `estilo.css`, e no fim do `body` os scripts `conteudo.js` e `js/pagina.js` com `defer` (a Tarefa 5 junta `js/analise.js`, `js/instrumentos.js` e `js/leitor.js` antes de `js/pagina.js`). Esqueleto fixo: cabeçalho (nome substituído por `modelo.nome`), topo com o `h1`, contentores vazios `nav#trabalhos`, `main`, e os de «Sobre» e contacto preenchidos por `montar`; `<noscript>` «Este site precisa de JavaScript para mostrar os trabalhos.».
  - `estilo.css`: `@font-face` das seis fontes (`font-display: swap`, caminhos `fontes/…`), tokens em `:root` e layout do design B conforme o spec §5, a reproduzir de `docs/referencias/design-b.dc.html`; `html { scroll-behavior: smooth }` desligado com `prefers-reduced-motion`; regras para ≤ 640 px; `overflow-wrap: anywhere` nos títulos de faixa. O CSS do painel fica para a Tarefa 5.
  - `js/pagina.js`: `preparar` (regras do spec §4; contador «1 faixa»/«N faixas», «1 trabalho»/«N trabalhos», «1 projeto»/«N projetos»; `ano` aceita número ou texto), `montar` só com `createElement`/`textContent`, `iniciar`.

- [ ] **Step 6: Run to verify they pass**

Run: `node --test tests/pagina.test.cjs`
Expected: PASS (14 testes).

- [ ] **Step 7: Compare with the approved design** — abrir a página pelo servidor de teste com `base()`, capturar 1280 px e 390 px (no scratchpad, não no repositório) e comparar com `docs/referencias/design-b.dc.html` (tamanhos de letra, espaços, linhas, ordem). Corrigir as diferenças e anotar quais foram na mensagem do commit.

- [ ] **Step 8: Commit**

```bash
git add index.html estilo.css conteudo.js js/pagina.js fontes .gitignore tests
git commit -m "feat: add static page, content model and fonts"
git -c push.negotiate=true push -u origin claude/quirky-johnson-w78lqq
```

---

### Task 3: Desenho dos instrumentos (`js/instrumentos.js`)

**Files:**
- Create: `js/instrumentos.js`, `tests/apoio/sinal.cjs`
- Test: `tests/instrumentos.test.cjs`

**Interfaces:**
- Consumes: ajudas `comPagina` (Tarefa 2).
- Produces `Portfolio.Instrumentos`:
  ```
  criarTela(canvas: HTMLCanvasElement): Tela        // Tela = { canvas, ctx, w, h, ajustar(): boolean }
        // ajustar(): lê o tamanho CSS e devicePixelRatio (máx. 2), redimensiona o canvas, repõe a transformação; false se w < 16 ou h < 16
  desenharOnda(tela: Tela, picos: ArrayLike<number>|null, fracao: number): void
        // picos: 800 inteiros 0–255; null = só a linha de progresso fina (2 px, centrada, `#111111` até `fracao`, `#E3E3E3` no resto, sem cursor)
  desenharEspectro(tela: Tela, estado: { val: Float32Array, pico: Float32Array }): void
  criarEstereo(): EstadoEstereo
  desenharEstereo(tela: Tela, estado: EstadoEstereo, esq: Float32Array|null, dir: Float32Array|null, taxa: number): void   // null = só a moldura
  ```
- Também cria `tests/apoio/sinal.cjs` (contrato nas «Ajudas de teste»).

- [ ] **Step 1: Write the failing tests** — `tests/instrumentos.test.cjs`

```js
// tests/instrumentos.test.cjs
const test = require('node:test'), assert = require('node:assert/strict');
const { comPagina } = require('./apoio/navegador.cjs');
const perto = (v, esperado, tol) => assert.ok(Math.abs(v - esperado) <= tol, `${v} ≉ ${esperado} ± ${tol}`);
const html = (w, h) => `<!doctype html><meta charset=utf-8><style>canvas{display:block;width:${w}px;height:${h}px}</style><canvas id=c></canvas><script src="js/instrumentos.js"></script>`;
// corre `corpo` no browser (com I = Portfolio.Instrumentos e t = Tela) e devolve os pixéis do canvas
const capturar = (w, h, corpo) => comPagina({ ficheiros: { '/harness.html': html(w, h) }, pagina: '/harness.html' }, (page) =>
  page.evaluate(`(() => { const I = Portfolio.Instrumentos, t = I.criarTela(document.getElementById('c')); t.ajustar(); ${corpo}; const d = t.ctx.getImageData(0, 0, t.canvas.width, t.canvas.height); return { w: d.width, h: d.height, px: Array.from(d.data) }; })()`));
const at = (img, x, y) => img.px.slice((y * img.w + x) * 4, (y * img.w + x) * 4 + 4);       // [r, g, b, a]
const escuro = (p) => p[3] > 200 && p[0] < 40;
const ponto = (p) => p[3] > 100 && p[0] < 40;
const conta = (img, x0, x1, y0, y1, f) => { let n = 0; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (f(at(img, x, y))) n++; return n; };

test('criarTela.ajustar: true em canvases normais, false em canvases minúsculos', async () => {
  const r = await comPagina({ ficheiros: { '/harness.html': html(400, 56) + '<canvas id=p style="width:10px;height:10px"></canvas>' }, pagina: '/harness.html' }, (page) =>
    page.evaluate(() => { const I = Portfolio.Instrumentos; return [I.criarTela(document.getElementById('c')).ajustar(), I.criarTela(document.getElementById('p')).ajustar()]; }));
  assert.deepEqual(r, [true, false]);
});
test('onda: tocado a preto, resto a cinzento, cursor na posição', async () => {
  const img = await capturar(400, 56, 'I.desenharOnda(t, Array(800).fill(255), 0.5)');
  assert.ok(escuro(at(img, 100, 28)));
  const r = at(img, 300, 28)[0]; assert.ok(r > 180 && r < 215, `cinzento por tocar: ${r}`);
  assert.ok(escuro(at(img, 200, 2)));
});
test('onda: barras de 2 px com 1 px de intervalo', async () => {
  const img = await capturar(400, 56, 'I.desenharOnda(t, Array(800).fill(255), 0)');
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((x) => at(img, x, 28)[3] > 0), [true, true, false, true, true, false]);
});
test('onda sem picos: só a linha de progresso fina', async () => {
  const img = await capturar(400, 56, 'I.desenharOnda(t, null, 0.25)');
  assert.ok(escuro(at(img, 50, 28)));
  const p = at(img, 300, 28); assert.ok(p[3] > 0 && p[0] > 215 && p[0] < 240);
  assert.equal(at(img, 50, 10)[3], 0);
});
test('espectro: a altura é proporcional ao valor de cada banda', async () => {
  const img = await capturar(400, 208, 'const e = { val: new Float32Array(44), pico: new Float32Array(44) }; e.val[10] = 1; e.val[20] = 0.5; I.desenharEspectro(t, e)');
  const alt = Array.from({ length: img.w }, (_, x) => conta(img, x, x, 0, img.h - 1, escuro));
  const altos = [...new Set(alt.filter((n) => n >= 20))].sort((a, b) => b - a);
  assert.equal(altos.length, 2); perto(altos[1] / altos[0], 0.5, 0.05);
});
test('estéreo: som ao centro desenha uma linha vertical', async () => {
  const img = await capturar(208, 208, 'const L = Float32Array.from({ length: 882 }, (_, i) => 0.5 * Math.sin(i / 8)); I.desenharEstereo(t, I.criarEstereo(), L, L, 44100)');
  assert.ok(conta(img, 102, 106, 40, 176, ponto) > 20);
  assert.equal(conta(img, 120, 190, 100, 116, ponto), 0);
});
test('estéreo: som em oposição de fase abre para os lados', async () => {
  const img = await capturar(208, 208, 'const L = Float32Array.from({ length: 882 }, (_, i) => 0.5 * Math.sin(i / 8)); I.desenharEstereo(t, I.criarEstereo(), L, L.map((v) => -v), 44100)');
  assert.ok(conta(img, 130, 180, 104, 112, ponto) > 10);
  assert.equal(conta(img, 102, 106, 30, 90, ponto), 0);
});
test('estéreo sem amostras só desenha a moldura', async () => {
  const img = await capturar(208, 208, 'I.desenharEstereo(t, I.criarEstereo(), null, null, 44100)');
  assert.equal(conta(img, 0, 207, 0, 207, ponto), 0);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/instrumentos.test.cjs`
Expected: FAIL (`Portfolio` não está definido; `js/instrumentos.js` não existe).

- [ ] **Step 3: Create `tests/apoio/sinal.cjs`** (contrato nas «Ajudas de teste»).

- [ ] **Step 4: Implement `js/instrumentos.js`** portando de `docs/referencias/leitor-prototipo.html` as funções `tela` (→ `criarTela`), `desenharOnda`, `desenharEspectro` e `desenharEstereo`, com estas alterações:
  - Picos `0–255` (altura da barra `(v/255)^0,7 × (h − 4)`, mínimo 1 px); com `picos = null`, linha fina em vez de barras.
  - O estéreo recebe os arrays, usa `round(taxa × 0,02)` amostras (20 ms), ampliação 1,5× limitada ao losango (`|m| + |s| ≤ 1`) e não lê estado global; o rasto vive em `estado.rasto`, um canvas fora do ecrã do mesmo tamanho.
  - Cores lidas de `--ink`, `--muted`, `--line`, `--ghost`, `--bg` (`getComputedStyle(document.documentElement)`) com os valores do spec como alternativa; letra dos rótulos `400 10px "IBM Plex Mono", ui-monospace, monospace`.

- [ ] **Step 5: Run to verify they pass**

Run: `node --test tests/instrumentos.test.cjs`
Expected: PASS (8 testes).

- [ ] **Step 6: Commit**

```bash
git add js/instrumentos.js tests/apoio/sinal.cjs tests/instrumentos.test.cjs
git commit -m "feat: draw waveform, spectrum and stereo field on canvas"
git -c push.negotiate=true push -u origin claude/quirky-johnson-w78lqq
```

---

### Task 4: Motor de reprodução (`js/leitor.js`)

**Files:**
- Create: `js/leitor.js`
- Test: `tests/leitor.test.cjs`

**Interfaces:**
- Consumes: `tests/apoio/sinal.cjs` (`wav`), `comPagina`.
- Produces `Portfolio.Leitor`:
  ```
  JANELA = 32768, BINS = 4096                                  // tamanho dos arrays de amostras e de espectro
  criar({ analise: boolean }): Leitor
    tocar(faixa: { url: string, urlAntes?: string|null }): Promise<boolean>
        // true se começou a tocar; false se outra chamada a substituiu ou se falhou (neste caso chama aoErro)
    pausar(): void;  retomar(): Promise<void>;  parar(): void   // parar volta ao início e liberta os ficheiros
    procurar(seg: number): void                                 // limita a [0, duração − 0,05]
    trocarVersao(versao: 'antes'|'depois'): void
    posicao(): number;  duracao(): number|null;  versao(): 'antes'|'depois';  aTocar(): boolean
    amostras(esq: Float32Array, dir: Float32Array): boolean     // arrays de JANELA amostras; false sem análise
    espectro(saida: Float32Array): number                       // saida com BINS valores (dB); devolve a taxa de amostragem, 0 sem análise
    taxa: number                                                // taxa de amostragem; 0 sem análise
    aoFim: (() => void)|null;  aoErro: (() => void)|null
  ```

- [ ] **Step 1: Write the failing tests** — `tests/leitor.test.cjs`

```js
// tests/leitor.test.cjs
const test = require('node:test'), assert = require('node:assert/strict');
const { comPagina } = require('./apoio/navegador.cjs'), { wav } = require('./apoio/sinal.cjs');
const perto = (v, esperado, tol) => assert.ok(Math.abs(v - esperado) <= tol, `${v} ≉ ${esperado} ± ${tol}`);
const harness = `<!doctype html><meta charset=utf-8><script src="js/leitor.js"></script><script>
  window.__rej = 0; addEventListener('unhandledrejection', () => window.__rej++);
  window.esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  window.picoDb = (l) => { const e = new Float32Array(Portfolio.Leitor.JANELA), d = new Float32Array(e.length); l.amostras(e, d);
    let m = 0; for (let i = e.length - 17640; i < e.length; i++) m = Math.max(m, Math.abs(e[i]), Math.abs(d[i])); return 20 * Math.log10(m); };
</script>`;
const ficheiros = { '/harness.html': harness, '/audio/a.mp3': wav({ segundos: 6, db: -20 }), '/audio/b.mp3': wav({ segundos: 6, db: -32 }) };
const noBrowser = (fn) => comPagina({ ficheiros, pagina: '/harness.html' }, (page) => page.evaluate(fn));

test('toca, pausa, retoma e para', async () => {
  const r = await noBrowser(async () => {
    const l = Portfolio.Leitor.criar({ analise: true }), s = {};
    s.comecou = await l.tocar({ url: 'audio/a.mp3' }); await esperar(600); s.p1 = l.posicao();
    l.pausar(); const p = l.posicao(); await esperar(400); s.parada = Math.abs(l.posicao() - p) < 0.02;
    await l.retomar(); await esperar(500); s.avanco = l.posicao() - p; l.parar(); s.fim = [l.aTocar(), l.posicao()];
    return s;
  });
  assert.equal(r.comecou, true); assert.ok(r.p1 > 0.3 && r.p1 < 1.1); assert.ok(r.parada); assert.ok(r.avanco > 0.3); assert.deepEqual(r.fim, [false, 0]);
});
test('procurar muda a posição; a duração é conhecida', async () => {
  const r = await noBrowser(async () => {
    const l = Portfolio.Leitor.criar({ analise: true }); await l.tocar({ url: 'audio/a.mp3' }); l.procurar(3); await esperar(300);
    return [l.posicao(), l.duracao()];
  });
  perto(r[0], 3.3, 0.4); perto(r[1], 6, 0.05);
});
test('análise: o seno de −20 dB lê-se nas amostras e o pico do espectro está nos 1000 Hz', async () => {
  const r = await noBrowser(async () => {
    const l = Portfolio.Leitor.criar({ analise: true }); await l.tocar({ url: 'audio/a.mp3' }); await esperar(1000);
    const bins = new Float32Array(Portfolio.Leitor.BINS), taxa = l.espectro(bins), k = bins.indexOf(Math.max(...bins));
    return { pico: picoDb(l), taxa: l.taxa, hz: k * taxa / (2 * bins.length), igual: taxa === l.taxa };
  });
  perto(r.pico, -20, 0.2); assert.ok(r.taxa >= 8000 && r.taxa <= 96000 && r.igual); perto(r.hz, 1000, 20);
});
test('Antes/Depois: mantém a posição, continua a tocar e muda o nível', async () => {
  const r = await noBrowser(async () => {
    const l = Portfolio.Leitor.criar({ analise: true }); await l.tocar({ url: 'audio/a.mp3', urlAntes: 'audio/b.mp3' }); await esperar(1000);
    const s = { inicial: l.versao(), depois: picoDb(l), p1: l.posicao() }; l.trocarVersao('antes'); s.p2 = l.posicao(); await esperar(800);
    s.antes = picoDb(l); s.versao = l.versao(); s.aTocar = l.aTocar(); l.trocarVersao('depois'); await esperar(800); s.volta = picoDb(l);
    return s;
  });
  assert.equal(r.inicial, 'depois'); assert.equal(r.versao, 'antes'); assert.ok(r.aTocar); assert.ok(Math.abs(r.p2 - r.p1) < 0.3);
  perto(r.depois, -20, 0.5); perto(r.antes, -32, 0.5); perto(r.volta, -20, 0.5);
});
test('ficheiro inexistente: aoErro uma vez, tocar devolve false e o motor continua utilizável', async () => {
  const r = await noBrowser(async () => {
    const l = Portfolio.Leitor.criar({ analise: true }); let erros = 0; l.aoErro = () => erros++;
    const falhou = await l.tocar({ url: 'audio/nao-existe.mp3' }); await esperar(300); const depois = await l.tocar({ url: 'audio/a.mp3' });
    return { falhou, erros, depois, aTocar: l.aTocar() };
  });
  assert.deepEqual(r, { falhou: false, erros: 1, depois: true, aTocar: true });
});
test('mistura com uma versão em falta: aoErro e fica parada', async () => {
  const r = await noBrowser(async () => {
    const l = Portfolio.Leitor.criar({ analise: true }); let erros = 0; l.aoErro = () => erros++;
    await l.tocar({ url: 'audio/a.mp3', urlAntes: 'audio/nao-existe.mp3' }); await esperar(600);
    return { erros, aTocar: l.aTocar() };
  });
  assert.deepEqual(r, { erros: 1, aTocar: false });
});
test('Review Focus 2: duas chamadas seguidas a tocar — só a última toca, sem erros', async () => {
  const r = await noBrowser(async () => {
    const l = Portfolio.Leitor.criar({ analise: true }); let erros = 0; l.aoErro = () => erros++;
    const [a, b] = await Promise.all([l.tocar({ url: 'audio/a.mp3' }), l.tocar({ url: 'audio/b.mp3' })]); await esperar(800);
    l.pausar(); const x = l.tocar({ url: 'audio/a.mp3' }); l.pausar(); await x; await esperar(200);
    return { a, b, erros, rej: window.__rej };
  });
  assert.deepEqual([r.a, r.b, r.erros, r.rej], [false, true, 0, 0]);
});
test('Review Focus 4: procurar muito além do fim termina em ordem', async () => {
  const r = await noBrowser(async () => {
    const l = Portfolio.Leitor.criar({ analise: true }); let fins = 0, erros = 0; l.aoFim = () => fins++; l.aoErro = () => erros++;
    await l.tocar({ url: 'audio/a.mp3' }); l.procurar(1e9); await esperar(800);
    return { fins, erros, aTocar: l.aTocar(), pos: l.posicao() };
  });
  assert.deepEqual(r, { fins: 1, erros: 0, aTocar: false, pos: 0 });
});
test('sem análise (modo simples): toca, troca de versão e não mede', async () => {
  const r = await noBrowser(async () => {
    const l = Portfolio.Leitor.criar({ analise: false });
    await l.tocar({ url: 'audio/a.mp3', urlAntes: 'audio/b.mp3' }); await esperar(500); l.trocarVersao('antes'); await esperar(500);
    return { aTocar: l.aTocar(), pos: l.posicao(), taxa: l.taxa, amostras: l.amostras(new Float32Array(Portfolio.Leitor.JANELA), new Float32Array(Portfolio.Leitor.JANELA)) };
  });
  assert.ok(r.aTocar); assert.ok(r.pos > 0.7); assert.equal(r.taxa, 0); assert.equal(r.amostras, false);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/leitor.test.cjs`
Expected: FAIL (`Portfolio.Leitor` não existe).

- [ ] **Step 3: Implement `js/leitor.js`**
  - Um só `AudioContext`, criado no primeiro `tocar` (dentro do gesto do utilizador) com `resume()`. Antes de o criar: `try { navigator.audioSession.type = 'playback'; } catch {}` (som com o iPhone em silêncio, iOS ≥ 16.4).
  - Cada `tocar` cria `new Audio(url)` (`preload = 'auto'`) por versão, só duas se houver `urlAntes`; ambas arrancam juntas, a inativa com ganho 0 (modo simples: `muted = true`).
  - Com análise: cada elemento → `createMediaElementSource` → `GainNode` → `entrada` (`channelCount 2`, `'explicit'`, `'speakers'`) → destino; `entrada` → `ChannelSplitter(2)` → dois `AnalyserNode` com `fftSize = JANELA`; `entrada` → um `AnalyserNode` com `fftSize = 2 × BINS` e `smoothingTimeConstant = 0,72`.
  - `trocarVersao`: se as posições dos dois elementos diferem mais de 0,05 s, alinhar o que entra com o que sai; passagem de ganhos em 30 ms com `linearRampToValueAtTime`.
  - Corridas: um contador de geração incrementa em cada `tocar`/`parar`; depois de qualquer `await` e em cada evento, ignorar o que pertence a uma geração antiga. `AbortError` de `play()` nunca é erro. Elementos descartados: `pause(); removeAttribute('src'); load()` e ignorar o `error` que daí resulte.
  - `aoErro` com o evento `error` de qualquer elemento da geração atual, ou `play()` rejeitado com outro nome que não `AbortError`; depois do erro o motor faz `parar()`. `aoFim` com o evento `ended` do elemento ativo, seguido de `parar()`.
  - `procurar` põe o mesmo `currentTime` nos dois elementos.

- [ ] **Step 4: Run to verify they pass**

Run: `node --test tests/leitor.test.cjs`
Expected: PASS (9 testes, cerca de 20 s).

- [ ] **Step 5: Commit**

```bash
git add js/leitor.js tests/leitor.test.cjs
git commit -m "feat: add playback engine with analysis graph and Antes/Depois switching"
git -c push.negotiate=true push -u origin claude/quirky-johnson-w78lqq
```

---

### Task 5: Painel de instrumentos e interação

**Files:**
- Modify: `js/pagina.js`, `estilo.css`, `index.html` (scripts de `js/analise.js`, `js/instrumentos.js`, `js/leitor.js` antes de `js/pagina.js`)
- Test: `tests/painel.test.cjs`, e novos testes em `tests/pagina.test.cjs`

**Interfaces:**
- Consumes: `Analise` (Tarefa 1), `Instrumentos` (Tarefa 3), `Leitor` (Tarefa 4), `Pagina.preparar/montar` e o contrato do DOM (Tarefa 2), `sinal.cjs`.
- Produces (em `Portfolio.Pagina`):
  ```
  decidirModo(amb: { protocolo: string, temWebAudio: boolean, ios: boolean, temAudioSession: boolean }): 'completo'|'simples'
  validarOnda(json: unknown): { duracao: number, picos: number[] } | null      // 800 inteiros 0–255 e duracao > 0, senão null
  ondaUrl(mp3: string): string                                                 // 'audio/a.mp3' → 'audio/a.onda.json' (extensão em qualquer caixa)
  ```
  `iniciar` passa a ligar o leitor. Acrescenta ao DOM: `.painel` dentro da faixa ativa (criado ao abrir, removido ao fechar) com `.onda[role=slider][aria-label="Posição na faixa"][tabindex=0]` > `canvas`; `.instrumentos` > `figure.inst[data-instrumento="espectro"|"estereo"]` (> `figcaption` «Espectro», «Campo estéreo»; `.tela` > `canvas`); `dl.leituras` > `div[data-leitura="nivel"|"pico"|"rms"|"lufs"|"correlacao"]` > `dt` («Nível», «Pico», «RMS», «LUFS», «Correlação») + `dd`. `data-estado` da faixa: `parada`, `a-tocar`, `em-pausa`, `indisponivel`.

- [ ] **Step 1: Write the failing tests**

Em `tests/pagina.test.cjs`, juntar:

```js
test('decidirModo: file:, sem Web Audio e iOS antigo → simples', () => {
  const ok = { protocolo: 'https:', temWebAudio: true, ios: false, temAudioSession: false };
  assert.equal(P.decidirModo(ok), 'completo');
  assert.equal(P.decidirModo({ ...ok, protocolo: 'file:' }), 'simples');
  assert.equal(P.decidirModo({ ...ok, temWebAudio: false }), 'simples');
  assert.equal(P.decidirModo({ ...ok, ios: true, temAudioSession: false }), 'simples');
  assert.equal(P.decidirModo({ ...ok, ios: true, temAudioSession: true }), 'completo');
});
test('validarOnda e ondaUrl', () => {
  const picos = Array(800).fill(10);
  assert.deepEqual(P.validarOnda({ duracao: 6, picos }), { duracao: 6, picos });
  for (const mau of [null, '{', { duracao: 'x', picos }, { duracao: 0, picos }, { duracao: 6, picos: picos.slice(1) }, { duracao: 6, picos: [...picos.slice(1), 256] }, { duracao: 6, picos: [...picos.slice(1), 1.5] }]) assert.equal(P.validarOnda(mau), null);
  assert.equal(P.ondaUrl('audio/a.mp3'), 'audio/a.onda.json'); assert.equal(P.ondaUrl('x/B.MP3'), 'x/B.onda.json');
});
```

`tests/painel.test.cjs` (cada teste abre a página com `faixasTeste()`; a faixa `instrumentais-0` é `audio/i1.mp3`, a `mistura-0` tem o «antes» a −32 dB):

```js
// tests/painel.test.cjs
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { comPagina } = require('./apoio/navegador.cjs'), { base, comoJs } = require('./apoio/conteudo.cjs'), { faixasTeste, wav } = require('./apoio/sinal.cjs');
const abrir = (extra, fn) => comPagina({ conteudo: comoJs(base()), ficheiros: faixasTeste(), ...extra }, fn);
const perto = (v, esperado, tol) => assert.ok(Math.abs(v - esperado) <= tol, `${v} ≉ ${esperado} ± ${tol}`);
const faixa = (id) => `.faixa[data-faixa="${id}"]`, I = 'instrumentais-0', M = 'mistura-0';
const estado = (page, id) => page.getAttribute(faixa(id), 'data-estado');
const pos = async (page, id) => Number(await page.getAttribute(`${faixa(id)} .onda`, 'aria-valuenow'));
const valor = async (page, id, l) => (await page.textContent(`${faixa(id)} [data-leitura="${l}"] dd`)).trim();
const num = (t) => parseFloat(t.replace('−', '-').replace(',', '.'));
const tocar = async (page, id, ms = 0) => { await page.click(`${faixa(id)} .play`); await page.waitForTimeout(ms); };

test('tocar abre o painel só nessa faixa; tocar outra fecha o primeiro', () => abrir({}, async (page) => {
  await tocar(page, I, 400);
  assert.equal(await estado(page, I), 'a-tocar'); assert.equal(await page.locator(`${faixa(I)} .painel`).count(), 1);
  await tocar(page, M, 400);
  assert.deepEqual(await page.$$eval('.faixa', (f) => f.map((x) => x.dataset.estado)), ['parada', 'a-tocar', 'parada']);
  assert.equal(await page.locator('.painel').count(), 1); assert.equal(await page.locator(`${faixa(M)} .painel`).count(), 1);
}));
test('pausar mantém o painel e retomar continua', () => abrir({}, async (page) => {
  await tocar(page, I, 400); await tocar(page, I, 200);
  assert.equal(await estado(page, I), 'em-pausa'); assert.equal(await page.locator(`${faixa(I)} .painel`).count(), 1);
  const nome = await page.textContent(`${faixa(I)} .nome`);
  assert.equal(await page.getAttribute(`${faixa(I)} .play`, 'aria-label'), `Ouvir ${nome}`);
  await tocar(page, I, 300); assert.equal(await estado(page, I), 'a-tocar');
  assert.equal(await page.getAttribute(`${faixa(I)} .play`, 'aria-label'), `Pausar ${nome}`);
}));
test('nenhum MP3 é pedido antes do play; na mistura pedem-se as duas versões ao tocar', () => abrir({}, async (page, { pedidos }) => {
  await page.waitForTimeout(500); assert.deepEqual(pedidos.filter((u) => u.endsWith('.mp3')), []);
  await tocar(page, M, 600); const mp3 = pedidos.filter((u) => u.endsWith('.mp3'));
  assert.ok(mp3.some((u) => u.endsWith('m1-antes.mp3')) && mp3.some((u) => u.endsWith('m1-depois.mp3')));
}));
test('leituras: seno de −20 dB dá LUFS −20,0 e correlação +1,00, sem anúncios a cada atualização', () => abrir({}, async (page) => {
  await tocar(page, I, 1500);
  perto(num(await valor(page, I, 'lufs')), -20, 0.5); perto(num(await valor(page, I, 'pico')), -20, 0.5); assert.equal(await valor(page, I, 'correlacao'), '+1,00');
  assert.equal(await page.locator('.leituras [aria-live]').count(), 0);
  assert.equal(await page.locator(`${faixa(I)} canvas[aria-hidden="true"]`).count(), 3); assert.equal(await page.locator(`${faixa(I)} canvas:not([aria-hidden])`).count(), 0);
}));
test('Antes/Depois: mantém a posição, continua a tocar, muda o LUFS em 12 dB e reinicia o pico', () => abrir({}, async (page) => {
  await tocar(page, M, 1500);
  assert.equal(await page.getAttribute(`${faixa(M)} [data-versao="depois"]`, 'aria-pressed'), 'true');
  const depois = num(await valor(page, M, 'lufs')), p1 = await pos(page, M);
  await page.click(`${faixa(M)} [data-versao="antes"]`); const p2 = await pos(page, M);
  assert.ok(Math.abs(p2 - p1) < 0.3); await page.waitForTimeout(1200);
  assert.equal(await estado(page, M), 'a-tocar'); assert.ok(await pos(page, M) > p2 + 0.8);
  perto(num(await valor(page, M, 'lufs')), depois - 12, 1); perto(num(await valor(page, M, 'pico')), -32, 0.5);
}));
test('clicar a meio da forma de onda põe a faixa a meio', () => abrir({}, async (page) => {
  await tocar(page, I, 400);
  const c = await page.locator(`${faixa(I)} .onda`).boundingBox(); await page.mouse.click(c.x + c.width / 2, c.y + c.height / 2); await page.waitForTimeout(100);
  perto(await pos(page, I), 3, 0.5); assert.equal(await estado(page, I), 'a-tocar');
}));
test('teclado na forma de onda: setas, Home e End', () => abrir({}, async (page) => {
  await tocar(page, I, 400); await page.focus(`${faixa(I)} .onda`);
  const p0 = await pos(page, I); await page.keyboard.press('ArrowRight'); perto((await pos(page, I)) - p0, 1, 0.4);
  await page.keyboard.press('Home'); assert.ok(await pos(page, I) < 0.6);
}));
test('Review Focus 4: End termina a faixa em ordem e fecha o painel', () => abrir({}, async (page, { erros }) => {
  await tocar(page, I, 400); await page.focus(`${faixa(I)} .onda`); await page.keyboard.press('End'); await page.waitForTimeout(800);
  assert.equal(await estado(page, I), 'parada'); assert.equal(await page.locator('.painel').count(), 0);
  assert.equal((await page.textContent(`${faixa(I)} .tempo`)).trim(), '0:06'); assert.deepEqual(erros, []);
  await tocar(page, I, 400); const c = await page.locator(`${faixa(I)} .onda`).boundingBox(); await page.mouse.click(c.x + c.width - 1, c.y + 10); await page.waitForTimeout(800);
  assert.equal(await estado(page, I), 'parada'); assert.deepEqual(erros, []);
}));
test('ficheiro inexistente: «Indisponível», sem afetar as outras', () => {
  const c = base(); c.categorias.instrumentais.faixas.push({ titulo: 'Em falta', ficheiro: 'audio/nao-existe.mp3' });
  return abrir({ conteudo: comoJs(c) }, async (page) => {
    await tocar(page, 'instrumentais-1', 600);
    assert.equal(await estado(page, 'instrumentais-1'), 'indisponivel'); assert.equal((await page.textContent(`${faixa('instrumentais-1')} .tempo`)).trim(), 'Indisponível');
    assert.ok(await page.isDisabled(`${faixa('instrumentais-1')} .play`)); assert.equal(await page.locator('.painel').count(), 0);
    await tocar(page, I, 400); assert.equal(await estado(page, I), 'a-tocar');
  });
});
test('sem onda.json a faixa toca e a linha de progresso muda a posição', () => abrir({ ficheiros: faixasTeste({ semOnda: true }) }, async (page) => {
  assert.equal((await page.textContent(`${faixa(I)} .tempo`)).trim(), '—:—');
  await tocar(page, I, 400); assert.equal(await estado(page, I), 'a-tocar');
  const c = await page.locator(`${faixa(I)} .onda`).boundingBox(); await page.mouse.click(c.x + c.width / 4, c.y + c.height / 2); await page.waitForTimeout(100);
  perto(await pos(page, I), 1.5, 0.5); assert.match((await page.textContent(`${faixa(I)} .tempo`)).trim(), /^0:0\d \/ 0:06$/);
}));
test('Review Focus 3: onda.json inválido é tratado como em falta', () => abrir({ ficheiros: { ...faixasTeste(), '/audio/i1.onda.json': '{"duracao":"x"}', '/audio/c1.onda.json': '{' } }, async (page, { erros }) => {
  assert.equal((await page.textContent(`${faixa(I)} .tempo`)).trim(), '—:—');
  await tocar(page, I, 400); assert.equal(await estado(page, I), 'a-tocar'); await tocar(page, 'cinematografico-0', 400); assert.equal(await estado(page, 'cinematografico-0'), 'a-tocar');
  assert.deepEqual(erros, []);
}));
test('movimento reduzido: sem espectro nem campo estéreo, com leituras', () => abrir({ movimentoReduzido: true }, async (page) => {
  await tocar(page, I, 1500);
  assert.equal(await page.locator('figure.inst').count(), 0); assert.notEqual(await valor(page, I, 'lufs'), '—');
}));
test('Review Focus 2: dois cliques no mesmo instante — só toca a última, sem erros', () => abrir({}, async (page, { erros }) => {
  await page.evaluate(() => { document.querySelector('[data-faixa="instrumentais-0"] .play').click(); document.querySelector('[data-faixa="mistura-0"] .play').click(); });
  await page.waitForTimeout(800);
  assert.deepEqual(await page.$$eval('.faixa', (f) => f.map((x) => x.dataset.estado)), ['parada', 'a-tocar', 'parada']); assert.deepEqual(erros, []);
}));
test('abrir o index.html do disco usa o modo simples', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-')), raiz = path.join(__dirname, '..');
  for (const f of ['index.html', 'estilo.css', 'js', 'fontes']) fs.cpSync(path.join(raiz, f), path.join(dir, f), { recursive: true });
  const c = base(); c.categorias.instrumentais.faixas[0].ficheiro = 'audio/i1.wav';
  fs.mkdirSync(path.join(dir, 'audio')); fs.writeFileSync(path.join(dir, 'audio/i1.wav'), wav({ segundos: 6 })); fs.writeFileSync(path.join(dir, 'conteudo.js'), comoJs(c));
  await comPagina({ ficheiro: path.join(dir, 'index.html') }, async (page) => {
    await tocar(page, I, 700); assert.equal(await estado(page, I), 'a-tocar');
    assert.equal(await page.locator('.instrumentos, .leituras').count(), 0); assert.equal(await page.locator(`${faixa(I)} .onda`).count(), 1); assert.ok(await pos(page, I) > 0.3);
  });
});
test('Review Focus 5: título longo, 390 px e rotação com o painel aberto, sem deslocação horizontal', () => {
  const c = base(); c.categorias.instrumentais.faixas[0].titulo = 'A'.repeat(80);
  return abrir({ conteudo: comoJs(c), largura: 390, altura: 800 }, async (page) => {
    const sobra = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(await sobra() <= 0); await tocar(page, I, 600); assert.ok(await sobra() <= 0);
    assert.equal(await page.$eval(`${faixa(I)} .onda`, (e) => getComputedStyle(e).touchAction), 'pan-y');
    await page.setViewportSize({ width: 600, height: 800 }); await page.waitForTimeout(300); assert.ok(await sobra() <= 0);
    const [w, cw] = await page.$eval(`${faixa(I)} .onda`, (e) => [e.getBoundingClientRect().width, e.querySelector('canvas').width]); perto(cw, w, 1);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/painel.test.cjs tests/pagina.test.cjs`
Expected: FAIL (o painel e as funções novas não existem).

- [ ] **Step 3: Implement in `js/pagina.js`** `decidirModo`, `validarOnda`, `ondaUrl` e a ligação do leitor em `iniciar`:
  - Modo: `decidirModo` com `location.protocol`, `AudioContext`, deteção de iOS (`/iP(hone|ad|od)/` no `userAgent`, ou `MacIntel` com `maxTouchPoints > 1`) e `'audioSession' in navigator`. Em modo completo, pedir logo `ondaUrl(url)` e `ondaUrl(urlAntes)` de cada faixa, validar com `validarOnda` e, ao chegarem, escrever a duração no `.tempo` das faixas paradas (na mistura vale a do «Depois»). Em modo simples não se pedem.
  - Clique no play: faixa nova → `parar()` e fechar a ativa, `leitor.tocar(faixa)`, abrir o painel; ativa a tocar → `pausar` (`em-pausa`); ativa em pausa → `retomar`. `aoFim` fecha o painel e volta a `parada` com a duração no `.tempo`; `aoErro` põe `indisponivel`, «Indisponível» no `.tempo`, botão desativado e fecha o painel.
  - Painel: ao abrir, as leituras mostram «—» até haver som. O `.onda` mostra a forma de onda da versão escolhida (linha fina se não houver picos válidos ou em modo simples). Modo simples: o painel só tem o `.onda`. Movimento reduzido: sem as duas `figure.inst`, e a onda e as leituras atualizam 2 vezes por segundo.
  - Controlo de posição: `role=slider`, `aria-valuemin=0`, `aria-valuemax` e `aria-valuenow` em segundos (duas casas), `aria-valuetext` «0:42 / 3:15»; ponteiro (pausa durante o arrasto e retoma ao largar) e teclado (setas ±5 % da faixa, no mínimo 1 s; Home; End). `.tempo` da faixa ativa mostra «0:42 / 3:15» (duração da onda, ou a do áudio quando não há onda).
  - Antes/Depois: ligar os botões; `aria-pressed`; com a faixa ativa chamar `trocarVersao`, trocar os picos da onda e `medidor.reiniciarPico()`; com a faixa parada só guarda a versão a tocar.
  - Ciclo de desenho com `requestAnimationFrame` só enquanto toca: ler `leitor.amostras` e `leitor.espectro`, `medidor.atualizar(esq, dir, agora)`, `Analise.bandasEspectro`, desenhar, escrever as leituras só quando o texto muda (pico e RMS com « dB», LUFS sem unidade; a barra do Nível usa `nivel` e `marcaNivel`). Em pausa fica a última imagem. Um redesenho extra em pausa, ao procurar e em `resize`.
  - `estilo.css`: portar do protótipo `.painel`, `.onda`, `.instrumentos`, `.inst`, `.tela`, `.leituras`, `.nivel`; `.onda { height: 56px; touch-action: pan-y; cursor: pointer }`; play preenchido a preto em `a-tocar` e `em-pausa`; a 640 px ou menos o espectro e o campo estéreo ficam um por baixo do outro.

- [ ] **Step 4: Run to verify they pass**

Run: `node --test tests/painel.test.cjs tests/pagina.test.cjs`
Expected: PASS (15 testes de painel, 16 de página, cerca de 60 s).

- [ ] **Step 5: Compare with the approved prototype** — abrir uma faixa a tocar com `base()` e `faixasTeste()`, capturar 1280 px e 390 px (no scratchpad) e comparar com `docs/referencias/leitor-prototipo.html` (opção 2 · Completa). Corrigir as diferenças.

- [ ] **Step 6: Commit**

```bash
git add js/pagina.js estilo.css index.html tests
git commit -m "feat: add instrument panel, seeking, Antes/Depois and simple mode"
git -c push.negotiate=true push -u origin claude/quirky-johnson-w78lqq
```

---

### Task 6: Verificação do conteúdo (`ferramentas/verificar-conteudo.mjs`)

**Files:**
- Create: `ferramentas/verificar-conteudo.mjs`
- Test: `tests/verificar-conteudo.test.cjs`

**Interfaces:**
- Consumes: nada.
- Produces: `node ferramentas/verificar-conteudo.mjs [raiz = .]` lê `<raiz>/conteudo.js` (avaliado com `vm`, com `window = {}`) e verifica os MP3 relativamente a `<raiz>`. Escreve tudo em `stdout`; código de saída 0 se estiver completo, 1 se houver problemas. Mensagens (uma por linha):
  - `Não encontrei o conteudo.js em «<raiz>».`
  - `conteudo.js: erro de escrita na linha <n> — <detalhe>.`
  - `Falta preencher «<caminho>»: ainda tem «<valor>».` (valor inteiro entre `[` e `]`; `<caminho>` como `categorias.instrumentais.faixas[0].titulo`)
  - `Falta o campo «<campo>» na faixa <n> de «<categoria>».` (`n` a partir de 1; obrigatórios: `titulo`, e `ficheiro` ou, na mistura, `antes` e `depois`)
  - `Falta o campo «nome».`
  - `Categoria desconhecida «<chave>».` (só `instrumentais`, `mistura`, `cinematografico`)
  - `Falta o ficheiro «<caminho>» (faixa «<título>»).`
  - Fim: `<n> problema(s) encontrado(s). Nada foi publicado.` ou `Conteúdo completo: <faixas> faixas, <ficheiros> ficheiros de áudio.`

- [ ] **Step 1: Write the failing tests** — `tests/verificar-conteudo.test.cjs`

```js
// tests/verificar-conteudo.test.cjs
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { spawnSync } = require('node:child_process');
const { base, comoJs } = require('./apoio/conteudo.cjs');
const FERR = path.join(__dirname, '..', 'ferramentas', 'verificar-conteudo.mjs');
const MP3 = ['audio/i1.mp3', 'audio/m1-antes.mp3', 'audio/m1-depois.mp3', 'audio/c1.mp3'];
function projeto(js, ficheiros = MP3) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-'));
  if (js !== null) fs.writeFileSync(path.join(dir, 'conteudo.js'), js);
  for (const f of ficheiros) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), 'x'); }
  return dir;
}
const correr = (dir) => spawnSync(process.execPath, [FERR, dir], { encoding: 'utf8' });

test('passa com conteúdo completo', () => { const r = correr(projeto(comoJs(base()))); assert.equal(r.status, 0); assert.match(r.stdout, /Conteúdo completo: 3 faixas, 4 ficheiros de áudio\./); });
test('falha com um valor entre parênteses retos', () => {
  const c = base(); c.categorias.instrumentais.faixas[0].titulo = '[Nome da faixa]';
  const r = correr(projeto(comoJs(c))); assert.equal(r.status, 1); assert.match(r.stdout, /Falta preencher «categorias\.instrumentais\.faixas\[0\]\.titulo»: ainda tem «\[Nome da faixa\]»\./); assert.match(r.stdout, /1 problema\(s\) encontrado\(s\)\. Nada foi publicado\./);
});
test('um valor com parênteses a meio é válido', () => { const c = base(); c.categorias.instrumentais.faixas[0].titulo = 'Song [Remix]'; assert.equal(correr(projeto(comoJs(c))).status, 0); });
test('falha com um MP3 em falta', () => { const r = correr(projeto(comoJs(base()), MP3.slice(1))); assert.equal(r.status, 1); assert.match(r.stdout, /Falta o ficheiro «audio\/i1\.mp3» \(faixa «[^»]+»\)\./); });
test('falha com erro de escrita', () => { const r = correr(projeto('window.CONTEUDO = { nome: "X" categorias: {} };')); assert.equal(r.status, 1); assert.match(r.stdout, /conteudo\.js: erro de escrita na linha 1 — /); });
test('falha com campo obrigatório em falta', () => {
  const c = base(); delete c.categorias.instrumentais.faixas[0].titulo; delete c.categorias.mistura.faixas[0].antes; delete c.nome;
  const r = correr(projeto(comoJs(c))); assert.equal(r.status, 1);
  assert.match(r.stdout, /Falta o campo «titulo» na faixa 1 de «instrumentais»\./); assert.match(r.stdout, /Falta o campo «antes» na faixa 1 de «mistura»\./); assert.match(r.stdout, /Falta o campo «nome»/);
});
test('falha com categoria desconhecida', () => { const c = base(); c.categorias.instrumental = c.categorias.instrumentais; const r = correr(projeto(comoJs(c))); assert.equal(r.status, 1); assert.match(r.stdout, /Categoria desconhecida «instrumental»\./); });
test('falha sem conteudo.js', () => { const r = correr(projeto(null, [])); assert.equal(r.status, 1); assert.match(r.stdout, /Não encontrei o conteudo\.js/); });
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/verificar-conteudo.test.cjs`
Expected: FAIL (a ferramenta não existe: estado ≠ 0/1 esperado, saída vazia).

- [ ] **Step 3: Implement `ferramentas/verificar-conteudo.mjs`** — percorre o objeto em profundidade para os valores entre parênteses retos; valida campos obrigatórios por categoria e confirma que cada MP3 existe (`fs.existsSync(path.join(raiz, ficheiro))`); acumula todos os problemas antes de terminar (não pára no primeiro).

- [ ] **Step 4: Run to verify they pass**

Run: `node --test tests/verificar-conteudo.test.cjs`
Expected: PASS (8 testes).

- [ ] **Step 5: Commit**

```bash
git add ferramentas/verificar-conteudo.mjs tests/verificar-conteudo.test.cjs
git commit -m "feat: add content verification tool with Portuguese messages"
git -c push.negotiate=true push -u origin claude/quirky-johnson-w78lqq
```

---

### Task 7: Formas de onda (`ferramentas/gerar-ondas.mjs`)

**Files:**
- Create: `ferramentas/gerar-ondas.mjs`
- Test: `tests/gerar-ondas.test.cjs`

**Interfaces:**
- Consumes: `tests/apoio/sinal.cjs` (`wav`), `ffmpeg`.
- Produces: `node ferramentas/gerar-ondas.mjs [pasta = audio]` procura `*.mp3` (qualquer caixa, em subpastas) e escreve ao lado de cada um `<nome>.onda.json` = `{"duracao": <s, 2 casas>, "picos": [800 inteiros 0–255]}`. Decodifica com `ffmpeg -v error -nostdin -i <ficheiro> -f s16le -ac 1 -ar 22050 pipe:1`; `duracao` = amostras / 22050; pico `i` = máximo absoluto do bloco `[⌊i·n/800⌋, ⌊(i+1)·n/800⌋)` × 255 / 32768, arredondado e limitado a 255. Escreve em `stdout`: `<ficheiro>: <duração com vírgula> s` por ficheiro, `Aviso: não consegui ler <ficheiro> (<motivo>). Essa faixa fica sem forma de onda.` quando falha (ou com menos de 800 amostras), e `<n> de <m> ficheiros preparados.` no fim. Código 0, exceto sem `ffmpeg` (código 1, `É preciso o ffmpeg instalado para preparar as formas de onda.`).

- [ ] **Step 1: Write the failing tests** — `tests/gerar-ondas.test.cjs`

```js
// tests/gerar-ondas.test.cjs
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { spawnSync } = require('node:child_process');
const { wav } = require('./apoio/sinal.cjs');
const FERR = path.join(__dirname, '..', 'ferramentas', 'gerar-ondas.mjs');
const temFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
function pasta() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'go-')); fs.mkdirSync(path.join(dir, 'mistura'));
  fs.writeFileSync(path.join(dir, 'a.wav'), wav({ segundos: 3, db: -6 }));
  for (const destino of ['a.mp3', 'mistura/x-antes.MP3']) assert.equal(spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(dir, 'a.wav'), '-b:a', '192k', path.join(dir, destino)]).status, 0);
  return dir;
}
const correr = (dir, env) => spawnSync(process.execPath, [FERR, dir], { encoding: 'utf8', env });

test('cria o .onda.json com a duração e 800 picos', { skip: !temFfmpeg }, () => {
  const dir = pasta(), r = correr(dir); assert.equal(r.status, 0); assert.match(r.stdout, /2 de 2 ficheiros preparados\./);
  const j = JSON.parse(fs.readFileSync(path.join(dir, 'a.onda.json'), 'utf8'));
  assert.ok(Math.abs(j.duracao - 3) <= 0.05); assert.equal(j.picos.length, 800); assert.ok(j.picos.every((p) => Number.isInteger(p) && p >= 0 && p <= 255));
  const mediana = [...j.picos].sort((a, b) => a - b)[400]; assert.ok(mediana >= 120 && mediana <= 135, `mediana ${mediana}`);   // −6 dB ≈ 124–128 (medido: 124, por causa da reamostragem a 22,05 kHz)
  assert.ok(fs.existsSync(path.join(dir, 'mistura', 'x-antes.onda.json')));
});
test('ficheiro ilegível: avisa e continua', { skip: !temFfmpeg }, () => {
  const dir = pasta(); fs.writeFileSync(path.join(dir, 'lixo.mp3'), 'isto não é áudio');
  const r = correr(dir); assert.equal(r.status, 0); assert.match(r.stdout, /Aviso: não consegui ler .*lixo\.mp3/); assert.match(r.stdout, /2 de 3 ficheiros preparados\./);
  assert.ok(!fs.existsSync(path.join(dir, 'lixo.onda.json'))); assert.ok(fs.existsSync(path.join(dir, 'a.onda.json')));
});
test('sem ffmpeg: falha com uma mensagem clara', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'go-')); fs.writeFileSync(path.join(dir, 'a.mp3'), 'x');
  const r = correr(dir, { PATH: '' }); assert.equal(r.status, 1); assert.match(r.stdout, /É preciso o ffmpeg instalado/);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/gerar-ondas.test.cjs`
Expected: FAIL (a ferramenta não existe).

- [ ] **Step 3: Implement `ferramentas/gerar-ondas.mjs`** com `child_process.spawnSync('ffmpeg', …, { maxBuffer: 512 MB })` e `fs.readdirSync(…, { recursive: true })`; sem dependências.

- [ ] **Step 4: Run to verify they pass**

Run: `node --test tests/gerar-ondas.test.cjs`
Expected: PASS (3 testes; os dois primeiros ficam «skipped» se não houver ffmpeg).

- [ ] **Step 5: Commit**

```bash
git add ferramentas/gerar-ondas.mjs tests/gerar-ondas.test.cjs
git commit -m "feat: add waveform generation tool using ffmpeg"
git -c push.negotiate=true push -u origin claude/quirky-johnson-w78lqq
```

---

### Task 8: Automação de publicação e README

**Files:**
- Create: `.github/workflows/publicar.yml`, `tests/publicacao.test.cjs`
- Modify: `README.md` (substituir o conteúdo de uma linha)

**Interfaces:**
- Consumes: `ferramentas/verificar-conteudo.mjs`, `ferramentas/gerar-ondas.mjs`.
- Produces: workflow «Publicar» (`push` em `main` e `workflow_dispatch`) com permissões `contents: read`, `pages: write`, `id-token: write`; `concurrency: pages`.

- [ ] **Step 1: Write the failing tests** — `tests/publicacao.test.cjs`

```js
// tests/publicacao.test.cjs
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const raiz = path.join(__dirname, '..'), ler = (f) => fs.readFileSync(path.join(raiz, f), 'utf8');

test('o workflow publica no push para main e verifica antes de preparar e publicar', () => {
  const y = ler('.github/workflows/publicar.yml');
  assert.match(y, /push:\s*\n\s*branches:\s*\[main\]/); assert.match(y, /workflow_dispatch:/); assert.match(y, /pages: write/); assert.match(y, /id-token: write/);
  const i = (s) => y.indexOf(s);
  assert.ok(i('verificar-conteudo.mjs') > 0 && i('verificar-conteudo.mjs') < i('gerar-ondas.mjs') && i('gerar-ondas.mjs') < i('upload-pages-artifact') && i('upload-pages-artifact') < i('deploy-pages'));
});
test('o workflow copia só os ficheiros do site para _site', () => {
  const linha = ler('.github/workflows/publicar.yml').split('\n').find((l) => /cp -r .* _site\/?\s*$/.test(l));
  assert.ok(linha, 'falta o cp -r para _site'); assert.deepEqual(linha.trim().replace(/^cp -r /, '').replace(/ _site\/?$/, '').split(' ').sort(), ['audio', 'conteudo.js', 'estilo.css', 'fontes', 'index.html', 'js']);
});
test('.gitignore ignora as formas de onda geradas e a pasta de publicação', () => { const g = ler('.gitignore').split('\n'); assert.ok(g.includes('*.onda.json') && g.includes('_site/')); });
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/publicacao.test.cjs`
Expected: FAIL (o workflow não existe).

- [ ] **Step 3: Create `.github/workflows/publicar.yml`**

```yaml
name: Publicar
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  publicar:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Verificar o conteúdo
        run: node ferramentas/verificar-conteudo.mjs
      - name: Instalar o ffmpeg
        run: sudo apt-get update -qq && sudo apt-get install -y -qq ffmpeg
      - name: Preparar as formas de onda
        run: node ferramentas/gerar-ondas.mjs audio
      - name: Juntar os ficheiros do site
        run: |
          mkdir -p _site audio fontes
          cp -r index.html estilo.css conteudo.js js audio fontes _site/
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: _site
      - id: deployment
        uses: actions/deploy-pages@v4
```
  As versões das ações (`checkout@v4`, `setup-node@v4`, `configure-pages@v5`, `upload-pages-artifact@v3`, `deploy-pages@v4`) não puderam ser confirmadas daqui (o github.com não é acessível a partir desta sessão). Se a primeira execução avisar de versões antigas, subir a versão maior indicada no aviso.

- [ ] **Step 4: Write `README.md`** (pt-PT, curto) com quatro secções: **Como acrescentar uma faixa** (copiar o MP3 para a pasta certa de `audio/`, juntar um bloco à lista em `conteudo.js`, na mistura indicar `antes` e `depois`); **Ver no computador** (duplo clique no `index.html` abre o modo simples; para o painel completo, `python3 -m http.server` na pasta e abrir `http://localhost:8000`; as formas de onda locais vêm de `node ferramentas/gerar-ondas.mjs`, precisa do ffmpeg); **Publicar** (juntar ao `main`; a automação corre sozinha; primeira vez: Settings → Pages → Source → **GitHub Actions**; endereço https://cfvvhzt2gv-wq.github.io/portfolio; se falhar, ler o erro no separador Actions); **Testes** (`node --test`; precisa de Playwright e, para as ferramentas, de ffmpeg).

- [ ] **Step 5: Validate the workflow and dry-run its steps**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/publicar.yml')); print('yaml ok')"`
Expected: `yaml ok`.

Dry-run (copiar o repositório para uma pasta temporária, trocar o `conteudo.js` e os `audio/` por um conteúdo de teste completo com os quatro MP3 gerados pelo ffmpeg, e correr os passos `verificar`, `gerar` e `juntar` do workflow): o `_site` resultante tem exatamente `index.html estilo.css conteudo.js js audio fontes` e `audio/` inclui os `.onda.json`; `docs/`, `tests/`, `ferramentas/` e `.github/` não estão lá.

- [ ] **Step 6: Run to verify they pass**

Run: `node --test tests/publicacao.test.cjs`
Expected: PASS (3 testes).

- [ ] **Step 7: Commit — em dois commits, o workflow por último**

```bash
git add README.md tests/publicacao.test.cjs
git commit -m "docs: add README and publication checks"
git add .github/workflows/publicar.yml
git commit -m "feat: add GitHub Actions workflow to verify, prepare waveforms and publish"
git -c push.negotiate=true push -u origin claude/quirky-johnson-w78lqq
```
Se o push for recusado por causa de `.github/workflows` (falta a permissão `workflow`): não insistir. Guardar uma cópia do ficheiro fora do repositório (scratchpad) e correr `git reset --hard HEAD~1`, que só desfaz o commit local do workflow, ainda não enviado. Repetir o push e entregar o ficheiro ao Afonso para o criar no GitHub (Add file → Create new file, no ramo `claude/quirky-johnson-w78lqq`, caminho `.github/workflows/publicar.yml`). Depois, `git pull` e confirmar que o ficheiro é idêntico à cópia guardada.

---

### Task 9: Verificação final e entrega

**Files:** nenhum novo (só correções).

- [ ] **Step 1: Run the whole suite**

Run: `node --test`
Expected: todos os testes passam (cerca de 70 s; os de ffmpeg passam ou ficam «skipped» com a razão dita).

- [ ] **Step 2: Check the published subset end to end** — com o `_site` do dry-run da Tarefa 8, servir só essa pasta e abrir a página no Chromium com o conteúdo de teste: nenhuma resposta 404 exceto as de ficheiros que o teste não gerou, e uma faixa toca com o painel completo.

- [ ] **Step 3: Check the repository** — `git status` limpo; `git ls-files` não contém `*.onda.json`, `_site` nem ficheiros temporários; `git log --oneline` com um commit por tarefa.

- [ ] **Step 4: Hand over to Afonso** — dizer, em português e sem jargão:
  1. O que está feito e testado, e o que não pôde ser testado aqui: iPhone real (com e sem modo silencioso), o primeiro arranque da automação no GitHub, a deteção de versões antigas das ações.
  2. O que falta fornecer (spec §10): DAWs e qual é a principal, técnicas, local, e-mail, redes, os MP3 de cada faixa (na mistura, antes e depois) e, opcional, uma frase por categoria.
  3. O que fazer a seguir: ouvir o site num iPhone; aprovar; juntar o ramo ao `main` (perguntar se quer que se abra um pull request, **sem o abrir sem pedido**); ativar Settings → Pages → Source → GitHub Actions; confirmar o endereço https://cfvvhzt2gv-wq.github.io/portfolio.
  4. Que, enquanto o `conteudo.js` tiver campos entre [parênteses retos] ou MP3 em falta, a automação não publica e o site fica como estava.
