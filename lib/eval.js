// Compara o que o sistema devolveu com o gabarito de um caso. Quem confere é o código; a voz da pergunta fica com uma pessoa.
const CAMPOS = ["data", "tipo", "categoria", "valor", "forma", "data_assumida"];
const ordem = (a, b) => String(a.categoria).localeCompare(String(b.categoria)) || a.valor - b.valor;

function comparar(esperado, obtido, { fora = [] } = {}) {
  const dif = [];
  if (esperado.resultado !== obtido.resultado) dif.push(`resultado: esperado ${esperado.resultado}, veio ${obtido.resultado}`);
  const nPend = Array.isArray(obtido.pendencias) ? obtido.pendencias.length : obtido.pendencias;
  if (esperado.pendencias !== nPend) dif.push(`pendências: esperado ${esperado.pendencias}, vieram ${nPend}`);
  if (esperado.aviso !== obtido.aviso) dif.push(`aviso: esperado ${esperado.aviso}, veio ${obtido.aviso}`);
  const e = [...esperado.lancamentos].sort(ordem), o = [...obtido.lancamentos].sort(ordem);
  if (e.length !== o.length) dif.push(`lançamentos: esperado ${e.length}, vieram ${o.length}`);
  else e.forEach((x, i) => CAMPOS.filter((c) => !fora.includes(c)).forEach((c) => { if (x[c] !== o[i][c]) dif.push(`lançamento ${i + 1}, ${c}: esperado ${x[c]}, veio ${o[i][c]}`); }));
  return { passou: dif.length === 0, diferencas: dif };
}

const TERMOS = ["categoria", "código", "codigo", "pró-labore", "pro-labore", "lançamento", "lancamento", "despesa", "receita", "plano de contas", "contábil", "contabil"];
// O que dá para contar numa pergunta de volta ao cliente. "Na voz da casa" é leitura de gente, não daqui.
function perguntaMecanica(texto, nomeDoCliente) {
  const p = [];
  if ((texto.match(/\?/g) || []).length !== 1) p.push("não tem exatamente um '?'");
  if (texto.length > 140) p.push("passa de 140 caracteres");
  if (!texto.includes(nomeDoCliente)) p.push("não usa o nome do cliente");
  const achou = TERMOS.filter((t) => texto.toLowerCase().includes(t));
  if (achou.length) p.push("tem termo contábil: " + achou.join(", "));
  if (/\b\d\.\d{1,2}\b/.test(texto)) p.push("mostra código do plano");
  return p;
}

module.exports = { comparar, perguntaMecanica };
