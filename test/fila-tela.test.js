const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { criarFila } = require("../lib/fila");
const { lancar } = require("../lib/lancador");
const { FalhaDoModelo, MOTIVO_DA_FALHA, O_QUE_FAZER } = require("../lib/falhas");

const corpo = { cliente_id: "C-0417", mensagem: "paguei 380 de luz pelo pix", recebida_em: "2026-10-14T10:00:00-03:00", mensagem_id: "M70" };
const falhando = (tipo) => async () => { throw new FalhaDoModelo(tipo, "x"); };
const rodar = async (chamarModelo) => { const fila = criarFila(); await lancar(corpo, { chamarModelo, fila, esperar: async () => {} }); return fila.listar()[0]; };

test("429 que não passa: o item diz quantas vezes tentou e o que o Tiago faz", async () => {
  const i = await rodar(falhando("transitoria"));
  assert.equal(i.motivo, "limite_do_provedor");
  assert.equal(i.tentativas, 3);
  assert.equal(i.o_que_fazer, O_QUE_FAZER.limite_do_provedor);
});

test("falha que não se repete: tentou uma vez só, e também diz o que fazer", async () => {
  for (const tipo of ["cortada", "bloqueada", "recusada", "vazia"]) {
    const i = await rodar(falhando(tipo));
    assert.equal(i.tentativas, 1, tipo);
    assert.equal(i.o_que_fazer, O_QUE_FAZER[MOTIVO_DA_FALHA[tipo]], tipo);
  }
});

test("todo motivo que a fila pode ter traz uma orientação", () => {
  for (const m of [...Object.values(MOTIVO_DA_FALHA), "validacao", "teto_do_plano", "erro_no_modelo"]) assert.ok(O_QUE_FAZER[m], m);
});

test("a tela mostra a data assumida junto da data e a orientação do item", () => {
  const pagina = fs.readFileSync(path.join(__dirname, "..", "public", "fila.html"), "utf8");
  assert.match(pagina, /data_assumida \? .*assumida/);
  assert.match(pagina, /o_que_fazer/);
  assert.match(pagina, /tentativas/);
});
