// Roda o contrato do armazém contra o Redis de verdade (Upstash), depois que as variáveis KV_REST_API_URL e KV_REST_API_TOKEN existirem.
// Uso: vercel env pull .env.local && node scripts/prova-armazem.js     (as variáveis nunca são impressas)
// Tudo o que ele grava usa um prefixo só dele ("prova:<sorteio>:") e é apagado no fim; ele não toca na fila nem nos contadores de verdade.
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { armazemUpstash } = require("../lib/armazem");
const { criarFila } = require("../lib/fila");
const { criarContador } = require("../lib/teto");

// Dá a um armazém um prefixo de chaves e lembra quais usou, para apagar no fim.
function comPrefixo(a, prefixo) {
  const usadas = new Set();
  const k = (x) => { usadas.add(prefixo + x); return prefixo + x; };
  return {
    nome: a.nome,
    get: (x) => a.get(k(x)), set: (x, v) => a.set(k(x), v), setnx: (x, v) => a.setnx(k(x), v), del: (x) => a.del(k(x)),
    incr: (x) => a.incr(k(x)), decr: (x) => a.decr(k(x)), incrbyfloat: (x, d) => a.incrbyfloat(k(x), d),
    mget: (xs) => a.mget(xs.map(k)), sadd: (x, m) => a.sadd(k(x), m), smembers: (x) => a.smembers(k(x)),
    async limpar() { for (const x of usadas) await a.del(x); },
  };
}

async function provar(a) {
  assert.equal(await a.get("x"), null);
  await a.set("x", "1");
  assert.equal(await a.get("x"), "1");
  assert.equal(await a.setnx("x", "2"), false);
  assert.equal(await a.setnx("y", "2"), true);
  assert.equal(await a.incr("n"), 1);
  assert.equal(await a.decr("n"), 0);
  assert.equal(Number(await a.incrbyfloat("c", 0.5)), 0.5);
  assert.deepEqual(await a.mget(["x", "zzz", "y"]), ["1", null, "2"]);
  await a.sadd("s", "a"); await a.sadd("s", "a"); await a.sadd("s", "b");
  assert.deepEqual((await a.smembers("s")).sort(), ["a", "b"]);

  // Duas instâncias da fila sobre o mesmo Redis: veem o mesmo item, e só uma aprovação vale.
  const um = criarFila({ armazem: a }), outro = criarFila({ armazem: a });
  const id = await um.adicionar({ cliente_id: "C-0417", tipo: "lancamento", mensagem: "x", recebida_em: "2026-10-13T09:00:00-03:00", lancamento: { data: "2026-10-13", tipo: "despesa", categoria: "2.3", valor: 10, forma: "pix", contraparte: "", descricao: "d" } });
  assert.equal((await outro.listar()).length, 1);
  const r = await Promise.allSettled([um.aprovar(id, "tiago"), outro.aprovar(id, "aline")]);
  assert.equal(r.filter((x) => x.status === "fulfilled").length, 1, "só uma aprovação vale");

  // Contador: duas instâncias, o teto vale para as duas, e a mensagem barrada não gasta uso.
  const c1 = criarContador({ armazem: a }), c2 = criarContador({ armazem: a });
  assert.equal((await c1.tentar("C-1", "2026-10", 2)).permitido, true);
  assert.equal((await c2.tentar("C-1", "2026-10", 2)).permitido, true);
  const barrada = await c1.tentar("C-1", "2026-10", 2);
  assert.equal(barrada.permitido, false);
  assert.equal(barrada.usadas, 2);
  return "ok";
}

module.exports = { provar, comPrefixo };

if (require.main === module) {
  for (const f of [".env.local", ".env"]) { try { process.loadEnvFile(f); } catch { /* arquivo ausente */ } }
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) { console.error("Faltam KV_REST_API_URL e KV_REST_API_TOKEN (rode: vercel env pull .env.local)."); process.exit(2); }
  const a = comPrefixo(armazemUpstash({ url, token }), `prova:${crypto.randomBytes(4).toString("hex")}:`);
  provar(a).then((r) => console.log("contrato contra o Redis de verdade:", r)).catch((e) => { console.error("FALHOU:", e.message); process.exitCode = 1; }).finally(() => a.limpar());
}
