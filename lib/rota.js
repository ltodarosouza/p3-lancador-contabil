// Cola entre o Node (Vercel ou servidor local) e o lançador. A chave só existe aqui, vinda do ambiente, e nunca sai.
const { lancar } = require("./lancador");
const { criarContador } = require("./teto");
const { criarFila, ErroDeFila } = require("./fila");
const { FalhaDoModelo } = require("./falhas");

const contador = criarContador(); // por instância da função; ver README, "Teto"
const fila = criarFila();         // idem: em memória, por instância; ver README, "Fila"

const LIMITE_DO_CORPO = 8 * 1024;

function lerCorpo(req) {
  if (req.body !== undefined) return Promise.resolve(typeof req.body === "string" ? JSON.parse(req.body) : req.body);
  return new Promise((ok, falha) => {
    let texto = "";
    req.on("data", (c) => { texto += c; if (texto.length > LIMITE_DO_CORPO) req.destroy(); });
    req.on("end", () => { try { ok(texto ? JSON.parse(texto) : {}); } catch (e) { falha(e); } });
    req.on("error", falha);
  });
}

function chamarGemini({ chave, modelo, fetchImpl = fetch }) {
  return async ({ sistema, entrada }) => {
    const r = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": chave, "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sistema }] },
        contents: [{ role: "user", parts: [{ text: entrada }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0, maxOutputTokens: 2000 },
      }),
    });
    // 429, 408 e 5xx a documentação manda tentar de novo com espera; os outros 4xx não adianta repetir.
    if (!r.ok) throw new FalhaDoModelo(r.status === 429 || r.status === 408 || r.status >= 500 ? "transitoria" : "recusada", `http_${r.status}`);
    const corpo = await r.json();
    if (corpo.promptFeedback?.blockReason) throw new FalhaDoModelo("bloqueada", corpo.promptFeedback.blockReason);
    const candidato = corpo.candidates?.[0];
    if (!candidato) throw new FalhaDoModelo("vazia", "sem_candidato");
    const parada = candidato.finishReason;
    if (parada === "MAX_TOKENS") throw new FalhaDoModelo("cortada", parada);
    if (parada && parada !== "STOP") throw new FalhaDoModelo("bloqueada", parada); // SAFETY, RECITATION, SPII, BLOCKLIST e as outras paradas que não são fim natural
    return {
      texto: candidato.content?.parts?.map((p) => p.text).join("") ?? "",
      tokens: { entrada: corpo.usageMetadata?.promptTokenCount, saida: corpo.usageMetadata?.candidatesTokenCount },
    };
  };
}

async function tratar(req, res, { env = process.env, fetchImpl } = {}) {
  const enviar = (status, corpo) => {
    res.statusCode = status;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify(corpo));
  };
  if (req.method !== "POST") { res.setHeader("allow", "POST"); return enviar(405, { erro: "use_post" }); }
  let corpo;
  try { corpo = await lerCorpo(req); } catch { return enviar(400, { erro: "corpo_invalido" }); }
  const chave = env.GEMINI_API_KEY;
  const modelo = env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const { status, corpo: resposta } = await lancar(corpo, { configurado: Boolean(chave), modelo, contador, fila, historico: (id) => fila.aprovados(id), log: (linha) => console.log(JSON.stringify(linha)), chamarModelo: chave ? chamarGemini({ chave, modelo, fetchImpl }) : null });
  return enviar(status, resposta);
}

// A fila: GET lista (?estado=&tipo=), POST { id, acao: "aprovar" | "corrigir", quem, campos }.
async function tratarFila(req, res, { filaDeTrabalho = fila } = {}) {
  const enviar = (status, corpo) => { res.statusCode = status; res.setHeader("content-type", "application/json; charset=utf-8"); res.end(JSON.stringify(corpo)); };
  if (req.method === "GET") {
    const q = new URL(req.url, "http://x").searchParams;
    return enviar(200, { itens: filaDeTrabalho.listar({ estado: q.get("estado") || undefined, tipo: q.get("tipo") || undefined }), resumo: filaDeTrabalho.resumo() });
  }
  if (req.method !== "POST") { res.setHeader("allow", "GET, POST"); return enviar(405, { erro: "use_get_ou_post" }); }
  let corpo;
  try { corpo = await lerCorpo(req); } catch { return enviar(400, { erro: "corpo_invalido" }); }
  try {
    if (typeof corpo.quem !== "string" || !corpo.quem.trim()) return enviar(400, { erro: "quem_obrigatorio" });
    if (corpo.acao === "aprovar") return enviar(200, { item: filaDeTrabalho.aprovar(corpo.id, corpo.quem) });
    if (corpo.acao === "corrigir") return enviar(200, { item: filaDeTrabalho.corrigir(corpo.id, corpo.campos, corpo.quem) });
    return enviar(400, { erro: "acao_invalida" });
  } catch (e) {
    if (e instanceof ErroDeFila) return enviar(e.erro === "item_inexistente" ? 404 : 409, { erro: e.erro, ...(e.detalhes ? { detalhes: e.detalhes } : {}), ...(e.estado ? { estado: e.estado } : {}) });
    throw e;
  }
}

module.exports = { tratar, tratarFila, chamarGemini, lerCorpo, fila };
