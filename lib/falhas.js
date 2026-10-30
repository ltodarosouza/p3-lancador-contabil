// As formas de a chamada ao modelo dar errado. O tipo decide o destino: só "transitoria" pode ser repetida.
class FalhaDoModelo extends Error {
  constructor(tipo, codigo) {
    super(`${tipo}:${codigo}`); // só tipo e código, nunca o corpo da resposta, que pode ter dado do cliente
    this.tipo = tipo;           // transitoria (429, 408, 5xx) | cortada (MAX_TOKENS) | bloqueada (promptFeedback ou parada por segurança) | recusada (4xx) | vazia
    this.codigo = codigo;
  }
}

// Espera crescente com um pouco de sorteio, como a documentação do Gemini recomenda para 429 e 5xx. Poucas tentativas, depois desiste.
async function comEspera(fn, { tentativas = 3, base = 1000, esperar = (ms) => new Promise((ok) => setTimeout(ok, ms)), sorteio = Math.random } = {}) {
  for (let i = 0; ; i++) {
    try { return await fn(); }
    catch (e) {
      if (!(e instanceof FalhaDoModelo) || e.tipo !== "transitoria" || i >= tentativas - 1) throw e;
      await esperar(base * 2 ** i + Math.floor(sorteio() * base / 2));
    }
  }
}

const MOTIVO_DA_FALHA = {
  transitoria: "limite_do_provedor",
  cortada: "resposta_cortada",
  bloqueada: "bloqueada_pelo_provedor",
  recusada: "pedido_recusado",
  vazia: "resposta_ilegivel",
};

module.exports = { FalhaDoModelo, comEspera, MOTIVO_DA_FALHA };
