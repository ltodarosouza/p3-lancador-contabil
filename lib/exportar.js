// O arquivo que o sistema da casa importa: uma linha por lançamento conferido, separador ponto e vírgula, cabeçalho na primeira linha.
// As colunas são as do material. Aviso, data assumida e pendência são coisa da fila e não vão para o arquivo.
const COLUNAS = ["cliente_id", "data", "tipo", "categoria", "valor", "forma", "contraparte", "descricao", "origem", "aprovado_por"];

// Texto que veio do cliente: uma linha só, sem começar com = + - @ (abriria como fórmula numa planilha), e entre aspas se tiver ; ou ".
function texto(t, max) {
  let s = String(t ?? "").replace(/[\r\n\t]+/g, " ").trim();
  if (max) s = s.slice(0, max);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[;"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function linha(item) {
  const l = item.lancamento;
  return [
    item.cliente_id, l.data, l.tipo, l.categoria,
    Number(l.valor).toFixed(2), // sempre ponto e duas casas; só o estorno (1.4) é negativo
    l.forma, texto(l.contraparte), texto(l.descricao, 80), item.mensagem_id ?? "", item.resolvido_por,
  ].join(";");
}

const paraCsv = (itens) => [COLUNAS.join(";"), ...itens.map(linha)].join("\n") + "\n";

module.exports = { paraCsv, COLUNAS };
