// O arquivo que o sistema da casa importa: uma linha por lançamento aprovado, dez colunas, só o que uma pessoa conferiu.
const test = require("node:test");
const assert = require("node:assert/strict");
const { criarFila } = require("../lib/fila");
const { tratarExportar } = require("../lib/rota");
const { paraCsv, COLUNAS } = require("../lib/exportar");

const ENV = { CHAVE_TIAGO: "chave-de-teste-do-tiago-0001", CHAVE_ALINE: "chave-de-teste-da-aline-0002", CHAVE_DENISE: "chave-de-teste-da-denise-003" };
const L = { data: "2026-10-13", tipo: "despesa", categoria: "2.3", valor: 2500, forma: "pix", contraparte: "Seu Osvaldo", descricao: "Aluguel", data_assumida: true };
const novo = (fila, cliente_id, extra = {}, l = {}) => fila.adicionar({ cliente_id, mensagem_id: "M01", tipo: "lancamento", aviso: true, mensagem: "x", recebida_em: "2026-10-13T09:00:00-03:00", lancamento: { ...L, ...l }, ...extra });

async function chamar(fila, { metodo = "GET", url = "/api/exportar", chave } = {}) {
  const req = { method: metodo, url, headers: chave ? { authorization: `Bearer ${chave}` } : {} };
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(t) { this.texto = t; } };
  await tratarExportar(req, res, { filaDeTrabalho: fila, env: ENV });
  return { status: res.statusCode, texto: res.texto, headers: res.headers };
}
const linhas = (r) => r.texto.split("\n").filter(Boolean);

test("o cabeçalho tem as dez colunas do material, na ordem, separadas por ponto e vírgula", () => {
  assert.equal(COLUNAS.join(";"), "cliente_id;data;tipo;categoria;valor;forma;contraparte;descricao;origem;aprovado_por");
  assert.equal(paraCsv([]).split("\n")[0], COLUNAS.join(";"));
});

test("uma linha por lançamento aprovado: valor com duas casas e ponto, origem e quem aprovou, e nada de aviso nem data assumida", async () => {
  const fila = criarFila();
  const id = await novo(fila, "C-0417");
  await fila.aprovar(id, "tiago");
  const r = await chamar(fila, { chave: ENV.CHAVE_TIAGO });
  assert.equal(r.status, 200);
  assert.match(r.headers["content-type"], /text\/csv/);
  assert.deepEqual(linhas(r), [COLUNAS.join(";"), "C-0417;2026-10-13;despesa;2.3;2500.00;pix;Seu Osvaldo;Aluguel;M01;tiago"]);
  assert.doesNotMatch(r.texto, /aviso|assumida|pendencia/);
});

test("corrigido entra com o valor corrigido e quem corrigiu como aprovado_por; aguardando, pendência e não entendido ficam de fora", async () => {
  const fila = criarFila();
  const a = await novo(fila, "C-0417"), b = await novo(fila, "C-0417", { mensagem_id: "M02" }), c = await novo(fila, "C-0417");
  await novo(fila, "C-0417", { tipo: "pendencia", pergunta: "quanto?", lancamento: undefined });
  await novo(fila, "C-0417", { tipo: "nao_entendido", lancamento: undefined });
  await fila.aprovar(a, "tiago");
  await fila.corrigir(b, { valor: 99.9 }, "denise");
  const r = await chamar(fila, { chave: ENV.CHAVE_DENISE });
  assert.equal(linhas(r).length, 3, "cabeçalho e duas linhas; o item c ainda aguarda");
  assert.match(r.texto, /;99\.90;pix;.*;M02;denise/);
  assert.equal((await fila.obter(c)).estado, "aguardando");
});

test("estorno vai com o sinal negativo, e valor com centavos quebrados sai com duas casas", () => {
  const csv = paraCsv([
    { cliente_id: "C-0417", mensagem_id: "M1", resolvido_por: "tiago", lancamento: { ...L, categoria: "1.4", tipo: "receita", valor: -30 } },
    { cliente_id: "C-0417", mensagem_id: "M2", resolvido_por: "tiago", lancamento: { ...L, valor: 1166.67 } },
    { cliente_id: "C-0417", mensagem_id: "M3", resolvido_por: "tiago", lancamento: { ...L, valor: 5.5 } },
  ]);
  const v = csv.split("\n").slice(1, 4).map((l) => l.split(";")[4]);
  assert.deepEqual(v, ["-30.00", "1166.67", "5.50"]);
});

test("texto que o cliente escreveu não quebra a linha nem vira fórmula, e a descrição respeita 80 caracteres", () => {
  const item = (descricao, contraparte = "") => ({ cliente_id: "C-0417", mensagem_id: null, resolvido_por: "aline", lancamento: { ...L, descricao, contraparte } });
  const csv = paraCsv([item("pix; do Marcão\ncom \"aspas\""), item("=HIPERLINK(\"http://x\")"), item("ok", "+55 19 9999"), item("a".repeat(120))]);
  const corpo = csv.split("\n").slice(1).filter(Boolean);
  assert.equal(corpo.length, 4, "nenhuma quebra de linha de dentro do texto virou linha nova");
  assert.match(corpo[0], /"pix; do Marcão com ""aspas"""/);
  assert.match(corpo[1], /;"'=HIPERLINK\(""http:\/\/x""\)";/, "começar com = vira texto, não fórmula; as aspas de dentro são dobradas");
  assert.match(corpo[2], /;'\+55 19 9999;/);
  assert.equal(corpo[3].split(";")[7].length, 80);
  assert.equal(corpo[3].split(";")[8], "", "origem vazia quando a mensagem não tinha identificador");
});

test("cada um exporta só os clientes dele, a Denise todos, e sem chave é 401", async () => {
  const fila = criarFila();
  for (const c of ["C-0417", "C-0288", "C-0533", "C-0601"]) await fila.aprovar(await novo(fila, c), "denise");
  const cods = (r) => linhas(r).slice(1).map((l) => l.split(";")[0]).sort();
  assert.deepEqual(cods(await chamar(fila, { chave: ENV.CHAVE_TIAGO })), ["C-0288", "C-0417"]);
  assert.deepEqual(cods(await chamar(fila, { chave: ENV.CHAVE_ALINE })), ["C-0533", "C-0601"]);
  assert.equal(cods(await chamar(fila, { chave: ENV.CHAVE_DENISE })).length, 4);
  assert.equal((await chamar(fila, {})).status, 401);
  assert.equal((await chamar(fila, { chave: "errada" })).status, 401);
});

test("GET não muda nada; POST entrega só o que ainda não saiu e marca, então o arquivo seguinte não repete linha", async () => {
  const fila = criarFila();
  const a = await novo(fila, "C-0417");
  await fila.aprovar(a, "tiago");
  assert.equal(linhas(await chamar(fila, { chave: ENV.CHAVE_TIAGO })).length, 2);
  assert.equal(linhas(await chamar(fila, { chave: ENV.CHAVE_TIAGO })).length, 2, "GET repete: é só olhar");
  const primeiro = await chamar(fila, { metodo: "POST", chave: ENV.CHAVE_TIAGO });
  assert.equal(linhas(primeiro).length, 2);
  assert.ok((await fila.obter(a)).exportado_em, "o item guarda quando saiu");
  const segundo = await chamar(fila, { metodo: "POST", chave: ENV.CHAVE_TIAGO });
  assert.deepEqual(linhas(segundo), [COLUNAS.join(";")], "nada novo: só o cabeçalho");
  assert.equal(linhas(await chamar(fila, { url: "/api/exportar?novos=1", chave: ENV.CHAVE_TIAGO })).length, 1);
  assert.equal(linhas(await chamar(fila, { chave: ENV.CHAVE_TIAGO })).length, 2, "o arquivo completo continua disponível");
});
