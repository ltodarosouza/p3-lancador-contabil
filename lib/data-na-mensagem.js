// A marca "data assumida" é decidida aqui, em código, olhando o texto da mensagem; o que o modelo diz sobre isso não conta.
const MESES = "janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro";
const DIAS = "domingo|segunda|terça|terca|quarta|quinta|sexta|sábado|sabado";
const PADROES = [
  /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/,
  /\bdia\s+\d{1,2}\b/,
  new RegExp(`\\b\\d{1,2}\\s+de\\s+(${MESES})\\b`),
  /\b(hoje|ontem|anteontem|amanhã|amanha)\b/,
  new RegExp(`\\b(${DIAS})\\b`),
  /\b(semana|mês|mes)\s+(passada|passado|que vem)\b/,
  /\b(esta|essa|nesta|nessa)\s+(semana|manhã|manha)\b/,
];

const trazData = (texto) => PADROES.some((p) => p.test(String(texto).toLowerCase()));

module.exports = { trazData };
