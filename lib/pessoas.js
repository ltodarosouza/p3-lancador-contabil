// Quem é a pessoa que está usando a fila, e quais clientes ela pode ver. A identidade vem de uma chave por pessoa guardada no ambiente
// do servidor (CHAVE_TIAGO, CHAVE_ALINE, CHAVE_DENISE), nunca de um campo que a requisição preenche. A tabela de quem cuida de quem
// é a coluna "Quem cuida" do material, em dados/clientes.json; a Denise vê tudo.
const crypto = require("crypto");
const { clientes } = require("./lancador");

const PESSOAS = ["tiago", "aline", "denise"];
const TAMANHO_MINIMO = 16;

const resumo = (t) => crypto.createHash("sha256").update(String(t)).digest();

// Só vale a chave que existe, é texto e tem o tamanho mínimo. Falta uma das três: a fila não abre para ninguém.
function chavesDoAmbiente(env) {
  const chaves = PESSOAS.map((id) => [id, env[`CHAVE_${id.toUpperCase()}`]]);
  if (!chaves.every(([, c]) => typeof c === "string" && c.length >= TAMANHO_MINIMO)) return null;
  return chaves;
}

// Devolve { pessoa } ou { erro: "fila_sem_chaves" | "nao_autenticado" }. Compara os resumos, sem parar no primeiro caractere diferente.
function autenticar(req, env = process.env) {
  const chaves = chavesDoAmbiente(env);
  if (!chaves) return { erro: "fila_sem_chaves" };
  const cabecalho = req.headers?.authorization;
  const dada = typeof cabecalho === "string" && cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : "";
  let achada = null;
  for (const [id, chave] of chaves) if (crypto.timingSafeEqual(resumo(dada), resumo(chave)) && dada) achada = id;
  return achada ? { pessoa: achada } : { erro: "nao_autenticado" };
}

// Os códigos de cliente que a pessoa pode ver. A Denise vê todos.
const clientesDe = (pessoa) => clientes.filter((c) => pessoa === "denise" || c.cuida === pessoa).map((c) => c.codigo);

module.exports = { autenticar, clientesDe, PESSOAS, TAMANHO_MINIMO };
