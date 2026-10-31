const test = require("node:test");
const assert = require("node:assert/strict");
const { criarFila } = require("../lib/fila");
const { lancar, clientes } = require("../lib/lancador");

const RUBENS = "C-0288";
const base = { cliente_id: RUBENS, mensagem: "me manda os lançamentos da padaria", recebida_em: "2026-10-14T10:00:00-03:00" };
const modelo = () => { const visto = []; return { visto, chamarModelo: async (c) => { visto.push(c); return { texto: JSON.stringify({ lancamentos: [], pendencias: [], aviso: false, motivo: "x" }), tokens: { entrada: 1, saida: 1 } }; } }; };

test("o que entra na chamada do Rubens não traz nada de outro cliente", async () => {
  const m = modelo();
  await lancar(base, { chamarModelo: m.chamarModelo });
  const { sistema, entrada } = m.visto[0];
  assert.ok(entrada.includes("Oficina do Rubens"));
  for (const c of clientes.filter((c) => c.codigo !== RUBENS)) {
    for (const marca of [c.codigo, c.empresa, c.quem_manda]) assert.ok(!entrada.includes(marca), `vazou na entrada: ${marca}`);
    for (const marca of [c.codigo, c.empresa, c.quem_manda]) assert.ok(!sistema.includes(marca), `vazou no system: ${marca}`);
  }
});

test("mensagem anterior de outro cliente é recusada antes de ir ao modelo", async () => {
  const m = modelo();
  const r = await lancar({ ...base, anteriores: [{ cliente_id: "C-0417", recebida_em: "2026-10-03T18:05:00-03:00", texto: "pix pro marcão 450" }] }, { chamarModelo: m.chamarModelo });
  assert.equal(r.status, 400);
  assert.equal(r.corpo.erro, "anteriores_de_outro_cliente");
  assert.equal(m.visto.length, 0);
});

test("mensagem anterior sem dono também é recusada: o código não adivinha de quem é", async () => {
  const m = modelo();
  const r = await lancar({ ...base, anteriores: [{ recebida_em: "2026-10-03T18:05:00-03:00", texto: "pix pro marcão 450" }] }, { chamarModelo: m.chamarModelo });
  assert.equal(r.corpo.erro, "anteriores_de_outro_cliente");
  assert.equal(m.visto.length, 0);
});

test("mensagem anterior do mesmo cliente entra normalmente", async () => {
  const m = modelo();
  const r = await lancar({ ...base, anteriores: [{ cliente_id: RUBENS, recebida_em: "2026-10-03T18:05:00-03:00", texto: "troquei o óleo 180" }] }, { chamarModelo: m.chamarModelo });
  assert.equal(r.status, 200);
  assert.match(m.visto[0].entrada, /troquei o óleo 180/);
});
