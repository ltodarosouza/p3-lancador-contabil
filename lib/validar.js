// Confere em código o que o modelo devolveu. O modelo lê; o que vale como lançamento é o que passa aqui.
const plano = require("../dados/plano-de-contas.json");

const FORMAS = ["pix", "dinheiro", "cartao", "boleto", "transferencia", "pessoal_do_socio", "nao_informado"];

// No material só existe um plano de contas, o do escritório, igual para os quatro clientes. Quando cada cliente tiver o seu, é aqui que muda.
const planoDoCliente = () => plano;

const diaEmSaoPaulo = (data) => new Date(data).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

function dataReal(texto) {
  if (typeof texto !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const [a, m, d] = texto.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d));
  return t.getUTCFullYear() === a && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

// referencia: o instante em que a mensagem foi enviada. "Nada com data futura entra" conta a partir dela, não do relógio do servidor.
function validarLancamento(l, { cliente, referencia }) {
  const erros = [];
  if (l === null || typeof l !== "object" || Array.isArray(l)) return [{ campo: "lancamento", erro: "lancamento_invalido" }];

  const categoria = planoDoCliente(cliente).find((c) => c.codigo === l.categoria);
  if (!categoria || categoria.tipo === "pendencia") erros.push({ campo: "categoria", erro: "categoria_inexistente" });
  else if (!["receita", "despesa", "movimento"].includes(l.tipo) || categoria.tipo !== l.tipo) erros.push({ campo: "tipo", erro: "tipo_nao_combina" });

  const estorno = l.categoria === "1.4"; // única exceção: estorno vai com sinal negativo
  const valorOk = typeof l.valor === "number" && Number.isFinite(l.valor) && (estorno ? l.valor < 0 : l.valor > 0)
    && Math.abs(l.valor * 100 - Math.round(l.valor * 100)) < 1e-6;
  if (!valorOk) erros.push({ campo: "valor", erro: "valor_invalido" });

  if (!dataReal(l.data)) erros.push({ campo: "data", erro: "data_invalida" });
  else if (l.data > diaEmSaoPaulo(referencia)) erros.push({ campo: "data", erro: "data_futura" });

  if (!FORMAS.includes(l.forma)) erros.push({ campo: "forma", erro: "forma_invalida" });
  return erros;
}

module.exports = { validarLancamento, planoDoCliente, FORMAS };
