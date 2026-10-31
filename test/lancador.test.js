const test = require("node:test");
const assert = require("node:assert/strict");
const { lancar, MAX_ANTERIORES } = require("../lib/lancador");
const { tratar } = require("../lib/rota");

const CHAVE_FALSA = "chave-falsa-so-para-teste-123";
const OK = { texto: JSON.stringify({ lancamentos: [], pendencias: [], aviso: false, motivo: "regra 3" }), tokens: { entrada: 1666, saida: 70 } };
const base = { cliente_id: "C-0417", mensagem: "comprei uma geladeira 3x de 1.166,67 primeira parcela cai dia 20", recebida_em: "2026-10-13T16:22:00-03:00" };

function modeloFalso(resposta = OK) {
  const chamadas = [];
  const fn = async (arg) => { chamadas.push(arg); if (resposta instanceof Error) throw resposta; return resposta; };
  fn.chamadas = chamadas;
  return fn;
}

test("cliente que não está na tabela é recusado e o modelo nem é chamado", async () => {
  const m = modeloFalso();
  const r = await lancar({ ...base, cliente_id: "C-9999" }, { chamarModelo: m });
  assert.equal(r.status, 422);
  assert.equal(r.corpo.erro, "cliente_desconhecido");
  assert.equal(m.chamadas.length, 0);
});

test("o plano e a empresa saem da tabela, não do que a requisição diz", async () => {
  const m = modeloFalso();
  await lancar({ ...base, plano: "Essencial", empresa: "Outra Empresa" }, { chamarModelo: m });
  assert.match(m.chamadas[0].entrada, /plano Completo/);
  assert.match(m.chamadas[0].entrada, /Padaria Sabor de Trigo/);
  assert.doesNotMatch(m.chamadas[0].entrada, /Essencial|Outra Empresa/);
});

test("mensagem vazia, longa demais ou sem data é recusada antes do modelo", async () => {
  for (const ruim of [{ mensagem: "   " }, { mensagem: "x".repeat(1001) }, { mensagem: 42 }, { recebida_em: "ontem" }, { recebida_em: undefined }]) {
    const m = modeloFalso();
    const r = await lancar({ ...base, ...ruim }, { chamarModelo: m });
    assert.equal(r.status, 400, JSON.stringify(ruim).slice(0, 40));
    assert.equal(m.chamadas.length, 0);
  }
});

test("mensagens anteriores entram como contexto, e mais de cinco são recusadas", async () => {
  const m = modeloFalso();
  const anteriores = [{ cliente_id: base.cliente_id, recebida_em: "2026-10-03T18:05:00-03:00", texto: "pix pro marcão 450" }];
  const r = await lancar({ ...base, mensagem: "e o da semana passada, quanto foi?", anteriores }, { chamarModelo: m });
  assert.equal(r.status, 200);
  assert.match(m.chamadas[0].entrada, /pix pro marcão 450/);
  const muitas = Array.from({ length: MAX_ANTERIORES + 1 }, () => anteriores[0]);
  assert.equal((await lancar({ ...base, anteriores: muitas }, { chamarModelo: modeloFalso() })).status, 400);
});

test("resposta boa devolve lançamentos, pendências, aviso, motivo e a contagem de tokens", async () => {
  const r = await lancar(base, { chamarModelo: modeloFalso() });
  assert.equal(r.status, 200);
  assert.deepEqual(r.corpo, { resultado: "nada", lancamentos: [], pendencias: [], aviso: false, motivo: "regra 3", tokens: { entrada: 1666, saida: 70 } });
});

test("modelo fora do ar ou resposta que não é JSON: a mensagem vai para a fila como não entendido, sem despejar o erro", async () => {
  const caiu = await lancar(base, { chamarModelo: modeloFalso(new Error(`falhou com ${CHAVE_FALSA}`)) });
  assert.equal(caiu.status, 200);
  assert.equal(caiu.corpo.resultado, "nao_entendido");
  assert.equal(caiu.corpo.nao_entendido.motivo, "erro_no_modelo");
  assert.doesNotMatch(JSON.stringify(caiu.corpo), new RegExp(CHAVE_FALSA));
  const torto = await lancar(base, { chamarModelo: modeloFalso({ texto: "não sou json", tokens: {} }) });
  assert.equal(torto.corpo.resultado, "nao_entendido");
  assert.equal(torto.corpo.nao_entendido.motivo, "resposta_ilegivel");
});

// A rota inteira, com a rede trocada por uma função falsa: a chave vai no cabeçalho e não volta em nenhuma resposta.
function reqRes(corpo, metodo = "POST") {
  const res = { statusCode: 0, headers: {}, texto: "", setHeader(k, v) { this.headers[k] = v; }, end(t) { this.texto = t; } };
  return { req: { method: metodo, body: corpo }, res };
}

test("a rota usa a chave do ambiente só no cabeçalho e nunca a devolve", async () => {
  let visto;
  const fetchImpl = async (url, opcoes) => {
    visto = { url, cabecalho: opcoes.headers["x-goog-api-key"] };
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: OK.texto }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 2 } }) };
  };
  const { req, res } = reqRes(base);
  await tratar(req, res, { env: { GEMINI_API_KEY: CHAVE_FALSA, GEMINI_MODEL: "modelo-x" }, fetchImpl });
  assert.equal(res.statusCode, 200);
  assert.equal(visto.cabecalho, CHAVE_FALSA);
  assert.doesNotMatch(visto.url, new RegExp(CHAVE_FALSA), "a chave não vai na URL");
  assert.doesNotMatch(res.texto, new RegExp(CHAVE_FALSA), "a chave não volta na resposta");
});

test("sem chave no ambiente a rota responde 503 e não tenta chamar o modelo", async () => {
  let chamou = false;
  const { req, res } = reqRes(base);
  await tratar(req, res, { env: {}, fetchImpl: async () => { chamou = true; } });
  assert.equal(res.statusCode, 503);
  assert.equal(JSON.parse(res.texto).erro, "modelo_nao_configurado");
  assert.equal(chamou, false);
});

test("só POST é aceito", async () => {
  const { req, res } = reqRes(undefined, "GET");
  await tratar(req, res, { env: {} });
  assert.equal(res.statusCode, 405);
});

test("a chave não está escrita em nenhum arquivo do projeto que vai para o git", () => {
  const { execSync } = require("child_process");
  const dir = require("path").join(__dirname, "..");
  const arquivos = execSync("git ls-files --cached --others --exclude-standard", { cwd: dir, encoding: "utf8" }).split("\n").filter(Boolean);
  const fs = require("fs");
  for (const f of arquivos) {
    const t = fs.readFileSync(require("path").join(dir, f), "utf8");
    assert.doesNotMatch(t, /AIza[0-9A-Za-z_-]{30,}/, `${f} parece conter uma chave do Google`);
  }
});
