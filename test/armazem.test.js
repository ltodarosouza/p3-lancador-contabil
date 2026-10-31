// O armazém é o que faz a fila e o contador valerem entre instâncias. Aqui o mesmo contrato roda na memória e no Redis (REST) de mentira.
const test = require("node:test");
const assert = require("node:assert/strict");
const { armazemEmMemoria, armazemUpstash, armazemDoAmbiente } = require("../lib/armazem");
const { criarFila } = require("../lib/fila");
const { criarContador } = require("../lib/teto");

// Um Redis de mentira que fala o mesmo REST do Upstash: recebe a lista de comando por POST e devolve { result }.
function redisDeMentira() {
  const kv = new Map(), sets = new Map(), pedidos = [];
  const fetchImpl = async (url, { headers, body }) => {
    const [cmd, ...a] = JSON.parse(body);
    pedidos.push({ url, headers, cmd, a });
    const num = (k) => Number(kv.get(k) ?? 0);
    let result;
    switch (cmd) {
      case "GET": result = kv.get(a[0]) ?? null; break;
      case "SET": if (a[2] === "NX" && kv.has(a[0])) { result = null; break; } kv.set(a[0], a[1]); result = "OK"; break;
      case "DEL": kv.delete(a[0]); sets.delete(a[0]); result = 1; break; // o DEL do Redis apaga a chave de qualquer tipo
      case "INCR": kv.set(a[0], String(num(a[0]) + 1)); result = num(a[0]); break;
      case "DECR": kv.set(a[0], String(num(a[0]) - 1)); result = num(a[0]); break;
      case "INCRBYFLOAT": kv.set(a[0], String(num(a[0]) + Number(a[1]))); result = kv.get(a[0]); break;
      case "MGET": result = a.map((k) => kv.get(k) ?? null); break;
      case "SADD": if (!sets.has(a[0])) sets.set(a[0], new Set()); sets.get(a[0]).add(a[1]); result = 1; break;
      case "SMEMBERS": result = [...(sets.get(a[0]) ?? [])]; break;
      default: return { ok: false, status: 400, json: async () => ({ error: "comando" }) };
    }
    return { ok: true, status: 200, json: async () => ({ result }) };
  };
  return { fetchImpl, pedidos };
}

const implementacoes = {
  memoria: () => armazemEmMemoria(),
  upstash: () => armazemUpstash({ url: "https://redis.exemplo.test", token: "token-so-de-teste", fetchImpl: redisDeMentira().fetchImpl }),
};

for (const [nome, nova] of Object.entries(implementacoes)) {
  test(`armazém ${nome}: guarda, conta, grava só se não existe e lista conjuntos`, async () => {
    const a = nova();
    assert.equal(await a.get("x"), null);
    await a.set("x", "1");
    assert.equal(await a.get("x"), "1");
    assert.equal(await a.setnx("x", "2"), false);
    assert.equal(await a.setnx("y", "2"), true);
    assert.equal(await a.incr("n"), 1);
    assert.equal(await a.incr("n"), 2);
    assert.equal(await a.decr("n"), 1);
    assert.equal(Number(await a.incrbyfloat("c", 0.5)), 0.5);
    assert.equal(Number(await a.incrbyfloat("c", 0.25)), 0.75);
    assert.deepEqual(await a.mget(["x", "zzz", "y"]), ["1", null, "2"]);
    await a.sadd("s", "a"); await a.sadd("s", "a"); await a.sadd("s", "b");
    assert.deepEqual((await a.smembers("s")).sort(), ["a", "b"]);
    await a.del("x");
    assert.equal(await a.get("x"), null);
  });

  test(`armazém ${nome}: duas instâncias da fila sobre o mesmo armazém enxergam a mesma fila, e o item só fecha uma vez`, async () => {
    const a = nova();
    const um = criarFila({ armazem: a }), outro = criarFila({ armazem: a });
    const id = await um.adicionar({ cliente_id: "C-0417", tipo: "lancamento", mensagem: "x", recebida_em: "2026-10-13T09:00:00-03:00", lancamento: { data: "2026-10-13", tipo: "despesa", categoria: "2.3", valor: 10, forma: "pix", contraparte: "", descricao: "d" } });
    assert.equal((await outro.listar()).length, 1, "a outra instância vê o item");
    const resultados = await Promise.allSettled([um.aprovar(id, "tiago"), outro.aprovar(id, "aline")]);
    assert.equal(resultados.filter((r) => r.status === "fulfilled").length, 1, "só uma aprovação vale");
    assert.equal(resultados.find((r) => r.status === "rejected").reason.erro, "ja_resolvido");
    assert.equal((await um.obter(id)).estado, "aprovado");
  });

  test(`armazém ${nome}: o contador conta entre instâncias e não deixa passar do teto`, async () => {
    const a = nova();
    const c1 = criarContador({ armazem: a }), c2 = criarContador({ armazem: a });
    assert.equal((await c1.tentar("C-1", "2026-10", 2)).permitido, true);
    assert.equal((await c2.tentar("C-1", "2026-10", 2)).permitido, true);
    const barrada = await c1.tentar("C-1", "2026-10", 2);
    assert.equal(barrada.permitido, false);
    assert.equal(barrada.usadas, 2, "a mensagem barrada não gasta uso");
    await c1.registrarCusto("C-1", "2026-10", 0.004);
    await c2.registrarCusto("C-1", "2026-10", 0.006);
    const [linha] = await c1.usoDoMes("2026-10");
    assert.equal(linha.cliente, "C-1");
    assert.equal(linha.usadas, 2);
    assert.ok(Math.abs(linha.custo_brl - 0.01) < 1e-9);
    assert.deepEqual(await c1.usoDoMes("2026-11"), []);
  });
}

test("o armazém do Redis usa o token no cabeçalho e nunca devolve o texto do erro", async () => {
  const { fetchImpl, pedidos } = redisDeMentira();
  const a = armazemUpstash({ url: "https://redis.exemplo.test", token: "token-so-de-teste", fetchImpl });
  await a.set("k", "v");
  assert.equal(pedidos[0].headers.authorization, "Bearer token-so-de-teste");
  const quebrado = armazemUpstash({ url: "https://redis.exemplo.test", token: "token-so-de-teste", fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({ error: "ERR https://redis.exemplo.test token-so-de-teste" }) }) });
  await assert.rejects(() => quebrado.get("k"), (e) => e.message === "armazem_falhou_500" && !/token|redis/.test(e.message));
});

test("sem variáveis no ambiente o armazém é a memória; com elas, o Redis", () => {
  assert.equal(armazemDoAmbiente({}).nome, "memoria");
  assert.equal(armazemDoAmbiente({ KV_REST_API_URL: "https://a.test" }).nome, "memoria", "só o endereço não basta");
  assert.equal(armazemDoAmbiente({ KV_REST_API_URL: "https://a.test", KV_REST_API_TOKEN: "t" }).nome, "upstash");
  assert.equal(armazemDoAmbiente({ UPSTASH_REDIS_REST_URL: "https://a.test", UPSTASH_REDIS_REST_TOKEN: "t" }).nome, "upstash");
});

// O script que roda o contrato contra o Redis de verdade também é testado, aqui contra a memória e contra o Redis de mentira.
test("o script de prova do Redis de verdade passa na memória e no Redis de mentira, e apaga o que gravou", async () => {
  const { provar, comPrefixo } = require("../scripts/prova-armazem");
  for (const nova of Object.values(implementacoes)) {
    const base = nova();
    const a = comPrefixo(base, "prova:teste:");
    assert.equal(await provar(a), "ok");
    await a.limpar();
    assert.equal(await base.get("prova:teste:x"), null, "o que o script gravou foi apagado");
    assert.deepEqual(await base.smembers("prova:teste:s"), []);
  }
});
