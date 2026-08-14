# Comissão de Afastamentos — Departamento de Administração

Sistema de fila de manifestação de interesse em afastamento docente, com painel restrito para a comissão, três acessos nomeados e histórico de alterações.

Base normativa: minuta **29/04/2026 — Regras de afastamento, nova versão com sugestões do departamento**.

- Aplicação: https://afastamentosadm.vercel.app
- Repositório: https://github.com/lauravp84/afastamentosadm

## Arquitetura
- `comissao_afastamentos.html` — aplicação inteira em HTML, CSS e JS puro, sem dependências.
- `api/app.js` — função serverless única no Vercel. Todas as operações chegam por `POST /api/app` com `{ acao }`.
- `vercel.json` — faz a raiz do site abrir o HTML.
- `package.json` — única dependência: `redis` (node-redis).
- Banco: Redis Cloud, plano gratuito, conectado ao projeto no Vercel pela variável `REDIS_URL`.

Chaves no banco: `af:usuarios`, `af:secret`, `af:registros`, `af:config`, `af:auditoria`.

## Acesso e identificação
- Cada integrante da comissão entra com o **e-mail institucional** e senha própria.
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

## Regras implementadas
- Fila cronológica e soberana, manifestação formal de intenção para planejamento, sem configurar solicitação formal nem gerar direito adquirido.
- Desempate hierárquico: menor número de afastamentos, maior tempo de casa, classe e nível mais avançados.
- Limite de **2 docentes afastados por período**, contando pós-doutorado, doutorado e capacitação fora do recesso. Capacitação no recesso e eventos ficam de fora.
- O afastamento que atravessa dois períodos **ocupa vaga nos dois**.
- Dois docentes da mesma área não se afastam juntos, salvo cobertura indicada.
- Prazos: manifestação com 1 ano de antecedência; solicitação válida com documentação entregue com no mínimo 6 meses.
- Tipos: Pós-doutorado, Doutorado, Capacitação/estudos e Evento/simpósio/missão.
- Pós-doutorado de 6 a 12 meses; período limitado a 2 períodos.
- Checklist da documentação exigida: período, duração, tipo de licença, plano de trabalho e carta-convite.
- Acompanhamento do trâmite: parecer, colegiado, SEI, Congregação, portaria e pedido de substituto, com a próxima ação e o responsável.
- Repactuação com preservação ou perda de prioridade conforme o motivo.

## Parâmetro interno (não previsto na minuta)
O teto percentual do quadro efetivo afastado simultaneamente é parâmetro auxiliar da comissão. Vem desativado (`pct = 0`) e, quando ativado, vale o menor entre ele e o limite de 2.

## Variáveis de ambiente
`REDIS_URL`, definida automaticamente ao conectar o banco ao projeto no Vercel.

## Limitações conhecidas
- O plano gratuito do Redis Cloud é **RAM-only, sem persistência garantida**. Em caso de reinício ou falha do banco os dados podem ser perdidos. Use o botão **Backup** com regularidade. O plano de 250 MB com persistência custa a partir de 6 dólares por mês.
- Os registros ficam em uma única chave no Redis. Com três usuárias o risco de escrita simultânea é baixo, mas duas edições no mesmo segundo podem sobrepor uma à outra.
- O histórico guarda as últimas 800 entradas.
- Não há recuperação de senha por e-mail. Quem esquecer precisa que outra integrante crie um novo acesso.

## Próximos passos possíveis
1. Envio automático de e-mail à comissão quando um docente registra interesse.
2. Alertas de prazo por e-mail nos marcos do trâmite.
3. Recuperação de senha.
