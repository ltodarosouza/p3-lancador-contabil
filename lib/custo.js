// Preço do modelo e câmbio, com a data de cada um: o log guarda isso junto, para a conta poder ser refeita.
const PRECO = {
  modelo: "gemini-3.5-flash-lite",
  usd_por_milhao: { entrada: 0.30, saida: 2.50 },
  data_preco: "2026-10-28",          // página de preços do Google, plano pago (Standard)
  cambio_brl: 5.4212,
  data_cambio: "2026-10-30",         // dólar PTAX de venda, Banco Central
};

function custoBrl({ entrada = 0, saida = 0 }, preco = PRECO) {
  const usd = (entrada * preco.usd_por_milhao.entrada + saida * preco.usd_por_milhao.saida) / 1e6;
  return { usd, brl: usd * preco.cambio_brl };
}

module.exports = { PRECO, custoBrl };
