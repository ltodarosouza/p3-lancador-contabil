const test = require("node:test");
const assert = require("node:assert/strict");
const { validarLancamento } = require("../lib/validar");

const cliente = { codigo: "C-0417" };
const referencia = "2026-10-13T16:22:00-03:00";
const bom = { data: "2026-10-12", tipo: "despesa", categoria: "2.4", valor: 1200, forma: "nao_informado" };
const erros = (mudanca) => validarLancamento({ ...bom, ...mudanca }, { cliente, referencia }).map((e) => e.erro);

test("um lançamento certo passa sem nenhum erro", () => assert.deepEqual(erros({}), []));

test("categoria que não existe no plano de contas é recusada, e 9.1 não é lançamento", () => {
  assert.deepEqual(erros({ categoria: "9.9" }), ["categoria_inexistente"]);
  assert.deepEqual(erros({ categoria: "2.99" }), ["categoria_inexistente"]);
  assert.deepEqual(erros({ categoria: undefined }), ["categoria_inexistente"]);
  assert.deepEqual(erros({ categoria: "9.1", tipo: "movimento" }), ["categoria_inexistente"]);
});

test("o tipo precisa combinar com a categoria", () => {
  assert.deepEqual(erros({ tipo: "receita" }), ["tipo_nao_combina"], "luz como receita");
  assert.deepEqual(erros({ categoria: "1.1", tipo: "despesa" }), ["tipo_nao_combina"], "venda como despesa");
  assert.deepEqual(erros({ tipo: "qualquer" }), ["tipo_nao_combina"]);
  assert.deepEqual(erros({ categoria: "3.5", tipo: "movimento" }), [], "equipamento é movimento");
});

test("valor tem de ser positivo, com no máximo duas casas, e em número", () => {
  for (const valor of [0, -5, "1200", null, NaN, Infinity, 10.123]) assert.deepEqual(erros({ valor }), ["valor_invalido"], String(valor));
  assert.deepEqual(erros({ valor: 1166.67 }), []);
});

test("a única exceção do sinal é o estorno de receita (1.4), que é negativo", () => {
  assert.deepEqual(erros({ categoria: "1.4", tipo: "receita", valor: -300 }), []);
  assert.deepEqual(erros({ categoria: "1.4", tipo: "receita", valor: 300 }), ["valor_invalido"]);
});

test("data tem de existir e não pode ser depois do dia da mensagem", () => {
  assert.deepEqual(erros({ data: "2026-10-13" }), [], "o próprio dia vale");
  assert.deepEqual(erros({ data: "2026-10-14" }), ["data_futura"]);
  assert.deepEqual(erros({ data: "2026-10-20" }), ["data_futura"], "a parcela que cai dia 20");
  for (const data of ["2026-02-30", "13/10/2026", "ontem", 20261012, undefined]) assert.deepEqual(erros({ data }), ["data_invalida"], String(data));
});

test("a data futura conta pelo dia da mensagem em São Paulo, não pelo do servidor", () => {
  const e = validarLancamento({ ...bom, data: "2026-10-13" }, { cliente, referencia: "2026-10-14T01:30:00Z" }); // ainda é 13/10 às 22h30 em São Paulo
  assert.deepEqual(e, []);
});

test("forma de pagamento fora da lista é recusada", () => {
  assert.deepEqual(erros({ forma: "cheque" }), ["forma_invalida"]);
  assert.deepEqual(erros({ forma: undefined }), ["forma_invalida"]);
});

test("o que não é objeto não é lançamento", () => {
  for (const ruim of [null, "2.4", 7, [], undefined]) assert.deepEqual(validarLancamento(ruim, { cliente, referencia }).map((e) => e.erro), ["lancamento_invalido"]);
});
