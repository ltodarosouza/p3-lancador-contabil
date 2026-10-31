// Onde a fila, o contador de uso e o custo do mês ficam guardados. Uma interface só, duas implementações:
//   memoria  vale por instância da função; é o que os testes e o servidor local usam sem configuração
//   upstash  Redis por HTTP (REST); é o que vale entre instâncias e reinícios, quando o ambiente traz o endereço e o token
// Todos os valores são texto; quem guarda objeto faz JSON.stringify e JSON.parse.

function armazemEmMemoria() {
  const dados = new Map();
  const conjuntos = new Map();
  const conj = (k) => { if (!conjuntos.has(k)) conjuntos.set(k, new Set()); return conjuntos.get(k); };
  const numero = (k) => Number(dados.get(k) ?? 0);
  return {
    nome: "memoria",
    async get(k) { return dados.has(k) ? dados.get(k) : null; },
    async set(k, v) { dados.set(k, String(v)); },
    // só grava se a chave ainda não existe; devolve se gravou. É o que impede dois cliques de resolverem o mesmo item.
    async setnx(k, v) { if (dados.has(k)) return false; dados.set(k, String(v)); return true; },
    async del(k) { dados.delete(k); },
    async incr(k) { const n = numero(k) + 1; dados.set(k, String(n)); return n; },
    async decr(k) { const n = numero(k) - 1; dados.set(k, String(n)); return n; },
    async incrbyfloat(k, d) { const n = numero(k) + d; dados.set(k, String(n)); return n; },
    async mget(ks) { return ks.map((k) => (dados.has(k) ? dados.get(k) : null)); },
    async sadd(k, m) { conj(k).add(m); },
    async smembers(k) { return [...conj(k)]; },
  };
}

// A API REST do Upstash recebe o comando como uma lista, por POST, e devolve { result } ou { error }.
function armazemUpstash({ url, token, fetchImpl = fetch }) {
  const comando = async (...partes) => {
    const r = await fetchImpl(url, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(partes) });
    const corpo = await r.json().catch(() => ({}));
    if (!r.ok || corpo.error) throw new Error(`armazem_falhou_${r.status}`); // nunca devolve o texto do erro: ele pode trazer o endereço
    return corpo.result;
  };
  return {
    nome: "upstash",
    get: (k) => comando("GET", k),
    set: async (k, v) => { await comando("SET", k, String(v)); },
    setnx: async (k, v) => (await comando("SET", k, String(v), "NX")) === "OK",
    del: async (k) => { await comando("DEL", k); },
    incr: (k) => comando("INCR", k),
    decr: (k) => comando("DECR", k),
    incrbyfloat: async (k, d) => Number(await comando("INCRBYFLOAT", k, String(d))),
    mget: async (ks) => (ks.length ? comando("MGET", ...ks) : []),
    sadd: async (k, m) => { await comando("SADD", k, m); },
    smembers: (k) => comando("SMEMBERS", k),
  };
}

// A integração do Upstash na Vercel injeta KV_REST_API_URL e KV_REST_API_TOKEN (ou os nomes UPSTASH_REDIS_REST_*).
function armazemDoAmbiente(env = process.env, fetchImpl) {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? armazemUpstash({ url, token, fetchImpl }) : armazemEmMemoria();
}

module.exports = { armazemEmMemoria, armazemUpstash, armazemDoAmbiente };
