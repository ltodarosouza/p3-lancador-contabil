const test = require("node:test");
const assert = require("node:assert/strict");
const { lancar } = require("../lib/lancador");
const { criarContador, TETOS } = require("../lib/teto");
const { custoBrl } = require("../lib/custo");

const OK = { texto: JSON.stringify({ lancamentos: [], pendencias: [], aviso: false, motivo: "regra 3, valor 3500,01 do Nilton" }), tokens: { entrada: 1666, saida: 70 } };
const AGORA = () => new Date("2026-10-30T20:00:00-03:00");
const msg = (cliente_id, extra = {}) => ({ cliente_id, mensagem: "pix pro marcão 450 SEGREDO-DO-CLIENTE", recebida_em: "2026-10-03T18:05:00-03:00", mensagem_id: "M03", ...extra });

function ambiente() {
  const chamadas = [], linhas = [];
  return { chamadas, linhas, deps: { chamarModelo: async (a) => { chamadas.push(a); return OK; }, contador: criarContador(), agora: AGORA, log: (l) => linhas.push(l) } };
}

test("passou do teto do plano: o modelo não é chamado e a mensagem vai para a fila manual", async () => {
  const { chamadas, deps } = ambiente();
  for (let i = 0; i < TETOS.Essencial; i++) assert.equal((await lancar(msg("C-0288"), deps)).status, 200);
  assert.equal(chamadas.length, TETOS.Essencial);
  const r = await lancar(msg("C-0288"), deps);
  assert.equal(r.status, 429);
  assert.deepEqual(r.corpo, { encaminhar: "fila_manual", motivo: "teto_do_plano", plano: "Essencial", teto: TETOS.Essencial, usadas: TETOS.Essencial });
  assert.equal(chamadas.length, TETOS.Essencial, "a chamada acima do teto não chegou ao modelo");
});

test("um cliente que estourou o teto não atrapalha os outros", async () => {
  const { chamadas, deps } = ambiente();
  for (let i = 0; i < TETOS.Essencial + 20; i++) await lancar(msg("C-0288"), deps);
  const antes = chamadas.length;
  assert.equal((await lancar(msg("C-0417"), deps)).status, 200, "o Nilton (Completo) segue atendido");
  assert.equal((await lancar(msg("C-0533"), deps)).status, 200, "a Camila (Essencial) segue atendida");
  assert.equal(chamadas.length, antes + 2);
});

test("o teto é do plano: o Completo aguenta mais que o Essencial, e o mês seguinte zera", async () => {
  assert.ok(TETOS.Completo > TETOS.Essencial);
  const c = criarContador();
  for (let i = 0; i < 3; i++) assert.equal(c.tentar("C-1", "2026-10", 3).permitido, true);
  assert.equal(c.tentar("C-1", "2026-10", 3).permitido, false);
  assert.equal(c.tentar("C-1", "2026-11", 3).permitido, true, "outro mês, outra conta");
});

test("o teto conta pelo relógio do servidor, não pela data que a requisição diz", async () => {
  const { deps } = ambiente();
  for (let i = 0; i < TETOS.Essencial; i++) await lancar(msg("C-0288", { recebida_em: `2026-0${(i % 9) + 1}-10T10:00:00-03:00` }), deps);
  assert.equal((await lancar(msg("C-0288", { recebida_em: "2025-01-05T10:00:00-03:00" }), deps)).status, 429);
});

test("o log tem uma linha por chamada, com custo e preço, e nunca o texto, o motivo nem o lançamento", async () => {
  const { linhas, deps } = ambiente();
  await lancar(msg("C-0417"), deps);
  assert.equal(linhas.length, 1);
  const l = linhas[0];
  assert.equal(l.mensagem_id, "M03");
  assert.equal(l.cliente_id, "C-0417");
  assert.equal(l.status, "ok");
  assert.equal(l.tokens_entrada, 1666);
  assert.equal(l.tokens_saida, 70);
  assert.equal(l.custo_brl, 0.003658);
  assert.equal(l.cambio_brl, 5.4212);
  assert.equal(l.data_preco, "2026-10-28");
  assert.equal(l.resultado, "nada");
  const texto = JSON.stringify(linhas);
  assert.doesNotMatch(texto, /SEGREDO-DO-CLIENTE|marcão|Nilton|3500|regra 3/, "o log não carrega dado do cliente nem do modelo");
});

test("o log também registra o teto e o erro do modelo, sem texto", async () => {
  const { linhas, deps } = ambiente();
  for (let i = 0; i < TETOS.Essencial + 1; i++) await lancar(msg("C-0288"), deps);
  assert.equal(linhas.at(-1).status, "teto");
  assert.equal(linhas.at(-1).teto, TETOS.Essencial);
  const caiu = { ...deps, contador: criarContador(), chamarModelo: async () => { throw new Error("falhou SEGREDO-DO-CLIENTE"); } };
  await lancar(msg("C-0417"), caiu);
  assert.equal(linhas.at(-1).status, "erro_modelo");
  assert.doesNotMatch(JSON.stringify(linhas.at(-1)), /SEGREDO/);
});

test("mensagem_id inválido é recusado", async () => {
  const { chamadas, deps } = ambiente();
  for (const ruim of ["", "x".repeat(41), 7]) assert.equal((await lancar(msg("C-0417", { mensagem_id: ruim }), deps)).status, 400);
  assert.equal(chamadas.length, 0);
});

test("a conta do custo bate com a medida da primeira chamada: 1.666 de entrada e 70 de saída dão R$ 0,003658", () => {
  const { usd, brl } = custoBrl({ entrada: 1666, saida: 70 });
  assert.ok(Math.abs(usd - 0.0006748) < 1e-9);
  assert.ok(Math.abs(brl - 0.003658) < 1e-6);
});
