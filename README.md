# Comissão de Afastamentos Docentes — Departamento de Administração (FACC/UFRJ)

Sistema de fila de manifestação de interesse em afastamento docente, com painel restrito para a comissão. Arquivo único, autocontido: `comissao_afastamentos.html`.

Base normativa: minuta **29/04/2026 — Regras de afastamento, nova versão com sugestões do departamento**.

- Aplicação: https://afastamentos-adm-ufrj.vercel.app
- Repositório: https://github.com/lauravp84/afastamentos-adm-ufrj

## O que é
Aplicação web (HTML + CSS + JS puro) sem dependências externas. Persistência local com fallback automático: usa `window.storage` quando disponível (ambiente de artifacts) e `localStorage` quando o arquivo é aberto direto no navegador, gravando nos dois. Perfis de uso:

- Docente (aberto): manifesta interesse, consulta a fila pública e as regras.
- Comissão (restrito por senha): vê todos os dados, filtra, acompanha o trâmite, recebe recomendação de organização e emite parecer.

## Telas
1. Manifestar interesse: formulário com campos padronizados, aviso por tipo de afastamento, verificação de prazo e checagem de coerência entre data de início, período e duração.
2. Fila pública: ordenação cronológica por filas separadas e por período, com busca, posição, situação e indicação de quem ocupa o período por afastamento iniciado antes.
3. Painel da comissão: indicadores, próximas ações do trâmite, filtros, assistente de organização, parecer, backup e exportação CSV. Acesso por senha (hash SHA-256, primeiro acesso define a senha).
4. Regras e fluxo: resumo da minuta, incluindo o contexto (por que a comissão existe, como substitutos são solicitados, por que a antecedência importa).

## Regras implementadas
- Fila cronológica e soberana, constituindo manifestação formal de intenção para planejamento, sem configurar solicitação formal nem gerar direito adquirido.
- Desempate hierárquico: menor número de afastamentos no departamento, maior tempo de casa (ano de ingresso), classe e nível mais avançados.
- Limite de **2 docentes afastados por período**, contando pós-doutorado, doutorado e capacitação fora do recesso. Capacitação no recesso e eventos ficam de fora.
- O afastamento que atravessa dois períodos **ocupa vaga nos dois**, e o sistema mostra isso na fila pública, nos alertas e no assistente.
- Dois docentes da mesma área não se afastam juntos, salvo cobertura indicada (substituto, remanejamento aderente ou redistribuição).
- Capacitação em fila separada; doutorado e pós-doutorado compartilham a mesma fila.
- Prazos: manifestação com 1 ano de antecedência; solicitação válida com a documentação enviada à comissão com no mínimo 6 meses.
- Tipos: Pós-doutorado, Doutorado, Capacitação/estudos e Evento/simpósio/missão.
- Pós-doutorado de 6 a 12 meses; período pretendido com início e fim, limitado a 2 períodos.
- Checklist da documentação exigida pela minuta: período, duração, tipo de licença, plano de trabalho e carta-convite. A solicitação só é considerada válida com os cinco itens.
- Acompanhamento do trâmite: parecer da comissão, aprovação no colegiado, abertura do processo no SEI, Congregação, publicação da portaria e pedido de substituto (vaga anual ou emergencial), com indicação da próxima ação e de quem é a responsabilidade.
- Marcação de caso excepcional não previsto, avaliado pela comissão.
- Repactuação quando o docente não se afasta no período: impedimento institucional ou perda de prazo preservam a prioridade; desistência voluntária vai para o fim da fila. Histórico preservado para auditoria.

## Parâmetro interno (não previsto na minuta)
O teto percentual do quadro efetivo afastado simultaneamente é parâmetro auxiliar de planejamento da comissão. Vem **desativado** por padrão (`pct=0`). Quando ativado, coexiste com o limite de 2 por período e vale o menor dos dois. Configurável em Quadro/teto.

## Estrutura de dados (registro na fila)
Guardado sob a chave `afastamentos:db`, objeto com `registros` e `config`:

```
id, ts, tsFila (ordenação; muda só em desistência voluntária),
nome, email, siape, area, classe, nivel, ingresso, numaf,
tipo, fila (dout_pos | capac | evento), recesso,
periodo (início), periodoFim, inicio (data), dur (meses),
jaPosdoc, anoPosdoc, lic, carta, plano, orient, disc, cob, destino, just,
status (manifestado | em_analise | doc_pendente | favoravel | desfavoravel | concluido),
docs {periodo, duracao, licenca, plano, carta},
tram {colegiado, sei, congregacao, portaria, substituto, via},
parecer, excecional, visto, repact[] (histórico de repactuações)
```

`config`: `emailComissao`, `comHash` (senha da comissão), `quadro`, `pct`, `areas[]`.

Registros criados nas versões anteriores são migrados automaticamente na abertura (campos `docs` e `tram` derivados dos dados existentes).

## Como rodar
Abrir `comissao_afastamentos.html` no navegador. No painel da comissão, o primeiro acesso define a senha. Configurar quadro/teto, e-mail da comissão e lista de áreas nos botões do painel. Use **Backup** com regularidade, pois os dados ficam no navegador em que o arquivo é usado.

## Limitação atual e próximos passos
A persistência local e o login client-side não oferecem segurança real nem acesso multidispositivo. Para produção:

1. Migrar persistência para backend (Vercel + KV, no padrão dos demais apps).
2. Autenticação real da comissão (senha protegida no servidor, papéis por e-mail institucional).
3. Envio automático de cópia à comissão quando um docente registra interesse (Gmail/SMTP), substituindo o `mailto`.
4. Opcional: limite de repactuações por impedimento antes de exigir reanálise.
5. Opcional: alertas por e-mail nos marcos do trâmite (portaria pendente, prazo de 6 meses se aproximando).

## Assinatura
Profª Laura V.
