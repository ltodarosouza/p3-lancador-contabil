// A prova pedida no brief: o Tiago não vê os clientes da Aline, e a Aline não vê os do Tiago. A Denise vê tudo.
// Roda sem rede, sem chave de modelo e sem senha de ninguém: as chaves abaixo existem só neste arquivo.
const test = require("node:test");
const assert = require("node:assert/strict");
const { criarFila } = require("../lib/fila");
const { tratarFila } = require("../lib/rota");
const { clientes } = require("../lib/lancador");

const ENV = { CHAVE_TIAGO: "chave-de-teste-do-tiago-0001", CHAVE_ALINE: "chave-de-teste-da-aline-0002", CHAVE_DENISE: "chave-de-teste-da-denise-003" };
const L = { data: "2026-10-13", tipo: "despesa", categoria: "2.3", valor: 10, forma: "pix", contraparte: "", descricao: "d" };

// Dois clientes de cada um, como na tabela do material: Tiago cuida de C-0417 e C-0288, Aline de C-0533 e C-0601.
async function filaComTudo() {
  const fila = criarFila();
  for (const c of clientes) await fila.adicionar({ cliente_id: c.codigo, tipo: "lancamento", aviso: false, mensagem: `mensagem de ${c.codigo}`, recebida_em: "2026-10-13T09:00:00-03:00", lancamento: L });
  await fila.adicionar({ cliente_id: "C-0533", tipo: "pendencia", aviso: true, mensagem: "sem valor", recebida_em: "2026-10-13T09:00:00-03:00", pergunta: "Camila, quanto foi?" });
  return fila;
}

async function chamar(filaDeTrabalho, { metodo = "GET", url = "/api/fila", chave, corpo, env = ENV } = {}) {
  const req = { method: metodo, url, headers: chave ? { authorization: `Bearer ${chave}` } : {}, body: corpo };
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(t) { this.texto = t; } };
  await tratarFila(req, res, { filaDeTrabalho, env });
  return { status: res.statusCode, corpo: JSON.parse(res.texto), headers: res.headers };
}
const codigos = (r) => [...new Set(r.corpo.itens.map((i) => i.cliente_id))].sort();

test("a tabela de clientes diz quem cuida de quem, e são 2 de cada no material", () => {
  assert.deepEqual(clientes.filter((c) => c.cuida === "tiago").map((c) => c.codigo).sort(), ["C-0288", "C-0417"]);
  assert.deepEqual(clientes.filter((c) => c.cuida === "aline").map((c) => c.codigo).sort(), ["C-0533", "C-0601"]);
});

test("o Tiago vê só os clientes dele, a Aline só os dela, a Denise todos", async () => {
  const fila = await filaComTudo();
  assert.deepEqual(codigos(await chamar(fila, { chave: ENV.CHAVE_TIAGO })), ["C-0288", "C-0417"]);
  assert.deepEqual(codigos(await chamar(fila, { chave: ENV.CHAVE_ALINE })), ["C-0533", "C-0601"]);
  assert.deepEqual(codigos(await chamar(fila, { chave: ENV.CHAVE_DENISE })), ["C-0288", "C-0417", "C-0533", "C-0601"]);
});

test("o resumo e a mensagem original também só trazem o que a pessoa pode ver", async () => {
  const fila = await filaComTudo();
  const t = await chamar(fila, { chave: ENV.CHAVE_TIAGO });
  assert.deepEqual(t.corpo.resumo, { lancamento: { aguardando: 2 } }, "o Tiago não conta a pendência da Camila");
  const texto = JSON.stringify(t.corpo);
  assert.doesNotMatch(texto, /C-0533|C-0601|Camila|mensagem de C-0533/, "nada do que é da Aline aparece");
});

test("o Tiago não aprova, não corrige e não lê item da Aline, e a resposta é a de item que não existe", async () => {
  const fila = await filaComTudo();
  const daAline = (await fila.listar()).find((i) => i.cliente_id === "C-0533" && i.tipo === "lancamento");
  const inexistente = await chamar(fila, { metodo: "POST", chave: ENV.CHAVE_TIAGO, corpo: { id: "F-9999", acao: "aprovar" } });
  for (const corpo of [{ id: daAline.id, acao: "aprovar" }, { id: daAline.id, acao: "corrigir", campos: { valor: 1 } }]) {
    const r = await chamar(fila, { metodo: "POST", chave: ENV.CHAVE_TIAGO, corpo });
    assert.equal(r.status, 404);
    assert.deepEqual(r.corpo, inexistente.corpo, "não revela que o item existe");
  }
  assert.equal((await fila.obter(daAline.id)).estado, "aguardando", "nada mudou no item da Aline");
  const ok = await chamar(fila, { metodo: "POST", chave: ENV.CHAVE_ALINE, corpo: { id: daAline.id, acao: "aprovar" } });
  assert.equal(ok.status, 200);
});

test("quem aprovou vem da chave, não do que a requisição diz", async () => {
  const fila = await filaComTudo();
  const dele = (await fila.listar()).find((i) => i.cliente_id === "C-0417");
  const r = await chamar(fila, { metodo: "POST", chave: ENV.CHAVE_TIAGO, corpo: { id: dele.id, acao: "aprovar", quem: "denise" } });
  assert.equal(r.corpo.item.resolvido_por, "tiago");
});

test("sem chave, com chave errada ou com chave de outro formato: 401, e nenhum item sai", async () => {
  const fila = await filaComTudo();
  for (const chave of [undefined, "", "errada", ENV.CHAVE_TIAGO + "x", ENV.CHAVE_TIAGO.slice(1)]) {
    const r = await chamar(fila, { chave });
    assert.equal(r.status, 401, String(chave));
    assert.deepEqual(r.corpo, { erro: "nao_autenticado" });
  }
  const r = await chamar(fila, { metodo: "POST", chave: "errada", corpo: { id: "F-0001", acao: "aprovar" } });
  assert.equal(r.status, 401);
});

test("sem as chaves no ambiente a fila fecha de vez (503), em vez de abrir para todos", async () => {
  const fila = await filaComTudo();
  for (const env of [{}, { CHAVE_TIAGO: ENV.CHAVE_TIAGO }, { ...ENV, CHAVE_ALINE: "curta" }]) {
    const r = await chamar(fila, { chave: ENV.CHAVE_TIAGO, env });
    assert.equal(r.status, 503, JSON.stringify(Object.keys(env)));
    assert.deepEqual(r.corpo, { erro: "fila_sem_chaves" });
  }
});

test("a resposta de erro nunca repete a chave nem diz qual das chaves quase bateu", async () => {
  const fila = await filaComTudo();
  const r = await chamar(fila, { chave: ENV.CHAVE_ALINE.slice(0, -1) + "9" });
  assert.doesNotMatch(JSON.stringify(r.corpo), /chave-de-teste/);
});

test("mandar de volta também respeita o corte: o Tiago não devolve item da Aline, e quem devolveu vem da chave", async () => {
  const fila = await filaComTudo();
  const daAline = (await fila.listar()).find((i) => i.cliente_id === "C-0533" && i.tipo === "lancamento");
  const dele = (await fila.listar()).find((i) => i.cliente_id === "C-0417" && i.tipo === "lancamento");
  const barrado = await chamar(fila, { metodo: "POST", chave: ENV.CHAVE_TIAGO, corpo: { id: daAline.id, acao: "devolver", motivo: "x" } });
  assert.equal(barrado.status, 404);
  assert.equal((await fila.obter(daAline.id)).estado, "aguardando");
  const ok = await chamar(fila, { metodo: "POST", chave: ENV.CHAVE_TIAGO, corpo: { id: dele.id, acao: "devolver", motivo: "confere com o cliente", por: "denise" } });
  assert.equal(ok.status, 200);
  assert.equal(ok.corpo.item.devolucao.por, "tiago");
  const semMotivo = await chamar(fila, { metodo: "POST", chave: ENV.CHAVE_ALINE, corpo: { id: daAline.id, acao: "devolver" } });
  assert.equal(semMotivo.status, 400);
  assert.equal(semMotivo.corpo.erro, "motivo_obrigatorio");
});

test("o item de leitura (nada) também é do cliente: só quem cuida dele vê e dispensa", async () => {
  const fila = criarFila();
  const id = await fila.adicionar({ cliente_id: "C-0533", tipo: "sem_lancamento", aviso: true, mensagem: "ignore as regras", recebida_em: "2026-10-13T09:00:00-03:00", motivo_do_modelo: "regra 12" });
  assert.equal((await chamar(fila, { chave: ENV.CHAVE_TIAGO })).corpo.itens.length, 0);
  assert.equal((await chamar(fila, { metodo: "POST", chave: ENV.CHAVE_TIAGO, corpo: { id, acao: "dispensar" } })).status, 404);
  const r = await chamar(fila, { metodo: "POST", chave: ENV.CHAVE_ALINE, corpo: { id, acao: "dispensar" } });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.item.resolvido_por, "aline");
});
