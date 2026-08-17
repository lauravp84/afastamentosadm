# Design do sistema

Referência do visual aplicado em `comissao_afastamentos.html`. Serve para manter a coerência em qualquer alteração futura.

Base: pacote de handoff `design_handoff_comissao_afastamentos`, gerado em 17/08/2026 no Claude Design. A paleta terracota da versão anterior foi substituída por azul institucional.

## Princípios

1. **Texto escondido até ser pedido.** Nenhuma parede de parágrafos. O que for longo entra em bloco que abre ao clique, com título curto na frente.
2. **Uma cor de destaque só.** Azul institucional. Tudo o mais é superfície branca, tinta e cinza azulado. Cor de estado aparece apenas em etiqueta, selo ou faixa de aviso, nunca em área grande.
3. **Espaço em vez de linha.** Separação por respiro e hierarquia tipográfica, não por bordas e caixas empilhadas.
4. **Número grande comunica melhor que frase.** Prazos e limites viram algarismo em destaque com uma legenda curta.
5. **Cada tela responde uma pergunta.** Se a tela precisa de duas explicações, provavelmente são duas telas.

## Cores

Definidas como variáveis CSS em `:root`.

| Token | Valor | Uso |
|---|---|---|
| `--paper` | `#f7f9fc` | fundo da página |
| `--surface` | `#ffffff` | cartões, campos, tabelas |
| `--surface2` | `#f7f9fc` | fundo sutil, cartões de número, caixas de configuração |
| `--ink` | `#14213a` | títulos e nomes em destaque |
| `--ink2` | `#3a4358` | texto corrido |
| `--muted` | `#6b7488` | apoio, legendas, rótulos |
| `--line` | `#dfe5ee` | bordas de cartões, campos, botões secundários |
| `--line2` | `#eef2f7` | divisórias internas e linhas de tabela |
| `--dashed` | `#c9d2e2` | borda tracejada de anexo, borda em hover |
| `--placeholder` | `#98a0b0` | placeholder de campo e chevron |
| `--accent` | `#12326B` | destaque único: botão primário, link, emblema, marcador, aba ativa |
| `--accent-soft` | `#E4EBF7` | fundo de ícone, círculo de posição, etapa cumprida |
| `--accent-deep` | `#0A2149` | números grandes, hover do botão primário |
| `--header` | `#0B1F3F` | cabeçalho fixo, faixa da capa, balão de dica |
| `--header-text` | `#eef3fa` | texto sobre o cabeçalho |
| `--header-muted` | `#b7c3d8` | texto secundário sobre fundo escuro |
| `--nav-off` | `#93a1ba` | item de navegação inativo |

Estados: `--ok #3f7d52` sobre `--ok-bg #e8f1e9`; `--warn #9a6a12` sobre `--warn-bg #f8efdd`; `--bad #a8392a` sobre `--bad-bg #f7e5e1`; `--info #45526b` sobre `--info-bg #ebeef4`.

Regra: cor de estado nunca aparece como área grande. Só em etiqueta, selo ou faixa de aviso.

## Tipografia

Sans do sistema em tudo: `-apple-system, "Segoe UI", system-ui, Roboto, Arial, sans-serif`. Serifa (`.serif`, Georgia) apenas no título da capa e no emblema, uma vez por página.

| Papel | Tamanho | Peso |
|---|---|---|
| Título da capa | 46px, tracking `-1.4px` (34px abaixo de 720px) | 400 |
| Título de tela (`h2`) | 26px, tracking `-.5px` | 620 |
| Título de cartão (`.card h2`) | 19px, tracking `-.3px` | 620 |
| Texto corrido (`.crit`) | 14px, linha 1.65, máximo 70ch | 400 |
| Apoio (`.sub`) | 13.5px, máximo 70ch | 400 |
| Legenda (`.mini`) | 12px | 400 |
| Rótulo de campo | 12.5px | 600 |
| Rótulo de coluna de tabela | 11px, maiúsculas, tracking `.05em` | 700 |
| Número grande | 40px na capa, 36px no painel, tracking `-1px` | 700 |
| Etiqueta e selo | 11.5 a 12px | 600 a 700 |

## Raios, sombra e foco

- `--r 16px` em cartões, modais e blocos que abrem; `--r-sm 10px` em campos e botões; `999px` em etiquetas, pílulas e círculos.
- Sombra única: `0 1px 2px rgba(20,33,58,.04), 0 8px 24px -12px rgba(20,33,58,.10)`. Nada mais pesado. Sem gradiente em nenhum lugar.
- Anel de foco: `--ring 0 0 0 3px rgba(18,50,107,.14)` com borda `--accent`.
- Largura máxima do conteúdo 1160px, padding lateral 32px. Regras em 820px, tela de acesso em 420px.

## Componentes

**Cabeçalho** (`.hdr`): faixa fixa de 64px em `--header`. À esquerda, emblema 34px em `--accent` com a letra A em serifa e o nome da comissão. À direita, navegação em pílulas; a ativa em branco sobre `rgba(255,255,255,.16)`. Autenticada, aparece o bloco `.hdruser` com avatar de iniciais, nome e Sair, separado por uma linha vertical.

**Faixa da capa** (`.band`): bloco escuro logo abaixo do cabeçalho, largura total, emblema 52px, título em serifa e uma frase de objetivo. Só aparece na tela de início.

**Cartão** (`.card`): superfície branca, borda `--line`, raio 16, padding 26, sombra padrão.

**Atalho da capa** (`.cardlink`): ícone 40px em `--accent-soft`, título 15px e descrição 13px. Sobe 2px no hover.

**Fluxo em etapas** (`.fluxo` e `.et`): círculo 38px em `--accent-soft` com número em `--accent-deep`, ligado ao vizinho por linha de 2px em `--line`. Quatro colunas, duas abaixo de 1024px, uma abaixo de 720px sem as linhas.

**Número de destaque** (`.stat`): algarismo 40px em `--accent-deep` sobre `--surface2`, legenda curta abaixo.

**Indicador do painel** (`.kpi`): cartão branco com número 36px em `--accent-deep`.

**Fila em cartões** (`.grupo`, `.lista`, `.lin`): cada grupo de período e fila vira um cartão com linhas em grade `56px 1.6fr 1.2fr 1fr auto`. A posição é um círculo 34px em `--accent-soft`; o primeiro da fila fica preenchido em `--accent`.

**Navegação secundária** (`.subnav`): pílulas com borda. A ativa fica preenchida em `--accent`.

**Botões**: primário em `--accent` com texto branco, hover em `--accent-deep`; `.sec` claro com borda; `.sm` reduzido; `.ghost` só texto sublinhado; `.wide` de largura total.

**Campos**: borda `--line`, foco em `--accent` com o anel padrão.

**Anexo** (`.drop`): área com borda tracejada `--dashed`, ícone 34px em `--accent-soft`, rótulo e limite de tamanho. Ao escolher o arquivo, a borda vira sólida em `--accent` e o rótulo passa a mostrar nome e tamanho.

**Bloco que abre** (`.acc`): cartão com selo de categoria, título 16px e chevron que gira 180 graus. Um bloco aberto por vez dentro da seção; clicar no aberto fecha.

**Selo de regra** (`.pill` colorida): indica o tratamento que o sistema dá àquela regra. Quatro valores: verificado pelo sistema, acompanhado no painel, fora do sistema, procedimento interno.

**Selo de acesso** (`.selo`): pílula neutra com cadeado, no topo do painel.

**Faixa de aviso** (`.faixa`): pílula em cor de atenção com ícone de relógio, usada no topo do formulário.

**Trilha** (`.track` e `.seg`): quatro segmentos de 22x5px, raio total. Preenchidos em `--accent`, vazios em `--line`. A etapa do trâmite vai de 0 a 7 e é deduzida em `etapaIdx()` a partir das datas do trâmite, do status e da documentação entregue: interesse manifestado, documentação enviada, em análise, parecer emitido, aprovado no colegiado, processo no SEI, Congregação, portaria publicada. Etapa 0 preenche 1 segmento; etapa 1 preenche 2; etapas 2 e 3 preenchem 3; etapa 4 ou maior preenche 4. O nome da etapa aparece abaixo da trilha, e as datas já registradas ficam no `title`.

**Cartão de pedidos** (`.ped`): usado na Visão geral do painel, em grade `1.7fr 1fr` (`.visao`) com a coluna de Próximas ações ao lado. Quatro colunas: Docente, Tipo, Situação, Trâmite. Abaixo de 1024px a grade vira uma coluna; abaixo de 720px cada linha vira bloco empilhado.

**Tabelas**: cabeçalho sem fundo, maiúsculas de 11px. Linhas separadas por `--line2`, hover em `--surface2`.

**Dica** (`.info`): círculo cinza com `i` que vira `--accent` no hover e mostra um balão escuro de 250px.

## Ícones

SVG de traço, 18px, `stroke-width` 2, `stroke-linecap` e `stroke-linejoin` redondos, `fill:none`, `stroke:currentColor`. Nunca emoji.

## Responsivo

Dois pontos de corte. Em 1024px, as grades de quatro colunas passam a duas. Em 720px, tudo passa a uma coluna, o padding do main cai para 16px, as colunas auxiliares somem com `.hide-m`, a navegação do cabeçalho vira rolagem horizontal de pílulas, o título da capa cai para 34px e as linhas da fila viram blocos empilhados.

## O que não fazer

- Não usar gradiente.
- Não usar emoji como ícone.
- Não empilhar mais de dois níveis de caixa. Cartão dentro de cartão só no assistente de organização.
- Não escrever parágrafo de apoio com mais de duas linhas. Se precisar, vira bloco que abre.
- Não usar travessão nos textos da interface.
- Não citar a universidade nem a faculdade em nome, título, URL, emblema ou texto.

## Identidade

Emblema: quadrado de cantos arredondados em `--accent` com a letra A em serifa branca. Sem brasão, sem sigla de instituição.
