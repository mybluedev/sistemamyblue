'use strict';
/*
 * Demandas Jurídicas abertas no portal: o protocolo (JUR-AAAA-MM-DD-NN) e a ligação com a Central de Tickets.
 * Quem pede ao Jurídico abre um ticket para o setor Jurídico escolhendo a atividade da Tabela de prazos; o portal cria a
 * demanda ligada ao ticket, com o prazo da atividade. O Jurídico conduz pela demanda ou pelo ticket: a situação, o responsável e
 * os comentários marcados num lado aparecem no outro (os anexos ficam no ticket; o histórico da demanda registra o envio).
 */
const I = require('./importacao');

const diaBrasilia = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d));

async function proximoProtocolo(t, agora = new Date()) {
  const dia = diaBrasilia(agora);
  const r = await t.um(`INSERT INTO juridico_protocolos (dia, ultimo) VALUES ($1, 1)
    ON CONFLICT (dia) DO UPDATE SET ultimo = juridico_protocolos.ultimo + 1 RETURNING ultimo`, [dia]);
  return `JUR-${dia}-${String(r.ultimo).padStart(2, '0')}`;
}

/* a situação da demanda vista no ticket de quem pediu */
const STATUS_TICKET = { pendente: null, em_andamento: 'em_andamento', aguardando_retorno: 'aguardando', pronto_assinatura: 'em_andamento',
  aguardando_assinaturas: 'em_andamento', concluido: 'resolvido', contrato_perdido: 'cancelado' };

const FECHADAS = ['concluido', 'contrato_perdido'];
// mudou para estes sem data de entrega: entregue hoje. Aguardando retorno conta como entregue (como na planilha: o Jurídico
// já fez a parte dele e espera quem pediu), e é assim que entra no SLA e nas metas.
const ENTREGA_AO_MUDAR = ['aguardando_retorno', 'pronto_assinatura', 'aguardando_assinaturas', 'concluido'];

/* o caminho de volta: quem é do Jurídico também trata pelo ticket (resolve, assume, comenta); a demanda acompanha.
   Só muda a situação da demanda quando a do ticket diz outra coisa (Pronto para assinatura continua "em andamento" no ticket). */
function statusDoTicket(ticket, demanda) {
  const fechada = FECHADAS.includes(demanda);
  if (ticket === 'resolvido') return 'concluido';
  if (ticket === 'cancelado') return 'contrato_perdido';
  if (ticket === 'aguardando') return 'aguardando_retorno';
  if (ticket === 'em_andamento') return ['pendente', 'aguardando_retorno'].includes(demanda) || fechada ? 'em_andamento' : demanda;
  if (ticket === 'novo') return fechada ? 'pendente' : demanda; // trocar o responsável volta o ticket a "novo": a demanda segue
  return demanda;
}

/* leva à demanda ligada ao ticket (dentro da transação do ticket) a situação e/ou o responsável marcados no ticket.
   mudancas: { status?, responsavel_id? (null = ninguém), motivo? }. Devolve o que mudou (ou null). */
async function espelharDoTicket(t, ticketId, usuarioId, mudancas) {
  const d = await t.um('SELECT id, status, responsavel_id, entregue_em::text AS entregue_em FROM juridico_demandas WHERE ticket_id = $1 ORDER BY id LIMIT 1 FOR UPDATE', [ticketId]);
  if (!d) return null;
  const hoje = diaBrasilia();
  const de = {}, para = {};
  const sets = [];
  const args = [d.id];
  const set = (col, val) => { args.push(val); sets.push(`${col} = $${args.length}`); };
  if (mudancas.status) {
    const st = statusDoTicket(mudancas.status, d.status);
    if (st !== d.status) {
      set('status', st); de.status = d.status; para.status = st;
      set('status_em', hoje);
      if (d.status === 'aguardando_assinaturas' && st === 'concluido') set('assinado_em', hoje);
      if (ENTREGA_AO_MUDAR.includes(st) && !d.entregue_em) { set('entregue_em', hoje); de.entregue_em = null; para.entregue_em = hoje; }
    }
  }
  if (mudancas.responsavel_id !== undefined && (mudancas.responsavel_id || null) !== d.responsavel_id) {
    set('responsavel_id', mudancas.responsavel_id || null); de.responsavel_id = d.responsavel_id; para.responsavel_id = mudancas.responsavel_id || null;
  }
  if (!sets.length) return null;
  await t.q(`UPDATE juridico_demandas SET ${sets.join(', ')}, atualizado_em = now() WHERE id = $1`, args);
  await t.q('INSERT INTO juridico_eventos (demanda_id, usuario_id, tipo, detalhe) VALUES ($1, $2, $3, $4::jsonb)',
    [d.id, usuarioId, para.status ? 'status' : 'editada', JSON.stringify({ de, para, ticket: ticketId, motivo: mudancas.motivo || undefined })]);
  return { id: d.id, de, para };
}

/* comentário ou anexo (visível a quem pediu) feito no ticket: entra no histórico da demanda ligada */
async function registrarDoTicket(t, ticketId, usuarioId, tipo, detalhe) {
  const d = await t.um('SELECT id FROM juridico_demandas WHERE ticket_id = $1 ORDER BY id LIMIT 1', [ticketId]);
  if (!d) return null;
  await t.q('INSERT INTO juridico_eventos (demanda_id, usuario_id, tipo, detalhe) VALUES ($1, $2, $3, $4::jsonb)', [d.id, usuarioId, tipo, JSON.stringify({ ...detalhe, ticket: ticketId })]);
  await t.q('UPDATE juridico_demandas SET atualizado_em = now() WHERE id = $1', [d.id]);
  return d.id;
}

/* demandas que ficaram para trás antes do caminho de volta existir: o ticket foi resolvido (ou cancelado) pelo ticket e a
   demanda continuou aberta, sem nunca ter mudado de situação no Painel. Roda ao subir o portal; depois não acha mais nada. */
async function alinharComTickets(t) {
  const { rows } = await t.q(`SELECT d.id, d.status, d.responsavel_id, d.entregue_em::text AS entregue_em, tk.id AS ticket, tk.status AS ticket_status,
      (SELECT sm.usuario_id FROM setor_membros sm JOIN setores s ON s.id = sm.setor_id WHERE s.nome = 'Jurídico' AND sm.usuario_id = tk.responsavel_id LIMIT 1) AS resp,
      (SELECT e.usuario_id FROM ticket_eventos e WHERE e.ticket_id = tk.id AND e.tipo = 'status' ORDER BY e.id DESC LIMIT 1) AS quem,
      (SELECT e.texto FROM ticket_eventos e WHERE e.ticket_id = tk.id AND e.tipo = 'status' ORDER BY e.id DESC LIMIT 1) AS motivo,
      to_char(COALESCE(tk.resolvido_em, tk.atualizado_em) AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS dia
    FROM juridico_demandas d JOIN tickets tk ON tk.id = d.ticket_id
    WHERE tk.status IN ('resolvido', 'cancelado') AND d.status NOT IN ('concluido', 'contrato_perdido')
      AND NOT EXISTS (SELECT 1 FROM juridico_eventos e WHERE e.demanda_id = d.id AND e.tipo = 'status')`);
  for (const x of rows) {
    const st = x.ticket_status === 'resolvido' ? 'concluido' : 'contrato_perdido';
    const de = { status: x.status }, para = { status: st };
    const entregue = st === 'concluido' && !x.entregue_em ? x.dia : x.entregue_em;
    if (entregue !== x.entregue_em) { de.entregue_em = x.entregue_em; para.entregue_em = entregue; }
    const resp = x.responsavel_id || x.resp || null;
    if (resp !== x.responsavel_id) { de.responsavel_id = x.responsavel_id; para.responsavel_id = resp; }
    await t.q('UPDATE juridico_demandas SET status = $2, status_em = $3::date, entregue_em = $4::date, responsavel_id = $5, atualizado_em = now() WHERE id = $1',
      [x.id, st, x.dia, entregue, resp]);
    await t.q('INSERT INTO juridico_eventos (demanda_id, usuario_id, tipo, detalhe) VALUES ($1, $2, $3, $4::jsonb)',
      [x.id, x.quem, 'status', JSON.stringify({ de, para, ticket: x.ticket, motivo: x.motivo || undefined })]);
  }
  return rows.length;
}

/* atividades que se pedem pelo ticket: as da Tabela de prazos, menos as que têm tela própria (contrato de garantia e de parceria) */
const pedidoProprio = (t) => !!t.contratos || /parceri/i.test(t.nome);

/* prazo de entrega: as horas úteis do tipo (8h = 1 dia útil), contadas do dia seguinte ao pedido */
const prazoDe = (solicitada, horas, ehDiaUtil) => I.somarDiasUteis(solicitada, I.diasDoPrazo(horas), ehDiaUtil);

/* o prazo do ticket (instante): o fim do expediente do dia do prazo, em Brasília */
const fimDoDia = (dia) => new Date(`${dia}T17:00:00-03:00`);

/* grava a demanda (dentro de uma transação) com o próximo número e o protocolo do dia; devolve { id, numero, protocolo } */
async function inserir(t, x) {
  await t.q('SELECT pg_advisory_xact_lock(7240514)');
  const { n } = await t.um('SELECT COALESCE(MAX(numero), 0) + 1 AS n FROM juridico_demandas');
  const protocolo = await proximoProtocolo(t);
  return t.um(`INSERT INTO juridico_demandas (numero, protocolo, ticket_id, tipo_id, status, solicitante_id, solicitante_nome, setor, uf, cliente, condominio_id, objeto,
      observacoes, responsavel_id, solicitada_em, horas, prazo, entregue_em, criado_por, aviso_vence_em, aviso_atraso_em, canal, status_em)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $20, $21, $22) RETURNING id, numero, protocolo`,
  [n, protocolo, x.ticket_id || null, x.tipo_id, x.status, x.solicitante_id, x.solicitante_nome, x.setor, x.uf, x.cliente, x.condominio_id, x.objeto, x.observacoes,
    x.responsavel_id, x.solicitada_em, x.horas, x.prazo, x.entregue_em, x.criado_por, x.aviso_vence_em, x.canal, x.status_em]);
}

module.exports = { proximoProtocolo, STATUS_TICKET, pedidoProprio, diaBrasilia, prazoDe, inserir, fimDoDia, FECHADAS, ENTREGA_AO_MUDAR,
  statusDoTicket, espelharDoTicket, registrarDoTicket, alinharComTickets };
