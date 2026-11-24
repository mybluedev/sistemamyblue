'use strict';
/*
 * Tutorial do Painel do Jurídico (ferramenta em HTML, slug painel-juridico). Dados fictícios.
 * A advogada do cenário (Lara Mendes, setor Jurídico) assume uma demanda, registra o que chegou por e-mail, marca
 * "Aguardando retorno" (conta como entrega), passa por Assinaturas e Painel de Desempenho e termina nas Metas
 * (% dentro do SLA por atividade e mês, que sai das demandas do painel).
 *
 * preparar: a Tabela de prazos (como a da planilha antiga), demandas fictícias de junho até hoje, lançadas pela
 * administração pelo portal (o prazo e o SLA saem das regras do servidor), e a ferramenta liberada para a Lara.
 */
const SLUG = 'painel-juridico';
const FUSO = 'America/Sao_Paulo';
const quadro = (t) => t.p.frameLocator(`iframe[data-slug="${SLUG}"]`);

const hojeIso = () => new Date().toLocaleDateString('sv-SE', { timeZone: FUSO });
const util = (d) => { const x = new Date(d + 'T12:00:00Z').getUTCDay(); return x > 0 && x < 6; };
const somaUteis = (d, n) => { const x = new Date(d + 'T12:00:00Z'); let k = 0; while (k < n) { x.setUTCDate(x.getUTCDate() + 1); if (util(x.toISOString().slice(0, 10))) k++; } return x.toISOString().slice(0, 10); };
const mesAtras = (n, dia) => { const h = hojeIso(); const d = new Date(Date.UTC(+h.slice(0, 4), +h.slice(5, 7) - 1 - n, dia)); return d.toISOString().slice(0, 10); };

// Tabela de prazos (horas úteis; 8h = 1 dia útil), como a da planilha
const TIPOS = [['Contrato (garantia)', 8], ['Aditivo', 16], ['Rescisão', 24], ['Análise de contrato de fornecedor', 24], ['Contrato (parcerias)', 16],
  ['Resposta Rescisão', 24], ['Rescisão Terceiros', 24], ['Solicitações diversas', 24], ['Parecer p. operação', 24]];
const LANCADAS = ['Aditivo', 'Rescisão', 'Análise de contrato de fornecedor', 'Resposta Rescisão', 'Rescisão Terceiros', 'Parecer p. operação'];
const CONDS = ['Cond. Jardim Azul', 'Ed. Solar das Palmeiras', 'Res. Primavera', 'Cond. Vila Rica', 'Ed. Aurora', 'Res. Bela Vista', 'Cond. Monte Verde', 'Ed. Atlântico'];
const OBJETOS = ['taxa extra aprovada em assembleia', 'troca de síndico', 'novo prazo de repasse', 'contrato da empresa de portaria'];

module.exports = {
  nome: 'ferramenta-painel-juridico',
  ferramenta: SLUG,
  entrar: 'lara@myblue.com.br',
  inicio: '#/m/' + SLUG,
  async preparar(cen) {
    const a = cen.admin;
    await a('PUT', '/api/juridico/tipos', { tipos: TIPOS.map(([nome, horas]) => ({ nome, horas, ativo: true })) });
    const tipos = (await a('GET', '/api/juridico/meta')).tipos;
    await a('PUT', '/api/juridico/tipos', { tipos: tipos.map((t) => ({ id: t.id, nome: t.nome, horas: t.horas, ativo: true })), contratos_id: tipos.find((t) => t.nome === 'Contrato (garantia)').id });
    const tipo = (n) => tipos.find((t) => t.nome === n).id;
    const lara = cen.id['lara@myblue.com.br'];
    const quem = ['vera@myblue.com.br', 'davi@myblue.com.br', 'marcos@myblue.com.br', 'sara@myblue.com.br', 'nina@myblue.com.br'];
    const hoje = hojeIso();
    let n = 0;
    // concluídas nos últimos meses (algumas fora do prazo), para o Painel de Desempenho e as Metas
    for (let m = 5; m >= 1; m--) {
      for (let k = 0; k < 6; k++) {
        n++;
        const nome = LANCADAS[n % LANCADAS.length], horas = TIPOS.find((x) => x[0] === nome)[1];
        const dia = mesAtras(m, 3 + k * 4);
        const entrega = somaUteis(dia, Math.ceil(horas / 8) + (n % 7 === 0 ? 2 : 0) - (n % 2));
        await a('POST', '/api/juridico/demandas', { tipo_id: tipo(nome), cliente: CONDS[n % CONDS.length], objeto: `${nome}: ${OBJETOS[n % OBJETOS.length]}`,
          solicitante_id: cen.id[quem[n % quem.length]], solicitada_em: dia, responsavel_id: lara, canal: ['email', 'whatsapp', 'telefone'][n % 3],
          status: ['concluido', 'aguardando_retorno', 'concluido', 'aguardando_assinaturas'][n % 4], entregue_em: entrega > hoje ? hoje : entrega });
      }
    }
    // em aberto agora: uma sem responsável (para Assumir), duas com a Lara e uma pronta para assinatura
    const recente = (d) => { let x = hoje; for (let i = 0; i < d; i++) { do { x = new Date(new Date(x + 'T12:00:00Z').getTime() - 864e5).toISOString().slice(0, 10); } while (!util(x)); } return x; };
    await a('POST', '/api/juridico/demandas', { tipo_id: tipo('Parecer p. operação'), cliente: 'Res. Primavera', objeto: 'Parecer sobre a cobrança de multa da convenção', solicitante_id: cen.id['marcos@myblue.com.br'], solicitada_em: recente(1) });
    await a('POST', '/api/juridico/demandas', { tipo_id: tipo('Aditivo'), cliente: 'Ed. Aurora', objeto: 'Aditivo de taxa extra', solicitante_id: cen.id['vera@myblue.com.br'], solicitada_em: recente(1), responsavel_id: lara, status: 'em_andamento' });
    await a('POST', '/api/juridico/demandas', { tipo_id: tipo('Rescisão Terceiros'), cliente: 'Cond. Vila Rica', objeto: 'Rescisão do contrato de limpeza', solicitante_id: cen.id['sara@myblue.com.br'], solicitada_em: recente(4), responsavel_id: lara, status: 'em_andamento' });
    await a('POST', '/api/juridico/demandas', { tipo_id: tipo('Rescisão'), cliente: 'Res. Bela Vista', objeto: 'Distrato a pedido do síndico', solicitante_id: cen.id['davi@myblue.com.br'], solicitada_em: recente(3), responsavel_id: lara, status: 'pronto_assinatura', entregue_em: recente(1) });
    // a ferramenta liberada para a advogada (Configurações → Acessos → Ferramentas)
    await a('PATCH', `/api/admin/usuarios/${lara}`, { modulos: [SLUG] });
  },
  abertura: ['Tudo o que chega ao Jurídico num lugar só, com o prazo de cada atividade e as metas.', ['Minhas demandas: assumir e registrar', 'Conduzir a demanda', 'Assinaturas e Painel de Desempenho', 'Metas: % dentro do SLA por atividade e mês']],
  async gravar(t) {
    const f = quadro(t);
    await f.locator('#tbDj tr[data-id]').first().waitFor({ timeout: 30000 });

    const D = '1 · Minhas demandas';
    await t.legenda('Em <b>Minhas demandas</b>, em cima, o que chegou e ninguém pegou; embaixo, o que está com você. As fora do prazo vêm primeiro.', { etapa: D, ms: 600 });
    await t.mostrar(f.locator('#tbDj'), 3200);
    await t.legenda('Clique em <b>Assumir</b>: a demanda passa para você, em andamento.', { etapa: D, ms: 300 });
    await t.clicar(f.locator('[data-pegar]').first(), { depois: 1800 });
    await t.legenda('O que chegou por e-mail, WhatsApp ou telefone entra em <b>Registrar demanda</b>: o prazo sai da Tabela de prazos.', { etapa: D, ms: 300 });
    await t.clicar(f.locator('#btRegistrar'), { depois: 1000 });
    await t.escolher(f.locator('#fTipo'), 'Aditivo (16h úteis)', { depois: 900 });
    await t.digitar(f.locator('#fCliente'), 'Cond. Jardim Azul');
    await t.digitar(f.locator('#fObjeto'), 'Aditivo de taxa extra pedido por e-mail');
    await t.escolher(f.locator('#fSolic'), 'Vera Campos', { depois: 800 });
    await t.mostrar(f.locator('#fCanal'), 1600);
    await t.clicar(f.locator('#fOk'), { depois: 2200 });

    const C = '2 · Conduzir a demanda';
    await t.legenda('Clique na demanda para mudar a situação, a conclusão e o responsável, e para comentar com quem pediu.', { etapa: C, ms: 300 });
    await t.clicar(f.locator('#tbDj tr[data-id]:has-text("Ed. Aurora")'), { depois: 1400 });
    await t.legenda('<b>Aguardando retorno</b> conta como entrega: a data de conclusão é preenchida e a demanda entra no SLA.', { etapa: C, ms: 300 });
    await t.escolher(f.locator('#fStatus'), 'Aguardando retorno', { depois: 1200 });
    await t.mostrar(f.locator('#fEntrega'), 2000);
    await t.clicar(f.locator('#fSalvar'), { depois: 1800 });

    const A = '3 · Assinaturas e desempenho';
    await t.legenda('Em <b>Assinaturas</b>, contratos e demandas que precisam de assinatura, do mais antigo para o mais novo.', { etapa: A, ms: 300 });
    await t.clicar(f.locator('#abasPJ a[href="#assinaturas"]'), { depois: 1600 });
    await t.mostrar(f.locator('.ass-item').first(), 2600);
    await t.legenda('O <b>Painel de Desempenho</b> mostra o mês ou o ano: solicitadas, concluídas e o % dentro do SLA, por atividade, solicitante, setor e estado.', { etapa: A, ms: 300 });
    await t.clicar(f.locator('#abasPJ a[href="#indicadores"]'), { depois: 1800 });
    await t.mostrar(f.locator('.cards-acomp'), 3000);

    const M = '4 · Metas';
    await t.legenda('Em <b>Metas</b>, o % dentro do SLA por atividade e mês, como o Resumo SLA da planilha, calculado das demandas do painel.', { etapa: M, ms: 300 });
    await t.clicar(f.locator('#abasPJ a[href="#metas"]'), { depois: 1800 });
    await t.mostrar(f.locator('.metas table'), 3400);
    await t.legenda('Clique num número para ver as demandas que entraram nele: as fora do prazo vêm primeiro.', { etapa: M, ms: 300 });
    await t.clicar(f.locator('.metas td.cel').first(), { depois: 2600 });
    await t.clicar(f.locator('.modal [data-fechar]').first(), { depois: 800 });
    await t.legenda('<b>Copiar tabela</b> leva os números para a planilha de metas; <b>Baixar planilha</b> salva em Excel.', { etapa: M, ms: 300 });
    await t.mostrar(f.locator('#mCopiar'), 2600);
  },
  resumo: ['<b>Minhas demandas</b>: Assumir · <b>Registrar demanda</b> (e-mail, WhatsApp, telefone)', 'Na demanda: situação, conclusão e comentário · <b>Aguardando retorno</b> conta como entrega',
    '<b>Metas</b>: % dentro do SLA por atividade e mês, das demandas do painel'],
};
