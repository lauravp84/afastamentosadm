// API da Comissão de Afastamentos — Departamento de Administração
// Função serverless única. Ações via POST { acao, ... }.
// Persistência: Redis (Redis Cloud) por conexão TCP, via pacote node-redis.

const crypto = require('crypto');
const { createClient } = require('redis');
const { put, get } = require('@vercel/blob');

const MAX_ARQ = 3 * 1024 * 1024;

const URL_DB = process.env.REDIS_URL || process.env.KV_URL || '';

const K = {
  users: 'af:usuarios',
  secret: 'af:secret',
  regs: 'af:registros',
  conf: 'af:config',
  audit: 'af:auditoria'
};
const MAX_AUDIT = 800;
const SESSAO_HORAS = 12;

// Conexão reaproveitada entre invocações da mesma instância serverless.
let cliente = null;
async function conectar() {
  if (!URL_DB) throw new Error('Banco de dados não configurado. Falta conectar o Redis ao projeto no Vercel.');
  if (cliente && cliente.isOpen) return cliente;
  cliente = createClient({ url: URL_DB, socket: { connectTimeout: 8000, reconnectStrategy: t => (t > 3 ? false : 200 * t) } });
  cliente.on('error', () => { });
  await cliente.connect();
  return cliente;
}
async function ler(chave, padrao) {
  const c = await conectar();
  const v = await c.get(chave);
  if (v == null) return padrao;
  try { return JSON.parse(v); } catch (e) { return padrao; }
}
async function gravar(chave, valor) {
  const c = await conectar();
  return c.set(chave, JSON.stringify(valor));
}
async function existe(chave) {
  const c = await conectar();
  return (await c.exists(chave)) === 1;
}
async function texto_bruto(chave) {
  const c = await conectar();
  return c.get(chave);
}

/* ---------- senhas e sessão ---------- */
function novoSalt() { return crypto.randomBytes(16).toString('hex'); }
function hashSenha(senha, salt) { return crypto.pbkdf2Sync(String(senha), salt, 120000, 32, 'sha256').toString('hex'); }
function conferemHash(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function assinar(id, secret) {
  const exp = Date.now() + SESSAO_HORAS * 3600 * 1000;
  const corpo = id + '.' + exp;
  return corpo + '.' + crypto.createHmac('sha256', secret).update(corpo).digest('hex');
}
function conferirToken(tok, secret) {
  if (!tok) return null;
  const p = String(tok).split('.');
  if (p.length !== 3) return null;
  const corpo = p[0] + '.' + p[1];
  const esperado = crypto.createHmac('sha256', secret).update(corpo).digest('hex');
  if (!conferemHash(esperado, p[2])) return null;
  if (Date.now() > +p[1]) return null;
  return p[0];
}
async function autenticar(req) {
  const cab = req.headers['authorization'] || '';
  const tok = cab.replace(/^Bearer\s+/i, '');
  const secret = await texto_bruto(K.secret);
  if (!secret) return null;
  const id = conferirToken(tok, secret);
  if (!id) return null;
  const usuarios = await ler(K.users, []);
  const u = usuarios.find(x => x.id === id && x.ativo !== false);
  return u ? { id: u.id, login: u.login, nome: u.nome } : null;
}

/* ---------- auditoria ---------- */
async function registrarAuditoria(quem, acao, alvo, detalhe) {
  const lista = await ler(K.audit, []);
  lista.unshift({ ts: new Date().toISOString(), quem, acao, alvo: alvo || '', detalhe: detalhe || '' });
  await gravar(K.audit, lista.slice(0, MAX_AUDIT));
}

/* ---------- utilidades ---------- */
const CAMPOS_PUBLICOS = ['id', 'nome', 'area', 'tipo', 'fila', 'recesso', 'periodo', 'periodoFim', 'inicio', 'dur', 'status', 'ts', 'tsFila'];
const ITENS_DOC = ['periodo', 'duracao', 'licenca', 'plano', 'carta'];
function versaoPublica(r) {
  const o = {};
  CAMPOS_PUBLICOS.forEach(c => { o[c] = r[c]; });
  o.docOk = ITENS_DOC.every(k => r.docs && r.docs[k]);
  o.repact = (r.repact || []).map(x => ({ de: x.de, para: x.para, motivo: x.motivo }));
  return o;
}
function texto(v) {
  if (v === true) return 'sim';
  if (v === false) return 'não';
  if (v == null || v === '') return 'vazio';
  return String(v);
}
const ROTULOS = {
  status: 'status', parecer: 'parecer', excecional: 'caso excepcional',
  'docs.periodo': 'doc. período', 'docs.duracao': 'doc. duração', 'docs.licenca': 'doc. tipo de licença',
  'docs.plano': 'doc. plano de trabalho', 'docs.carta': 'doc. carta-convite',
  'tram.colegiado': 'colegiado', 'tram.sei': 'SEI', 'tram.congregacao': 'Congregação',
  'tram.portaria': 'portaria', 'tram.substituto': 'substituto', 'tram.via': 'via do substituto'
};
function diferencas(antes, depois) {
  const out = [];
  ['status', 'parecer', 'excecional'].forEach(c => {
    if (String(antes[c] ?? '') !== String(depois[c] ?? '')) out.push(`${ROTULOS[c]}: ${texto(antes[c])} → ${texto(depois[c])}`);
  });
  ITENS_DOC.forEach(k => {
    const a = !!(antes.docs && antes.docs[k]), b = !!(depois.docs && depois.docs[k]);
    if (a !== b) out.push(`${ROTULOS['docs.' + k]}: ${texto(a)} → ${texto(b)}`);
  });
  ['colegiado', 'sei', 'congregacao', 'portaria', 'substituto', 'via'].forEach(k => {
    const a = (antes.tram && antes.tram[k]) || '', b = (depois.tram && depois.tram[k]) || '';
    if (a !== b) out.push(`${ROTULOS['tram.' + k]}: ${texto(a)} → ${texto(b)}`);
  });
  return out;
}
async function subirArquivo(pasta, arq) {
  if (!arq || !arq.dados) return null;
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('Armazenamento de anexos ainda não configurado no projeto.');
  const buf = Buffer.from(String(arq.dados), 'base64');
  if (!buf.length) throw new Error('Arquivo vazio.');
  if (buf.length > MAX_ARQ) throw new Error('Arquivo maior que 3 MB.');
  const nome = (limpar(arq.nome, 120).replace(/[^\w.\- ]/g, '_') || 'arquivo').slice(0, 120);
  const caminho = `${pasta}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${nome}`;
  const r = await put(caminho, buf, {
    access: 'private',
    contentType: limpar(arq.tipo, 80) || 'application/octet-stream',
    addRandomSuffix: false
  });
  return { pathname: r.pathname || caminho, nome, tipo: arq.tipo || '', tamanho: buf.length, em: new Date().toISOString() };
}
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
function novoId() { return Date.now().toString(36) + crypto.randomBytes(4).toString('hex'); }
function limpar(s, max) { return String(s ?? '').trim().slice(0, max || 300); }

/* ---------- handler ---------- */
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ erro: 'Use POST.' }); return; }
  let corpo = req.body;
  if (typeof corpo === 'string') { try { corpo = JSON.parse(corpo); } catch (e) { corpo = {}; } }
  corpo = corpo || {};
  const acao = corpo.acao;

  try {
    /* --- estado inicial, sem autenticação --- */
    if (acao === 'estado') {
      const usuarios = await ler(K.users, []);
      const conf = await ler(K.conf, {});
      res.json({ configurado: usuarios.length > 0, areas: conf.areas || null, emailComissao: conf.emailComissao || '' });
      return;
    }

    /* --- setup: só quando não há nenhum usuário --- */
    if (acao === 'setup') {
      const usuarios = await ler(K.users, []);
      if (usuarios.length) { res.status(409).json({ erro: 'O sistema já foi configurado. Use a tela de entrada.' }); return; }
      const lista = Array.isArray(corpo.usuarios) ? corpo.usuarios : [];
      if (lista.length < 1) { res.status(400).json({ erro: 'Informe ao menos um usuário.' }); return; }
      const logins = new Set();
      const novos = [];
      for (const u of lista) {
        const login = limpar(u.login, 40).toLowerCase();
        const nome = limpar(u.nome, 90);
        const senha = String(u.senha || '');
        if (!login || !nome) { res.status(400).json({ erro: 'Todo usuário precisa de nome e e-mail.' }); return; }
        if (!EMAIL.test(login)) { res.status(400).json({ erro: 'E-mail inválido: ' + login }); return; }
        if (senha.length < 8) { res.status(400).json({ erro: 'A senha de ' + nome + ' precisa de pelo menos 8 caracteres.' }); return; }
        if (logins.has(login)) { res.status(400).json({ erro: 'E-mail repetido: ' + login }); return; }
        logins.add(login);
        const salt = novoSalt();
        novos.push({ id: novoId(), login, nome, salt, hash: hashSenha(senha, salt), criado: new Date().toISOString(), ativo: true });
      }
      await gravar(K.users, novos);
      await gravar(K.secret, crypto.randomBytes(32).toString('hex'));
      if (!(await existe(K.regs))) await gravar(K.regs, []);
      if (!(await existe(K.conf))) await gravar(K.conf, { emailComissao: '', quadro: 30, pct: 0, areas: null });
      await registrarAuditoria(novos[0].nome, 'configuração inicial', '', novos.length + ' usuário(s) criado(s): ' + novos.map(u => u.login).join(', '));
      res.json({ ok: true });
      return;
    }

    /* --- login --- */
    if (acao === 'login') {
      const usuarios = await ler(K.users, []);
      const login = limpar(corpo.login, 40).toLowerCase();
      const u = usuarios.find(x => x.login === login && x.ativo !== false);
      const salt = u ? u.salt : 'inexistente';
      const teste = hashSenha(String(corpo.senha || ''), salt);
      if (!u || !conferemHash(teste, u.hash)) { res.status(401).json({ erro: 'Usuário ou senha incorretos.' }); return; }
      const secret = await texto_bruto(K.secret);
      await registrarAuditoria(u.nome, 'entrou no painel', '', '');
      res.json({ token: assinar(u.id, secret), usuario: { login: u.login, nome: u.nome } });
      return;
    }

    /* --- fila pública, sem autenticação e sem dados sensíveis --- */
    if (acao === 'fila') {
      const regs = await ler(K.regs, []);
      res.json({ registros: regs.map(versaoPublica) });
      return;
    }

    /* --- manifestação do docente, aberta --- */
    if (acao === 'manifestar') {
      const r = corpo.registro || {};
      if (!limpar(r.nome, 90) || !limpar(r.email, 120)) { res.status(400).json({ erro: 'Nome e e-mail são obrigatórios.' }); return; }
      const regs = await ler(K.regs, []);
      const novo = Object.assign({}, r, {
        id: novoId(),
        ts: new Date().toISOString(),
        status: 'manifestado',
        parecer: '',
        visto: false,
        excecional: false,
        tram: {},
        repact: [],
        anexos: {}
      });
      regs.push(novo);
      await gravar(K.regs, regs);
      await registrarAuditoria(novo.nome + ' (docente)', 'manifestação registrada', novo.nome,
        `${novo.tipo}, período ${novo.periodo}${novo.periodoFim && novo.periodoFim !== novo.periodo ? ' até ' + novo.periodoFim : ''}`);
      res.json({ ok: true, id: novo.id });
      return;
    }

    /* --- anexo enviado pelo docente logo após a manifestação --- */
    if (acao === 'anexar') {
      const campo = limpar(corpo.campo, 10);
      if (campo !== 'plano' && campo !== 'carta') { res.status(400).json({ erro: 'Anexo inválido.' }); return; }
      const regs = await ler(K.regs, []);
      const r = regs.find(x => x.id === corpo.id);
      if (!r) { res.status(404).json({ erro: 'Registro não encontrado.' }); return; }
      const eu2 = await autenticar(req);
      const donoConfere = limpar(corpo.email, 120).toLowerCase() === String(r.email || '').toLowerCase();
      if (!eu2 && !donoConfere) { res.status(403).json({ erro: 'Sem permissão para anexar neste registro.' }); return; }
      r.anexos = r.anexos || {};
      if (r.anexos[campo] && !eu2) { res.status(409).json({ erro: 'Este anexo já foi enviado. Peça à comissão para substituir.' }); return; }
      const salvo = await subirArquivo(campo === 'plano' ? 'planos' : 'cartas', corpo.arquivo);
      if (!salvo) { res.status(400).json({ erro: 'Arquivo não recebido.' }); return; }
      r.anexos[campo] = salvo;
      r.docs = r.docs || {};
      r.docs[campo] = true;
      if (campo === 'plano') r.plano = 'sim'; else r.carta = 'sim';
      await gravar(K.regs, regs);
      await registrarAuditoria((eu2 ? eu2.nome : r.nome + ' (docente)'), 'anexou documento', r.nome,
        (campo === 'plano' ? 'plano de trabalho' : 'carta-convite') + ': ' + salvo.nome);
      res.json({ ok: true, anexo: salvo });
      return;
    }

    /* --- daqui em diante exige autenticação --- */
    const eu = await autenticar(req);
    if (!eu) { res.status(401).json({ erro: 'Sessão expirada ou inválida. Entre novamente.' }); return; }

    /* --- download de anexo, só para quem está autenticado --- */
    if (acao === 'baixar') {
      const campo = limpar(corpo.campo, 10);
      const regs = await ler(K.regs, []);
      const r = regs.find(x => x.id === corpo.id);
      const anx = r && r.anexos && r.anexos[campo];
      if (!anx || !anx.pathname) { res.status(404).json({ erro: 'Anexo não encontrado.' }); return; }
      const resultado = await get(anx.pathname, { access: 'private' });
      if (!resultado || resultado.statusCode !== 200) { res.status(404).json({ erro: 'Arquivo indisponível no armazenamento.' }); return; }
      const buf = Buffer.from(await new Response(resultado.stream).arrayBuffer());
      res.setHeader('Content-Type', (resultado.blob && resultado.blob.contentType) || anx.tipo || 'application/octet-stream');
      res.setHeader('Content-Disposition', 'inline; filename="' + anx.nome.replace(/"/g, '') + '"');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.status(200).send(buf);
      return;
    }

    if (acao === 'dados') {
      const [regs, conf, audit, usuarios] = await Promise.all([ler(K.regs, []), ler(K.conf, {}), ler(K.audit, []), ler(K.users, [])]);
      res.json({
        registros: regs, config: conf, auditoria: audit,
        usuarios: usuarios.filter(u => u.ativo !== false).map(u => ({ login: u.login, nome: u.nome, criado: u.criado })),
        eu
      });
      return;
    }

    if (acao === 'salvar') {
      const regs = await ler(K.regs, []);
      const i = regs.findIndex(x => x.id === corpo.id);
      if (i < 0) { res.status(404).json({ erro: 'Registro não encontrado.' }); return; }
      const antes = JSON.parse(JSON.stringify(regs[i]));
      const c = corpo.campos || {};
      const r = regs[i];
      if (typeof c.status === 'string') r.status = c.status;
      if (typeof c.parecer === 'string') r.parecer = limpar(c.parecer, 4000);
      if (typeof c.excecional === 'boolean') r.excecional = c.excecional;
      if (c.docs) { r.docs = r.docs || {}; ITENS_DOC.forEach(k => { if (typeof c.docs[k] === 'boolean') r.docs[k] = c.docs[k]; }); }
      if (c.tram) {
        r.tram = r.tram || {};
        ['colegiado', 'sei', 'congregacao', 'portaria', 'substituto', 'via'].forEach(k => {
          if (k in c.tram) { const v = limpar(c.tram[k], 20); if (v) r.tram[k] = v; else delete r.tram[k]; }
        });
      }
      r.visto = true;
      r.alteradoPor = eu.nome;
      r.alteradoEm = new Date().toISOString();
      const dif = diferencas(antes, r);
      await gravar(K.regs, regs);
      if (dif.length) await registrarAuditoria(eu.nome, 'alterou registro', r.nome, dif.join(' · '));
      res.json({ ok: true, alteracoes: dif });
      return;
    }

    if (acao === 'repactuar') {
      const regs = await ler(K.regs, []);
      const r = regs.find(x => x.id === corpo.id);
      if (!r) { res.status(404).json({ erro: 'Registro não encontrado.' }); return; }
      const novo = limpar(corpo.periodo, 10), motivo = limpar(corpo.motivo, 20);
      if (!novo || !motivo) { res.status(400).json({ erro: 'Informe o período e o motivo.' }); return; }
      const de = r.periodo;
      r.repact = r.repact || [];
      r.repact.push({ de, para: novo, motivo, data: new Date().toISOString(), por: eu.nome });
      r.periodo = novo;
      if (corpo.periodoFim) r.periodoFim = limpar(corpo.periodoFim, 10);
      if (motivo === 'voluntaria') r.tsFila = new Date().toISOString();
      r.status = 'manifestado';
      r.tram = {};
      r.visto = false;
      r.alteradoPor = eu.nome;
      r.alteradoEm = new Date().toISOString();
      await gravar(K.regs, regs);
      await registrarAuditoria(eu.nome, 'repactuou período', r.nome, `${de} → ${novo}, motivo: ${motivo}`);
      res.json({ ok: true });
      return;
    }

    if (acao === 'excluir') {
      const regs = await ler(K.regs, []);
      const r = regs.find(x => x.id === corpo.id);
      if (!r) { res.status(404).json({ erro: 'Registro não encontrado.' }); return; }
      await gravar(K.regs, regs.filter(x => x.id !== corpo.id));
      await registrarAuditoria(eu.nome, 'excluiu registro', r.nome, `${r.tipo}, período ${r.periodo}`);
      res.json({ ok: true });
      return;
    }

    if (acao === 'config') {
      const atual = await ler(K.conf, {});
      const c = corpo.config || {};
      const novo = Object.assign({}, atual);
      if ('emailComissao' in c) novo.emailComissao = limpar(c.emailComissao, 120);
      if ('quadro' in c) novo.quadro = Math.max(1, +c.quadro || 30);
      if ('pct' in c) novo.pct = Math.max(0, Math.min(100, +c.pct || 0));
      if ('areas' in c) novo.areas = Array.isArray(c.areas) ? c.areas.map(a => limpar(a, 60)).filter(Boolean) : null;
      await gravar(K.conf, novo);
      await registrarAuditoria(eu.nome, 'alterou configuração', '', JSON.stringify(novo));
      res.json({ ok: true, config: novo });
      return;
    }

    if (acao === 'trocarSenha') {
      const usuarios = await ler(K.users, []);
      const u = usuarios.find(x => x.id === eu.id);
      if (!u || !conferemHash(hashSenha(String(corpo.atual || ''), u.salt), u.hash)) { res.status(401).json({ erro: 'Senha atual incorreta.' }); return; }
      const nova = String(corpo.nova || '');
      if (nova.length < 8) { res.status(400).json({ erro: 'A nova senha precisa de pelo menos 8 caracteres.' }); return; }
      u.salt = novoSalt();
      u.hash = hashSenha(nova, u.salt);
      await gravar(K.users, usuarios);
      await registrarAuditoria(eu.nome, 'alterou a própria senha', '', '');
      res.json({ ok: true });
      return;
    }

    if (acao === 'criarUsuario') {
      const usuarios = await ler(K.users, []);
      const login = limpar(corpo.login, 40).toLowerCase();
      const nome = limpar(corpo.nome, 90);
      const senha = String(corpo.senha || '');
      if (!login || !nome) { res.status(400).json({ erro: 'Informe nome e e-mail.' }); return; }
      if (!EMAIL.test(login)) { res.status(400).json({ erro: 'E-mail inválido.' }); return; }
      if (senha.length < 8) { res.status(400).json({ erro: 'A senha precisa de pelo menos 8 caracteres.' }); return; }
      if (usuarios.some(u => u.login === login && u.ativo !== false)) { res.status(409).json({ erro: 'Já existe usuário com esse e-mail.' }); return; }
      const salt = novoSalt();
      usuarios.push({ id: novoId(), login, nome, salt, hash: hashSenha(senha, salt), criado: new Date().toISOString(), ativo: true });
      await gravar(K.users, usuarios);
      await registrarAuditoria(eu.nome, 'criou usuário', nome, 'login: ' + login);
      res.json({ ok: true });
      return;
    }

    if (acao === 'removerUsuario') {
      const usuarios = await ler(K.users, []);
      const alvo = usuarios.find(u => u.login === limpar(corpo.login, 40).toLowerCase() && u.ativo !== false);
      if (!alvo) { res.status(404).json({ erro: 'Usuário não encontrado.' }); return; }
      if (alvo.id === eu.id) { res.status(400).json({ erro: 'Você não pode remover o próprio acesso.' }); return; }
      if (usuarios.filter(u => u.ativo !== false).length <= 1) { res.status(400).json({ erro: 'Deve restar ao menos um usuário ativo.' }); return; }
      alvo.ativo = false;
      await gravar(K.users, usuarios);
      await registrarAuditoria(eu.nome, 'removeu usuário', alvo.nome, 'login: ' + alvo.login);
      res.json({ ok: true });
      return;
    }

    if (acao === 'restaurar') {
      if (!Array.isArray(corpo.registros)) { res.status(400).json({ erro: 'Backup inválido.' }); return; }
      const antes = (await ler(K.regs, [])).length;
      await gravar(K.regs, corpo.registros);
      if (corpo.config) await gravar(K.conf, corpo.config);
      await registrarAuditoria(eu.nome, 'restaurou backup', '', `${antes} registro(s) substituídos por ${corpo.registros.length}`);
      res.json({ ok: true });
      return;
    }

    if (acao === 'marcarVistos') {
      const regs = await ler(K.regs, []);
      regs.forEach(r => r.visto = true);
      await gravar(K.regs, regs);
      res.json({ ok: true });
      return;
    }

    res.status(400).json({ erro: 'Ação desconhecida: ' + acao });
  } catch (e) {
    res.status(500).json({ erro: e.message || 'Erro interno.' });
  }
};
