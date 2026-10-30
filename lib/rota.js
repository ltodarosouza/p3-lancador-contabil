// Cola entre o Node (Vercel ou servidor local) e o lançador. A chave só existe aqui, vinda do ambiente, e nunca sai.
const { lancar } = require("./lancador");

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
    if (!r.ok) throw new Error(`gemini ${r.status}`);
    const corpo = await r.json();
    return {
      texto: corpo.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "",
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
  const { status, corpo: resposta } = await lancar(corpo, { configurado: Boolean(chave), chamarModelo: chave ? chamarGemini({ chave, modelo, fetchImpl }) : null });
  return enviar(status, resposta);
}

module.exports = { tratar, chamarGemini, lerCorpo };
