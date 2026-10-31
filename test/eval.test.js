const test = require("node:test");
const assert = require("node:assert/strict");
const { comparar, perguntaMecanica } = require("../lib/eval");

const L = (o = {}) => ({ data: "2026-10-10", tipo: "despesa", categoria: "2.3", valor: 1250, forma: "boleto", data_assumida: false, ...o });
const esperado = { resultado: "lancou", lancamentos: [L()], pendencias: 0, aviso: false };
const obtido = (o = {}) => ({ resultado: "lancou", lancamentos: [L()], pendencias: [], aviso: false, ...o });

test("tudo igual passa", () => assert.deepEqual(comparar(esperado, obtido()), { passou: true, diferencas: [] }));

test("valor certo na categoria errada não passa, e a diferença diz o campo", () => {
  const r = comparar(esperado, obtido({ lancamentos: [L({ categoria: "2.1" })] }));
  assert.equal(r.passou, false);
  assert.match(r.diferencas.join("|"), /categoria.*2\.3.*2\.1/);
});

test("a ordem dos lançamentos não importa", () => {
  const dois = { ...esperado, lancamentos: [L({ categoria: "1.1", valor: 380 }), L({ categoria: "1.2", valor: 220 })] };
  assert.equal(comparar(dois, obtido({ lancamentos: [dois.lancamentos[1], dois.lancamentos[0]] })).passou, true);
});

test("quantidade de lançamentos, de pendências e o aviso contam", () => {
  assert.equal(comparar(esperado, obtido({ lancamentos: [L(), L()] })).passou, false);
  assert.equal(comparar(esperado, obtido({ pendencias: [{ pergunta: "x?" }] })).passou, false);
  assert.equal(comparar(esperado, obtido({ aviso: true })).passou, false);
});

test("a marca de data assumida conta", () => assert.equal(comparar(esperado, obtido({ lancamentos: [L({ data_assumida: true })] })).passou, false));

test("a categoria pode ficar fora da comparação, e isso aparece dito", () => {
  const r = comparar(esperado, obtido({ lancamentos: [L({ categoria: "2.15" })] }), { fora: ["categoria"] });
  assert.equal(r.passou, true);
});

test("pergunta: uma só, curta, com ?, com o nome do cliente e sem termo contábil", () => {
  assert.deepEqual(perguntaMecanica("Rubens, os 300 pro Marquinho foram pelo muro?", "Rubens"), []);
  assert.ok(perguntaMecanica("Qual a categoria desse lançamento?", "Rubens").length >= 2);
  assert.ok(perguntaMecanica("Rubens, foi o quê? E de quem? ".padEnd(200, "x") + "?", "Rubens").length >= 1);
});
