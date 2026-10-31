// O que a Denise lê: quanto o mês teria custado e quem passou do teto. Vem do que o sistema contou, não de estimativa.
const test = require("node:test");
const assert = require("node:assert/strict");
const { lancar } = require("../lib/lancador");
const { criarContador, TETOS } = require("../lib/teto");
const { tratarPainel } = require("../lib/rota");

const ENV = { CHAVE_TIAGO: "chave-de-teste-do-tiago-0001", CHAVE_ALINE: "chave-de-teste-da-aline-0002", CHAVE_DENISE: "chave-de-teste-da-denise-003" };
const AGORA = () => new Date("2026-10-30T20:00:00-03:00");
const OK = async () => ({ texto: JSON.stringify({ lancamentos: [], pendencias: [], aviso: false, motivo: "regra 13" }), tokens: { entrada: 1666, saida: 70 } });
const msg = (cliente_id) => ({ cliente_id, mensagem: "bom dia", recebida_em: "2026-10-30T10:00:00-03:00" });

async function chamar(contador, { chave, url = "/api/painel", metodo = "GET" } = {}) {
  const req = { method: metodo, url, headers: chave ? { authorization: `Bearer ${chave}` } : {} };
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(t) { this.texto = t; } };
  await tratarPainel(req, res, { contador, env: ENV, agora: AGORA });
  return { status: res.statusCode, corpo: JSON.parse(res.texto) };
}

test("o custo do mês é a soma do custo de cada chamada, dos tokens que o provedor devolveu", async () => {
  const contador = criarContador();
  for (let i = 0; i < 3; i++) await lancar(msg("C-0417"), { chamarModelo: OK, contador, agora: AGORA });
  await lancar(msg("C-0288"), { chamarModelo: OK, contador, agora: AGORA });
  const r = await chamar(contador, { chave: ENV.CHAVE_DENISE });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.mes, "2026-10");
  const por = Object.fromEntries(r.corpo.clientes.map((c) => [c.cliente_id, c]));
  assert.equal(por["C-0417"].mensagens, 3);
  assert.equal(por["C-0288"].mensagens, 1);
  assert.equal(por["C-0533"].mensagens, 0, "cliente sem uso também aparece");
  // 0.003658 é o custo de uma chamada de 1666 + 70 tokens, arredondado em 6 casas (README); por isso a tolerância é de 1e-5 em 3 chamadas.
  assert.ok(Math.abs(por["C-0417"].custo_brl - 3 * 0.003658) < 1e-5);
  assert.ok(Math.abs(r.corpo.custo_total_brl - 4 * 0.003658) < 1e-5);
  assert.equal(r.corpo.mensagens_total, 4);
});

test("quem passou do teto aparece com o plano, o teto e quantas mensagens foram barradas", async () => {
  const contador = criarContador();
  for (let i = 0; i < TETOS.Essencial + 2; i++) await lancar(msg("C-0288"), { chamarModelo: OK, contador, agora: AGORA });
  await lancar(msg("C-0417"), { chamarModelo: OK, contador, agora: AGORA });
  const r = await chamar(contador, { chave: ENV.CHAVE_DENISE });
  const c = r.corpo.clientes.find((x) => x.cliente_id === "C-0288");
  assert.deepEqual({ plano: c.plano, teto: c.teto, mensagens: c.mensagens, barradas: c.barradas, passou_do_teto: c.passou_do_teto }, { plano: "Essencial", teto: TETOS.Essencial, mensagens: TETOS.Essencial, barradas: 2, passou_do_teto: true });
  assert.equal(r.corpo.clientes.find((x) => x.cliente_id === "C-0417").passou_do_teto, false);
  assert.deepEqual(r.corpo.passaram_do_teto, ["C-0288"], "a lista de quem está no plano errado");
});

test("o mês vem do relógio do servidor, aceita ?mes= e recusa mês que não existe", async () => {
  const contador = criarContador();
  await lancar(msg("C-0417"), { chamarModelo: OK, contador, agora: AGORA });
  assert.equal((await chamar(contador, { chave: ENV.CHAVE_DENISE, url: "/api/painel?mes=2026-09" })).corpo.mensagens_total, 0);
  assert.equal((await chamar(contador, { chave: ENV.CHAVE_DENISE, url: "/api/painel?mes=2026-13" })).status, 400);
  assert.equal((await chamar(contador, { chave: ENV.CHAVE_DENISE, url: "/api/painel?mes=x" })).status, 400);
});

test("só a Denise lê o painel: Tiago e Aline levam 403, sem chave 401", async () => {
  const contador = criarContador();
  assert.equal((await chamar(contador, { chave: ENV.CHAVE_TIAGO })).status, 403);
  assert.equal((await chamar(contador, { chave: ENV.CHAVE_ALINE })).status, 403);
  assert.equal((await chamar(contador, {})).status, 401);
  assert.equal((await chamar(contador, { chave: "errada" })).status, 401);
});

test("falha do modelo com tokens também custa, e o painel não traz texto de mensagem", async () => {
  const contador = criarContador();
  const cortada = async () => ({ texto: "isto não é json", tokens: { entrada: 1000, saida: 50 } });
  await lancar({ ...msg("C-0417"), mensagem: "SEGREDO-DO-CLIENTE" }, { chamarModelo: cortada, contador, agora: AGORA });
  const r = await chamar(contador, { chave: ENV.CHAVE_DENISE });
  assert.ok(r.corpo.custo_total_brl > 0, "a resposta ilegível gastou tokens");
  assert.doesNotMatch(JSON.stringify(r.corpo), /SEGREDO-DO-CLIENTE/);
});
