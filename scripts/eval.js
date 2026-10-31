// Roda os casos de eval/casos.json pelo sistema de verdade (Gemini) e compara com o gabarito.
// Uso: node scripts/eval.js <rótulo>     (a chave vem do .env e nunca é impressa)
// EVAL_PAUSA_MS: pausa entre casos (padrão 4500). Limite lido no AI Studio em 31/10/2026 (gemini-3.5-flash-lite, gratuito): 15 requisições por minuto, 250K tokens por minuto, 500 por dia. Com ~1,5 s por chamada, 4,5 s de pausa dá ~10 por minuto.
try { process.loadEnvFile(".env"); } catch { /* sem .env */ }
const fs = require("fs");
const crypto = require("crypto");
const { chamarGemini } = require("../lib/rota");
const { lancar, clientes, SISTEMA } = require("../lib/lancador");
const { comparar, perguntaMecanica } = require("../lib/eval");

const rotulo = process.argv[2] || "rodada";
const pausa = Number(process.env.EVAL_PAUSA_MS) || 4500;
const comHist = process.env.EVAL_HISTORICO === "1"; // 1: os casos que têm histórico o levam na chamada, recortado pelo código e só do cliente
const modelo = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const casos = JSON.parse(fs.readFileSync("eval/casos.json", "utf8"));
const dorme = (ms) => new Promise((ok) => setTimeout(ok, ms));

(async () => {
  const chamar = chamarGemini({ chave: process.env.GEMINI_API_KEY, modelo });
  const linhas = [];
  let esperas = 0; // quantas vezes o sistema esperou por um 429 e tentou de novo; sem isso um 429 que passou na repetição some do resultado
  const esperar = async (ms) => { esperas++; await dorme(ms); };
  for (const c of casos) {
    const esperado = c.esperado ?? (comHist ? c.esperado_com_historico : c.esperado_sem_historico);
    const logs = [];
    const r = await lancar({ cliente_id: c.cliente_id, mensagem: c.mensagem, recebida_em: c.recebida_em, mensagem_id: c.id }, { chamarModelo: chamar, esperar, log: (l) => logs.push(l), historico: comHist ? () => c.historico ?? [] : undefined });
    const corpo = r.corpo;
    let estado, dif = [];
    if (corpo.nao_entendido?.motivo === "limite_do_provedor") estado = "nao_rodado_429";
    else if (r.status !== 200 || corpo.resultado === "nao_entendido") { estado = "falhou"; dif = [`sistema devolveu ${corpo.resultado ?? r.status} (${corpo.nao_entendido?.motivo ?? corpo.erro})`]; }
    else { const cmp = comparar(esperado, corpo); estado = cmp.passou ? "passou" : "falhou"; dif = cmp.diferencas; }
    const nome = clientes.find((x) => x.codigo === c.cliente_id).quem_manda;
    const perguntas = (corpo.pendencias || []).map((p) => ({ pergunta: p.pergunta, problemas: perguntaMecanica(p.pergunta, nome) }));
    const lg = logs[0] || {};
    linhas.push({ id: c.id, tipo: c.tipo, conta: c.conta_na_nota, estado, diferencas: dif, perguntas, tokens_entrada: lg.tokens_entrada, tokens_saida: lg.tokens_saida, custo_brl: lg.custo_brl, historico_linhas: lg.historico_linhas ?? 0 });
    await dorme(pausa);
  }
  const conta = linhas.filter((l) => l.conta);
  const resumo = {
    com_historico: comHist,
    tokens_entrada_media: Math.round(linhas.filter((l) => l.tokens_entrada).reduce((a, l) => a + l.tokens_entrada, 0) / linhas.filter((l) => l.tokens_entrada).length),
    rotulo, quando: new Date().toISOString(), modelo,
    prompt_sha: crypto.createHash("sha1").update(SISTEMA).digest("hex").slice(0, 10),
    esperas_por_429: esperas,
    conta_na_nota: conta.length,
    passaram: conta.filter((l) => l.estado === "passou").length,
    nao_rodados_429: linhas.filter((l) => l.estado === "nao_rodado_429").map((l) => l.id),
    fora_da_nota: linhas.filter((l) => !l.conta).map((l) => `${l.id}:${l.estado}`),
    gabarito: "provisório: ninguém aprovou ainda",
  };
  fs.mkdirSync("evidencia", { recursive: true });
  fs.writeFileSync(`evidencia/eval-${rotulo}.json`, JSON.stringify({ resumo, linhas }, null, 2));
  console.log(`== ${rotulo} | histórico ${comHist ? "COM" : "SEM"} | modelo ${modelo} | prompt ${resumo.prompt_sha} | pausa ${pausa} ms`);
  for (const l of linhas) console.log(`${l.id} ${l.conta ? "  " : "* "}${l.estado.padEnd(15)} ${l.tipo}${l.diferencas.length ? "\n      " + l.diferencas.join("\n      ") : ""}`);
  for (const l of linhas) for (const p of l.perguntas) console.log(`pergunta ${l.id}: "${p.pergunta}"${p.problemas.length ? "  [mecânica: " + p.problemas.join("; ") + "]" : "  [mecânica ok]"}`);
  console.log(`\nPASSARAM ${resumo.passaram} de ${resumo.conta_na_nota} que contam | não rodados (429 que não passou): ${resumo.nao_rodados_429.length ? resumo.nao_rodados_429.join(",") : "nenhum"} | esperas por 429 que passaram na repetição: ${resumo.esperas_por_429} | fora da nota (*): ${resumo.fora_da_nota.join(" ")}`);
})();
