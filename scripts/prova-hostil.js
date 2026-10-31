// Roda uma mensagem hostil pelo sistema de verdade (Gemini) e mostra o que entrou na chamada, o que o modelo devolveu e o que ficou na fila.
// Uso: node scripts/prova-hostil.js C-0288 "texto da mensagem"   (a chave vem do .env e nunca é impressa)
try { process.loadEnvFile(".env"); } catch { /* sem .env */ }
const { chamarGemini } = require("../lib/rota");
const { lancar } = require("../lib/lancador");
const { criarFila } = require("../lib/fila");

(async () => {
  const [cliente_id, mensagem] = process.argv.slice(2);
  const real = chamarGemini({ chave: process.env.GEMINI_API_KEY, modelo: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite" });
  let chamada;
  const fila = criarFila();
  const r = await lancar({ cliente_id, mensagem, recebida_em: "2026-10-14T10:00:00-03:00", mensagem_id: "H1" }, {
    chamarModelo: async (c) => { chamada = c; return real(c); }, fila,
  });
  console.log("== O QUE ENTROU NA CHAMADA (entrada; o system são as regras e o plano, iguais para todos)\n" + chamada?.entrada);
  console.log("\n== RESPOSTA DO SISTEMA (status " + r.status + ")\n" + JSON.stringify({ ...r.corpo, tokens: undefined }, null, 1));
  console.log("\n== FILA\n" + JSON.stringify(fila.listar().map(({ id, tipo, estado, aviso, lancamento, pergunta, motivo }) => ({ id, tipo, estado, aviso, lancamento, pergunta, motivo })), null, 1));
})();
