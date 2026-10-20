# Comissão de Afastamentos — Departamento de Administração

Sistema de fila de manifestação de interesse em afastamento docente, com painel restrito para a comissão, três acessos nomeados e histórico de alterações.

Base normativa: minuta **29/04/2026 — Regras de afastamento, nova versão com sugestões do departamento**.

- Aplicação: https://afastamentosadm.vercel.app
- Repositório: https://github.com/lauravp84/afastamentosadm

## Arquitetura
- `comissao_afastamentos.html` — aplicação inteira em HTML, CSS e JS puro, sem dependências.
- `api/app.js` — função serverless única no Vercel. Todas as operações chegam por `POST /api/app` com `{ acao }`.
- `vercel.json` — faz a raiz do site abrir o HTML.
- `package.json` — dependências: `redis` (node-redis) e `@vercel/blob`.
- Banco: Redis Cloud, plano gratuito, conectado ao projeto no Vercel pela variável `REDIS_URL`.
- Anexos: Vercel Blob em modo **privado** (`BLOB_READ_WRITE_TOKEN`). Os arquivos não têm URL pública; só são servidos pela API a quem está autenticado.

Chaves no banco: `af:usuarios`, `af:secret`, `af:registros`, `af:config`, `af:auditoria`.

## Acesso e identificação
- Docentes não fazem login nem cadastro. Se a comissão definir o código do departamento, ele é pedido uma vez a cada 30 dias.
- A comissão entra com **Google**, só com e-mail `@facc.ufrj.br` que esteja na lista de integrantes. O servidor confere o token no Google (`aud`, `email_verified`, `hd`) antes de abrir a sessão.
- Enquanto `GOOGLE_CLIENT_ID` não estiver configurado, ou como alternativa, cada integrante entra com o **e-mail institucional** e senha própria.
- Senhas gravadas como hash PBKDF2-SHA256 com 120 mil iterações e salt individual. O banco nunca guarda a senha legível.
- Sessão por token assinado (HMAC), válida por 12 horas.
- A configuração inicial cria os acessos na primeira vez que alguém abre o painel. Depois disso, novos usuários só podem ser criados por quem já está dentro.

## Histórico de alterações
Toda ação fica registrada com quem, quando e o quê:
- entrada no painel;
- manifestação registrada por docente;
- alteração de registro, campo a campo, no formato `status: Manifestado → Parecer favorável`;
- repactuação de período, exclusão de registro, mudança de configuração, criação e remoção de usuário, restauração de backup, troca de senha.

O histórico aparece no painel, é filtrável e exportável em CSV. Cada registro também mostra "última alteração por Fulana em tal data".

## Privacidade
A fila pública não expõe e-mail, SIAPE, justificativa, destino nem parecer. Esses campos só aparecem para quem está autenticado. A tela pública mostra nome, área, tipo, período, início e situação.

Os anexos ficam em armazenamento privado. Abrir um documento exige sessão ativa da comissão, e o download passa pela API, que confere a autenticação antes de servir o arquivo.

## Telas
A comissão é a instância inicial: acompanha o pedido até a aprovação na reunião de professores e depois só registra que o docente ficou afastado.

Público, sem login:
1. **Início**: "Pedir afastamento", "Ver a fila" e como funciona, em 4 passos.
2. **Pedir afastamento**: 3 etapas (Sobre você, O afastamento, Documentos), com botões de toque no lugar de listas. Anexos de até 3 MB.
3. **Pedido enviado**: posição na fila e o que falta entregar.
4. **Fila**: por ordem de pedido, separada pelo período de início, com as vagas de cada período.

Comissão:
5. **Pedidos**: em andamento e encerrados. Cada pedido abre um detalhe com **uma pergunta por etapa** (documentos, parecer, reunião de professores, afastado). Repactuar, excluir, caso excepcional e anexos ficam em "Mais opções".
6. **Vagas**: os próximos 4 períodos, quem ocupa cada vaga e aviso de duas pessoas da mesma área.
7. **Afastados**: quem já se afastou, com planilha CSV.
8. **Configurações** (link no rodapé): áreas, código do departamento, teto do quadro, integrantes, senha, backup, planilha completa e histórico.

## Situações
| Na tela | No banco |
|---|---|
| Falta documento | `doc_pendente` (ou `manifestado` sem plano e carta) |
| Esperando parecer | `em_analise` (ou `manifestado` com plano e carta) |
| Vai para a reunião | `favoravel` |
| Aprovado | `aprovado_reuniao` |
| Afastado | `concluido` |
| Não aprovado | `desfavoravel` ou `negado_reuniao` |

Pedido novo entra como `doc_pendente` e passa sozinho a `em_analise` quando plano e carta são anexados. Datas antigas de trâmite continuam gravadas, mas não aparecem mais.

## Cópia por e-mail
Cada pedido enviado manda uma cópia para `afastamento.adm@facc.ufrj.br` pelo FormSubmit (formsubmit.co), sem conta nem chave. No primeiro envio, a caixa recebe um e-mail "Activate Form" e é preciso clicar uma vez. Os dados do pedido passam pelo FormSubmit. Se o envio falhar, o pedido é registrado normalmente.

## Regras implementadas
- Fila cronológica e soberana, manifestação formal de intenção para planejamento, sem configurar solicitação formal nem gerar direito adquirido.
- Desempate hierárquico: menor número de afastamentos, maior tempo de casa, classe e nível mais avançados.
- Limite de **2 docentes afastados por período**, contando pós-doutorado, doutorado e capacitação fora do recesso. Capacitação no recesso e eventos ficam de fora.
- O afastamento que atravessa dois períodos **ocupa vaga nos dois**.
- Dois docentes da mesma área não se afastam juntos, salvo cobertura indicada.
- Prazos: manifestação com 1 ano de antecedência; solicitação válida com documentação entregue com no mínimo 6 meses.
- Tipos de licença: apenas **Pós-doutorado** e **Capacitação**. Eventos e simpósios seguem as regras da universidade e não entram nesta fila.
- Pós-doutorado de 6 a 12 meses; período limitado a 2 períodos.
- Checklist da documentação exigida: período, duração, tipo de licença, plano de trabalho e carta-convite.
- Repactuação com preservação ou perda de prioridade conforme o motivo.

## Parâmetro interno (não previsto na minuta)
O teto percentual do quadro efetivo afastado simultaneamente é parâmetro auxiliar da comissão. Vem desativado (`pct = 0`) e, quando ativado, vale o menor entre ele e o limite de 2.

## Variáveis de ambiente
- `REDIS_URL`, definida automaticamente ao conectar o banco ao projeto no Vercel.
- `BLOB_READ_WRITE_TOKEN`, definida ao conectar o Vercel Blob.
- `GOOGLE_CLIENT_ID`, para o login da comissão com Google. Crie um OAuth Client do tipo "Aplicativo da Web" no Google Cloud, com a origem `https://afastamentosadm.vercel.app`, e cole o ID do cliente aqui. Sem ela, a comissão entra com senha.

## Limitações conhecidas
- O plano gratuito do Redis Cloud é **RAM-only, sem persistência garantida**. Em caso de reinício ou falha do banco os dados podem ser perdidos. Use o botão **Backup** com regularidade. O plano de 250 MB com persistência custa a partir de 6 dólares por mês.
- Os registros ficam em uma única chave no Redis. Com três usuárias o risco de escrita simultânea é baixo, mas duas edições no mesmo segundo podem sobrepor uma à outra.
- O histórico guarda as últimas 800 entradas.
- Não há recuperação de senha por e-mail. Quem esquecer precisa que outra integrante crie um novo acesso.

## Próximos passos possíveis
1. Envio automático de e-mail à comissão quando um docente registra interesse.
2. Alertas de prazo por e-mail nos marcos do trâmite.
3. Recuperação de senha.
