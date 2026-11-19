'use strict';
/*
 * Tutorial do Calendário de Marketing. A ferramenta guarda no banco do portal (claude.use('db'), coleções
 * colaboradores, endomkt, agenda, fornecedores e encerramentos) e lê as datas de nascimento e de admissão do
 * cadastro de Pessoas (/api/db/<slug>/equipe, liberado pela administração em "Receber as datas da equipe").
 * O HTML não traz lista real embutida (só datas comemorativas públicas, gravadas quando alguém pede), então não há
 * adaptarHtml. Tudo o que aparece é inventado: as datas da equipe do cenário, eventos, fornecedores e valores.
 *
 * O Marketing não tem ninguém no cenário: a coordenadora fictícia Bia Torres é criada aqui (como no Controle de Brindes).
 */
const SLUG = 'calendario-de-marketing';
const { cliente } = require('../gravador');
const { SENHA } = require('../cenario');
const quadro = (t) => t.p.frameLocator(`iframe[data-slug="${SLUG}"]`);

/* datas no fuso de Brasília, relativas a hoje (como a ferramenta conta) */
const hoje = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const dia = (n) => { const d = new Date(hoje() + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const noAno = (ano, n) => ano + dia(n).slice(4); // o mesmo dia e mês de hoje + n, no ano pedido
const mesId = (k) => { const [y, m] = hoje().split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + k, 1)); return d.toISOString().slice(0, 7); };
const quando = (n) => dia(n) + 'T14:20:00.000Z';

/* coordenadora do Marketing (fictícia), com o primeiro acesso já feito */
async function pessoaMarketing(cen, base) {
  const r = await cen.admin('POST', '/api/admin/usuarios', { data_nascimento: noAno(1991, 0), data_admissao: '2024-05-06', nome: 'Bia Torres', email: 'bia@myblue.com.br',
    senha: 'Senha1234', papel: 'coordenador', setores: [cen.S('Marketing')], modulos: [SLUG] });
  const c = cliente(base);
  await c('POST', '/api/auth/login', { email: 'bia@myblue.com.br', senha: 'Senha1234' });
  await c('POST', '/api/auth/senha', { atual: 'Senha1234', nova: SENHA });
  return r.id;
}

/* datas fictícias da equipe do cenário (no cadastro todos nascem no mesmo dia): [e-mail, nascimento, admissão] */
const DATAS = [
  ['marcos@myblue.com.br', noAno(1993, 3), '2022-03-14'],
  ['lara@myblue.com.br', '1988-02-20', noAno(2021, 5)], // 5 anos de casa: marco
  ['sara@myblue.com.br', '1995-07-02', noAno(2023, 9)],
  ['davi@myblue.com.br', noAno(1997, 12), '2024-08-05'],
  ['caio@myblue.com.br', noAno(1986, 20), '2019-04-01'],
  ['vera@myblue.com.br', '1990-09-18', noAno(2025, 25)],
  ['lia@myblue.com.br', noAno(1989, 41), '2020-06-15'],
  ['bruna@myblue.com.br', noAno(1996, 55), '2023-01-09'],
  ['paula@myblue.com.br', noAno(1984, 72), '2018-10-22'],
  ['rafa@myblue.com.br', noAno(1999, 96), '2024-11-04'],
  ['tiago@myblue.com.br', noAno(1992, 128), '2022-07-18'],
  ['nina@myblue.com.br', noAno(1987, 160), '2021-02-08'],
  ['otto@myblue.com.br', noAno(1994, 205), '2023-05-29'],
  ['sueli@myblue.com.br', noAno(1980, 250), '2017-09-11'],
];

function documentos() {
  const docs = {};
  // alguém que não tem acesso ao portal, cadastrado só na ferramenta
  docs['colaboradores/c-julia'] = { nome: 'Júlia Ramos', area: 'Marketing (estágio)', email: '', nascimento: noAno(2004, 16), admissao: '2026-03-02', obs: 'Estagiária, sem acesso ao portal', atualizadoEm: quando(-40) };

  // endomarketing
  const endo = [
    ['e-cafe', 'Evento interno', dia(14), 'Café com os aniversariantes do mês', false, 'Café da manhã no escritório', 'Presencial', 'Bia Torres', 350, 'Em andamento'],
    ['e-bem', 'Campanha interna', dia(9), 'Desafio de bem-estar da equipe', false, 'Metas de passos e hidratação por 30 dias', 'E-mail e WhatsApp', 'Bia Torres', 0, 'A planejar'],
    ['e-fim', 'Evento interno', dia(42), 'Confraternização de fim de ano', false, 'Almoço com toda a equipe', 'Presencial', 'Bia Torres', 6000, 'A planejar'],
    ['e-natal', 'Data comemorativa', '2025-12-25', 'Natal', true, 'Cartão de boas festas para a equipe', 'E-mail', 'Bia Torres', 0, 'A planejar'],
    ['e-mulher', 'Data comemorativa', '2026-03-08', 'Dia Internacional da Mulher', true, 'Homenagem às colaboradoras', 'Presencial', 'Bia Torres', 400, 'A planejar'],
  ];
  for (const [id, tipo, data, titulo, recorrente, acao, canal, responsavel, orcamento, status] of endo) {
    docs['endomkt/' + id] = { tipo, data, titulo, recorrente, acao, canal, responsavel, orcamento, status, obs: '', atualizadoEm: quando(-20) };
  }

  // agenda: eventos (com fornecedor e valores) e datas comemorativas do mercado
  const ag = [
    ['a-recife', 'Evento', dia(11), 'Encontro de síndicos: Recife', false, 'Hotel Exemplo, Recife', 'Bia Torres', 'Buffet Sabor & Cia', 8500, 0, 'Contratado'],
    ['a-feira', 'Evento', dia(33), 'Feira de condomínios: Fortaleza', false, 'Centro de Eventos Exemplo', 'Bia Torres', '', 12000, 0, 'Em cotação'],
    ['a-natal', 'Evento', dia(-20), 'Café com síndicos: Natal', false, 'Espaço Exemplo, Natal', 'Bia Torres', 'Buffet Sabor & Cia', 3000, 2780, 'Concluído'],
    ['a-work', 'Evento', dia(-60), 'Workshop de gestão condominial', false, 'On-line', 'Bia Torres', 'Gráfica Express', 5000, 5400, 'Concluído'],
    ['a-sindico', 'Data comemorativa', '2025-11-30', 'Dia do Síndico', true, 'Redes sociais / e-mail', 'Bia Torres', '', 0, 0, 'A planejar'],
    ['a-cliente', 'Data comemorativa', '2026-09-15', 'Dia do Cliente', true, 'Redes sociais / e-mail', 'Bia Torres', '', 0, 0, 'A planejar'],
  ];
  for (const [id, tipo, data, titulo, recorrente, local, responsavel, fornecedor, orcado, realizado, status] of ag) {
    docs['agenda/' + id] = { tipo, data, titulo, recorrente, local, responsavel, fornecedor, orcado, realizado, status, obs: '', atualizadoEm: quando(-15) };
  }

  // fornecedores (inventados)
  docs['fornecedores/f-buffet'] = { nome: 'Buffet Sabor & Cia', servico: 'Buffet', contato: 'Rita Gomes', telefone: '(81) 90000-7788', email: 'contato@buffet.exemplo.com.br', obs: '' };
  docs['fornecedores/f-som'] = { nome: 'Som & Luz Eventos', servico: 'Som, palco e iluminação', contato: 'Hugo Prates', telefone: '(85) 90000-4411', email: 'orcamento@someluz.exemplo.com.br', obs: '' };
  docs['fornecedores/f-grafica'] = { nome: 'Gráfica Express', servico: 'Gráfica e brindes', contato: 'Célia Nunes', telefone: '(11) 90000-3322', email: 'vendas@grafica.exemplo.com.br', obs: '' };

  // encerramentos: o mês passado fechado, o atual em andamento
  docs['encerramentos/' + mesId(-1)] = { status: 'Concluído', responsavel: 'Bia Torres', obs: 'Relatório de ações e gastos enviado à diretoria.' };
  docs['encerramentos/' + mesId(0)] = { status: 'Em andamento', responsavel: 'Bia Torres', obs: '' };

  // orçamentos (v1.1): dois para o mesmo serviço da feira (o menor fica destacado) e os aprovados do encontro
  const orc = [
    ['o-som1', 'Feira de condomínios: Fortaleza', 'Som & Luz Eventos', 'Som e palco', 'Recebido', dia(-6), dia(20), 4200],
    ['o-som2', 'Feira de condomínios: Fortaleza', 'Áudio Exemplo Ltda', 'Som e palco', 'Recebido', dia(-5), dia(25), 3800],
    ['o-buf', 'Encontro de síndicos: Recife', 'Buffet Sabor & Cia', 'Buffet', 'Aprovado', dia(-12), dia(10), 8500],
    ['o-brinde', 'Encontro de síndicos: Recife', 'Gráfica Express', 'Brindes', 'Solicitado', dia(-2), '', null],
  ];
  for (const [id, evento, fornecedor, servico, status, solicitadoEm, validade, valor] of orc) {
    docs['orcamentos/' + id] = { evento, fornecedor, servico, status, solicitadoEm, validade, valor, responsavel: 'Bia Torres', condicoes: '', obs: '', atualizadoEm: quando(-2) };
  }
  // contratações: uma a pagar (líquido da NF menor que o bruto) e uma paga acima do líquido (a ferramenta avisa: pedir estorno)
  docs['contratacoes/c-buf'] = { evento: 'Encontro de síndicos: Recife', fornecedor: 'Buffet Sabor & Cia', servico: 'Buffet', orcamento: 'o-buf', status: 'A pagar', data: dia(-5),
    valor: 8500, modalidade: 'Pagamento total', parcelas: null, vencimento: dia(6), nf: '1234', valorBruto: 8500, valorLiquido: 8100, valorPago: 0, dataPagamento: '', responsavel: 'Bia Torres', obs: '', atualizadoEm: quando(-5) };
  docs['contratacoes/c-work'] = { evento: 'Workshop de gestão condominial', fornecedor: 'Gráfica Express', servico: 'Material impresso', orcamento: '', status: 'Pago', data: dia(-70),
    valor: 5400, modalidade: 'Pagamento total', parcelas: null, vencimento: '', nf: '987', valorBruto: 5400, valorLiquido: 5150, valorPago: 5400, dataPagamento: dia(-58), responsavel: 'Bia Torres', obs: '', atualizadoEm: quando(-58) };
  return docs;
}

module.exports = {
  nome: 'ferramenta-calendario-marketing',
  ferramenta: SLUG,
  entrar: 'bia@myblue.com.br',
  inicio: '#/m/' + SLUG,
  async preparar(cen, base) {
    await pessoaMarketing(cen, base);
    for (const [email, data_nascimento, data_admissao] of DATAS) {
      await cen.admin('PATCH', `/api/admin/usuarios/${cen.id[email]}`, { data_nascimento, data_admissao });
    }
    // a administração libera as datas da equipe (cadastro de Pessoas) para esta ferramenta
    await cen.admin('PATCH', `/api/admin/modulos/${SLUG}`, { datas_equipe: true });
    const r = await cen.admin('POST', `/api/admin/modulos/${SLUG}/documentos`, { modulo: SLUG, documentos: documentos() });
    if (!r || !r.total) throw new Error('não gravou os dados de exemplo: ' + JSON.stringify(r));
  },
  async ajustar(t) {
    const f = quadro(t);
    await f.locator('#syncTxt', { hasText: 'ao vivo' }).waitFor({ state: 'attached', timeout: 30000 });
    await f.locator('#lsCeleb .li').first().waitFor({ timeout: 20000 });
    await t.pausa(800);
  },
  abertura: ['Aniversários, tempo de casa, endomarketing, eventos, fornecedores e o fechamento do mês, num calendário só.',
    ['Aniversários e tempo de casa da equipe', 'Cadastrar uma ação de endomarketing', 'Agenda de eventos', 'Encerramento do mês', 'Fornecedores', 'Orçamentos e contratações']],
  async gravar(t) {
    const f = quadro(t);

    const P = '1 · Aniversários e tempo de casa';
    await t.legenda('A ferramenta lê as datas de nascimento e de admissão do <b>cadastro de Pessoas</b> do portal. No topo, quem faz aniversário hoje e os números do mês.', { etapa: P, ms: 1500 });
    await t.mostrar(f.locator('#v-pessoas .kpis'), 3600);
    await t.legenda('Em <b>Próximas celebrações</b>, os aniversários e os anos de casa. Troque o período: 7, 30 ou 90 dias.', { etapa: P, ms: 300 });
    await t.mostrar(f.locator('#lsCeleb'), 1800, { dy: 0.3 });
    await t.clicar(f.locator('#chJanela [data-v="7"]'), { depois: 1600 });
    await t.clicar(f.locator('#chJanela [data-v="90"]'), { depois: 1800 });
    await t.legenda('Ao lado, o <b>mês a mês</b> dos próximos 12 meses.', { etapa: P, ms: 300 });
    await t.mostrar(f.locator('#gdMeses'), 2600, { dy: 0.3 });

    const E = '2 · Endomarketing';
    await t.legenda('Abaixo, as datas comemorativas, os eventos internos e as campanhas. <b>Novo item</b> cadastra uma ação.', { etapa: E, ms: 300 });
    await t.rolar(480);
    await t.clicar(f.locator('[data-novo="endomkt"]'), { depois: 900 });
    await t.escolher(f.locator('#f_tipo'), 'Evento interno');
    await t.preencherCampo(f.locator('#f_data'), dia(18));
    await t.digitar(f.locator('#f_titulo'), 'Palestra sobre saúde financeira', { atraso: 40 });
    await t.digitar(f.locator('#f_acao'), 'Palestra on-line com especialista convidado', { atraso: 30 });
    await t.digitar(f.locator('#f_canal'), 'Teams', { atraso: 40 });
    await t.digitar(f.locator('#f_responsavel'), 'Bia Torres', { atraso: 40 });
    await t.legenda('Marque <b>Repete todo ano</b> nas datas fixas: elas avançam sozinhas para o próximo ano.', { etapa: E, ms: 300 });
    await t.mostrar(f.locator('#f_recorrente'), 1600);
    await t.clicar(f.locator('#mdOk'), { depois: 1800 });
    await t.clicar(f.locator('#chEndo [data-v="Evento interno"]'), { depois: 2600 });

    const A = '3 · Agenda';
    await t.legenda('Na aba <b>Eventos, fornecedores e datas</b>: os próximos 30 dias, o próximo encerramento e quanto foi <b>orçado</b> e <b>realizado</b> no ano.', { etapa: A, ms: 300 });
    await t.clicar(f.locator('.tab[data-tab="eventos"]'), { depois: 4800 });
    await t.legenda('Na <b>Agenda</b>, clique no evento para atualizar: aqui, a feira saiu da cotação e o fornecedor foi contratado.', { etapa: A, ms: 300 });
    await t.clicar(f.locator('[data-ed="agenda|a-feira"]'), { depois: 1000 });
    await t.escolher(f.locator('#f_status'), 'Contratado');
    await t.digitar(f.locator('#f_fornecedor'), 'Som & Luz Eventos', { atraso: 40 });
    await t.clicar(f.locator('#mdOk'), { depois: 2000 });

    const C = '4 · Encerramento do mês';
    await t.legenda('Em <b>Encerramentos do mês</b>, o último dia útil de cada mês. Clique para marcar o status e anotar o fechamento.', { etapa: C, ms: 300 });
    await t.rolar(380);
    await t.clicar(f.locator('#gdEnc .enc.atual'), { depois: 1000 });
    await t.escolher(f.locator('#f_status'), 'Concluído');
    await t.digitar(f.locator('#f_obs'), 'Ações e gastos do mês conferidos.', { atraso: 34 });
    await t.clicar(f.locator('#mdOk'), { depois: 1800 });
    const F = '5 · Fornecedores';
    await t.legenda('Em <b>Fornecedores</b>, os contatos e quanto já foi realizado com cada um nos eventos.', { etapa: F, ms: 300 });
    await t.rolar(360);
    await t.mostrar(f.locator('#tbForn'), 3600, { dy: 0.3 });

    const O = '6 · Orçamentos e contratações';
    await t.legenda('Na aba <b>Orçamentos e contratações</b>: os orçamentos em aberto, o contratado no ano, o que falta pagar e o que já foi pago.', { etapa: O, ms: 300 });
    await t.clicar(f.locator('.tab[data-tab="contratos"]'), { depois: 3600 });
    await t.legenda('Em <b>Orçamentos</b>, as propostas de cada evento. A de <b>menor valor</b> do mesmo evento e serviço fica destacada; <b>Contratar</b> leva a proposta para as contratações.', { etapa: O, ms: 300 });
    await t.mostrar(f.locator('#tbOrc'), 3600, { dy: 0.3 });
    await t.legenda('Em <b>Contratações</b>, a nota fiscal e o pagamento. A MyBlue paga sempre o <b>valor líquido da nota fiscal</b>, nunca o bruto: se pagar a mais, a ferramenta avisa para pedir o <b>estorno</b>.', { etapa: O, ms: 300 });
    await t.rolar(420);
    await t.mostrar(f.locator('#tbCt'), 3800, { dy: 0.3 });
  },
  resumo: ['Aniversários e tempo de casa vêm do <b>cadastro de Pessoas</b>', '<b>Novo item</b>: datas, eventos internos e campanhas de endomarketing',
    '<b>Agenda</b> com fornecedor e valores · <b>Encerramento do mês</b>', '<b>Orçamentos e contratações</b>: menor valor em destaque · paga-se o líquido da NF'],
};
