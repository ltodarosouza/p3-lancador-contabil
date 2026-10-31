// As três falhas provocadas da aula 3.5. Rodam sem chave e sem abrir a fila: tudo entra por função falsa.
const test = require("node:test");
const assert = require("node:assert/strict");
const { lancar } = require("../lib/lancador");
const { criarFila } = require("../lib/fila");
const { FalhaDoModelo, comEspera } = require("../lib/falhas");
const { chamarGemini } = require("../lib/rota");

const base = { cliente_id: "C-0417", mensagem: "paguei a luz ontem 1,2k", recebida_em: "2026-10-13T16:22:00-03:00", mensagem_id: "M99" };
const CERTO = { data: "2026-10-12", tipo: "despesa", categoria: "2.4", valor: 1200, forma: "nao_informado", contraparte: "", descricao: "Luz", data_assumida: false };
const resp = (o) => ({ texto: JSON.stringify(o), tokens: { entrada: 1666, saida: 70 } });
const modelo = (...passos) => { const f = async () => { const p = passos.shift() ?? passos.at(-1); if (p instanceof Error) throw p; return p; }; f.chamadas = 0; return async (a) => { f.chamadas++; modelo.ultimo = f; return f(a); }; };

function ambiente(...passos) {
  const fila = criarFila(), esperas = [], contagem = { chamadas: 0 };
  const sequencia = [...passos];
  const chamarModelo = async () => { contagem.chamadas++; const p = sequencia.length > 1 ? sequencia.shift() : sequencia[0]; if (p instanceof Error) throw p; return p; };
  return { fila, esperas, contagem, deps: { chamarModelo, fila, esperar: async (ms) => esperas.push(ms), agora: () => new Date("2026-10-30T20:00:00-03:00") } };
}

// Falha 1: saída inválida entregue direto à validação.
test("falha 1, saída inválida: vai para a fila como não entendido, com a mensagem original e o motivo, e nunca como lançamento", async () => {
  const { fila, contagem, deps } = ambiente(resp({ lancamentos: [{ ...CERTO, categoria: "9.9", tipo: "receita", valor: -5, data: "2026-10-20" }], pendencias: [], aviso: false, motivo: "x" }));
  const r = await lancar(base, deps);
  assert.equal(r.status, 200);
  assert.equal(r.corpo.resultado, "nao_entendido");
  assert.equal(r.corpo.nao_entendido.motivo, "validacao");
  assert.deepEqual(r.corpo.lancamentos, []);
  assert.ok(r.corpo.nao_entendido.detalhes.length >= 3, "categoria, valor e data apontados");
  assert.equal(contagem.chamadas, 1, "o modelo foi chamado uma vez só: não repete o que voltou inteiro e inválido");
  const itens = await fila.listar();
  assert.equal(itens.length, 1);
  assert.equal(itens[0].tipo, "nao_entendido");
  assert.equal(itens[0].mensagem, base.mensagem, "a mensagem original vai junto");
  assert.equal(itens[0].estado, "aguardando");
  assert.equal((await fila.listar({ tipo: "lancamento" })).length, 0, "nenhum lançamento nasceu");
});

// Falha 2: erro 429 simulado.
test("falha 2, 429: espera com tempo crescente e tenta de novo; se passar, segue como se nada", async () => {
  const { fila, esperas, contagem, deps } = ambiente(new FalhaDoModelo("transitoria", "http_429"), new FalhaDoModelo("transitoria", "http_429"), resp({ lancamentos: [CERTO], pendencias: [], aviso: false, motivo: "regra 2" }));
  const r = await lancar(base, deps);
  assert.equal(r.corpo.resultado, "lancou");
  assert.equal(contagem.chamadas, 3);
  assert.equal(esperas.length, 2);
  assert.ok(esperas[1] > esperas[0], "a segunda espera é maior que a primeira");
  assert.equal((await fila.listar({ tipo: "lancamento" })).length, 1);
});

test("falha 2, 429 que não passa: depois de poucas tentativas a mensagem vai para a fila, e não fica repetindo", async () => {
  const { fila, esperas, contagem, deps } = ambiente(new FalhaDoModelo("transitoria", "http_429"));
  const r = await lancar(base, deps);
  assert.equal(r.corpo.nao_entendido.motivo, "limite_do_provedor");
  assert.equal(contagem.chamadas, 3, "três tentativas, não mais");
  assert.equal(esperas.length, 2);
  assert.equal((await fila.listar({ tipo: "nao_entendido" }))[0].mensagem, base.mensagem);
});

// Falha 3: corte pelo limite de saída.
test("falha 3, corte no limite de saída: não repete (cortaria no mesmo ponto) e vai direto para a fila", async () => {
  const { fila, esperas, contagem, deps } = ambiente(new FalhaDoModelo("cortada", "MAX_TOKENS"));
  const r = await lancar(base, deps);
  assert.equal(r.corpo.nao_entendido.motivo, "resposta_cortada");
  assert.equal(contagem.chamadas, 1);
  assert.equal(esperas.length, 0);
  assert.equal((await fila.listar({ tipo: "nao_entendido" })).length, 1);
});

test("só a falha transitória é repetida: bloqueio e pedido recusado vão direto para a fila", async () => {
  for (const [tipo, codigo, motivo] of [["bloqueada", "SAFETY", "bloqueada_pelo_provedor"], ["recusada", "http_400", "pedido_recusado"], ["vazia", "sem_candidato", "resposta_ilegivel"]]) {
    const { contagem, deps } = ambiente(new FalhaDoModelo(tipo, codigo));
    const r = await lancar(base, deps);
    assert.equal(r.corpo.nao_entendido.motivo, motivo, tipo);
    assert.equal(contagem.chamadas, 1, `${tipo} não repete`);
  }
});

test("comEspera: a espera dobra a cada tentativa e para na última", async () => {
  const esperas = []; let n = 0;
  await assert.rejects(comEspera(async () => { n++; throw new FalhaDoModelo("transitoria", "http_503"); }, { tentativas: 4, base: 100, sorteio: () => 0, esperar: async (ms) => esperas.push(ms) }));
  assert.equal(n, 4);
  assert.deepEqual(esperas, [100, 200, 400]);
});

// A camada do Gemini: como a resposta de verdade vira cada tipo de falha.
const gemini = (resposta) => chamarGemini({ chave: "k", modelo: "m", fetchImpl: async () => resposta });
const falhaDe = async (resposta) => { try { await gemini(resposta)({ sistema: "s", entrada: "e" }); } catch (e) { return `${e.tipo}:${e.codigo}`; } return "sem falha"; };

test("camada do Gemini: 429, 5xx e 408 são transitórios; outros 4xx são recusados", async () => {
  assert.equal(await falhaDe({ ok: false, status: 429 }), "transitoria:http_429");
  assert.equal(await falhaDe({ ok: false, status: 503 }), "transitoria:http_503");
  assert.equal(await falhaDe({ ok: false, status: 408 }), "transitoria:http_408");
  assert.equal(await falhaDe({ ok: false, status: 400 }), "recusada:http_400");
  assert.equal(await falhaDe({ ok: false, status: 403 }), "recusada:http_403");
});

test("camada do Gemini: parada por limite, bloqueio e resposta sem candidato", async () => {
  const ok = (extra) => ({ ok: true, json: async () => ({ usageMetadata: {}, ...extra }) });
  assert.equal(await falhaDe(ok({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "{\"lanc" }] } }] })), "cortada:MAX_TOKENS");
  assert.equal(await falhaDe(ok({ candidates: [{ finishReason: "SAFETY" }] })), "bloqueada:SAFETY");
  assert.equal(await falhaDe(ok({ promptFeedback: { blockReason: "PROHIBITED_CONTENT" } })), "bloqueada:PROHIBITED_CONTENT");
  assert.equal(await falhaDe(ok({ candidates: [] })), "vazia:sem_candidato");
  const bom = await gemini(ok({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "{}" }] } }], usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2 } }))({ sistema: "s", entrada: "e" });
  assert.deepEqual(bom, { texto: "{}", tokens: { entrada: 5, saida: 2 } });
});

test("a falha do modelo não carrega o corpo da resposta, que pode ter dado do cliente", () => {
  const e = new FalhaDoModelo("recusada", "http_400");
  assert.equal(e.message, "recusada:http_400");
});
