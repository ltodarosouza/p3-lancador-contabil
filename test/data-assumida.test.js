const test = require("node:test");
const assert = require("node:assert/strict");
const { criarFila } = require("../lib/fila");
const { lancar } = require("../lib/lancador");
const { trazData } = require("../lib/data-na-mensagem");

const LANC = { data: "2026-10-14", tipo: "despesa", categoria: "2.4", valor: 380, forma: "pix", contraparte: "", descricao: "Luz", data_assumida: false };
const rodar = async (mensagem, lancamento = LANC) => {
  const fila = criarFila();
  const r = await lancar(
    { cliente_id: "C-0417", mensagem, recebida_em: "2026-10-14T10:00:00-03:00", mensagem_id: "M60" },
    { chamarModelo: async () => ({ texto: JSON.stringify({ lancamentos: [lancamento], pendencias: [], aviso: false, motivo: "x" }), tokens: { entrada: 1, saida: 1 } }), fila },
  );
  return { r, item: (await fila.listar())[0] };
};

test("mensagem sem data: o código marca data_assumida, mesmo com o modelo devolvendo false", async () => {
  const { r, item } = await rodar("paguei 380 de luz pelo pix");
  assert.equal(r.corpo.lancamentos[0].data_assumida, true);
  assert.equal(item.lancamento.data_assumida, true);
});

test("mensagem que traz a data: não marca, mesmo com o modelo devolvendo true", async () => {
  const { r } = await rodar("paguei 380 de luz ontem pelo pix", { ...LANC, data: "2026-10-13", data_assumida: true });
  assert.equal(r.corpo.lancamentos[0].data_assumida, false);
});

test("o que conta como data na mensagem", () => {
  for (const t of ["pago dia 20", "paguei 13/10", "venceu em 05/10/2026", "ontem 250", "anteontem 80", "hoje 90", "abasteci sábado", "na segunda paguei", "semana passada 300", "dia 3 de outubro"]) assert.equal(trazData(t), true, t);
  for (const t of ["paguei 380 de luz pelo pix", "recebi 6200 do buffet da escola no pix", "pix pro marcão 450", "comprei 3x de 1.166,67 no cartão"]) assert.equal(trazData(t), false, t);
});
