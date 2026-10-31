// Teto de mensagens por cliente por mês, contado aqui, antes de chamar o modelo.
// Regra: 2 mensagens por lançamento do plano (80 no Essencial, 250 no Completo), porque a mesma mensagem pode gerar 0, 1 ou vários
// lançamentos e a pendência pede resposta. Acima disso a mensagem vai para a fila do Tiago, à mão, e o cliente aparece como plano errado.
const { armazemEmMemoria } = require("./armazem");

const TETOS = { Essencial: 160, Completo: 500 };

const chaveDeUso = (cliente, mes) => `uso:${cliente}:${mes}`;
const chaveDeCusto = (cliente, mes) => `custo:${cliente}:${mes}`;
const USOS = "uso:chaves"; // quais pares cliente+mês já têm contagem, para a Denise ler sem varrer o armazém

// O contador usa o armazém: em memória por instância, ou no Redis quando o ambiente traz as variáveis (ver README).
function criarContador({ armazem = armazemEmMemoria() } = {}) {
  return {
    armazem: armazem.nome,
    // Conta antes de responder; se passou, devolve a contagem e a mensagem não gasta uso.
    async tentar(cliente, mes, teto) {
      const n = await armazem.incr(chaveDeUso(cliente, mes));
      if (n > teto) { await armazem.decr(chaveDeUso(cliente, mes)); return { permitido: false, usadas: n - 1 }; }
      if (n === 1) await armazem.sadd(USOS, `${cliente}|${mes}`);
      return { permitido: true, usadas: n };
    },
    // O que a mensagem custou, em reais, dos tokens que o provedor devolveu. É a base do que a Denise lê.
    async registrarCusto(cliente, mes, brl) {
      await armazem.incrbyfloat(chaveDeCusto(cliente, mes), brl);
    },
    // Uso e custo de cada cliente no mês, como estão guardados.
    async usoDoMes(mes) {
      const pares = (await armazem.smembers(USOS)).map((p) => p.split("|")).filter(([, m]) => m === mes);
      const usos = await armazem.mget(pares.map(([c, m]) => chaveDeUso(c, m)));
      const custos = await armazem.mget(pares.map(([c, m]) => chaveDeCusto(c, m)));
      return pares.map(([cliente], i) => ({ cliente, usadas: Number(usos[i] ?? 0), custo_brl: Number(custos[i] ?? 0) }));
    },
  };
}

const mesDe = (data) => new Date(data).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7);

module.exports = { TETOS, criarContador, mesDe };
