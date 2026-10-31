// O que a Denise lê: uso, custo e quem passou do teto no mês, saídos do que o contador guardou. Nada de texto de mensagem aqui.
const { clientes } = require("./lancador");
const { TETOS } = require("./teto");

async function montarPainel({ contador, mes }) {
  const usos = new Map((await contador.usoDoMes(mes)).map((u) => [u.cliente, u]));
  const linhas = clientes.map((c) => {
    const u = usos.get(c.codigo) ?? { usadas: 0, custo_brl: 0, barradas: 0 };
    return { cliente_id: c.codigo, empresa: c.empresa, plano: c.plano, teto: TETOS[c.plano], mensagens: u.usadas, barradas: u.barradas, passou_do_teto: u.barradas > 0, custo_brl: Number(u.custo_brl.toFixed(6)) };
  });
  return {
    mes,
    clientes: linhas,
    passaram_do_teto: linhas.filter((l) => l.passou_do_teto).map((l) => l.cliente_id),
    mensagens_total: linhas.reduce((n, l) => n + l.mensagens, 0),
    custo_total_brl: Number(linhas.reduce((n, l) => n + l.custo_brl, 0).toFixed(6)),
  };
}

module.exports = { montarPainel };
