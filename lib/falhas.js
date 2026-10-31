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
      if (e instanceof FalhaDoModelo) e.tentativas = i + 1; // quantas vezes foi ao provedor, para a fila mostrar
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

// O que o Tiago faz com cada motivo; aparece no item da fila. Nenhum deles manda tentar de novo sozinho: quem decide é a pessoa.
const O_QUE_FAZER = {
  limite_do_provedor: "O provedor pediu para esperar e não liberou. Lance esta mensagem à mão, ou deixe para tentar de novo mais tarde.",
  resposta_cortada: "A resposta do modelo veio cortada. Lance à mão; se a mensagem for longa, peça ao cliente para mandar em partes.",
  bloqueada_pelo_provedor: "O provedor bloqueou a resposta. Lance à mão; repetir não ajuda.",
  pedido_recusado: "O provedor recusou o pedido (chave, modelo ou formato). Avise quem cuida do sistema; enquanto isso, lance à mão.",
  resposta_ilegivel: "O modelo respondeu algo que o sistema não conseguiu ler. Lance à mão.",
  validacao: "O que o modelo devolveu não passou na conferência. Lance à mão e confira a categoria, o valor e a data.",
  teto_do_plano: "O cliente passou do limite de mensagens do plano. Lance à mão e fale com a Denise sobre o plano.",
  erro_no_modelo: "Erro ao falar com o modelo. Lance à mão e avise quem cuida do sistema.",
};

module.exports = { FalhaDoModelo, comEspera, MOTIVO_DA_FALHA, O_QUE_FAZER };
