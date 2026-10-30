// Teto de mensagens por cliente por mês, contado aqui, antes de chamar o modelo.
// Regra: 2 mensagens por lançamento do plano (80 no Essencial, 250 no Completo), porque a mesma mensagem pode gerar 0, 1 ou vários
// lançamentos e a pendência pede resposta. Acima disso a mensagem vai para a fila do Tiago, à mão, e o cliente aparece como plano errado.
const TETOS = { Essencial: 160, Completo: 500 };

// Contador em memória: vale por instância da função. Para valer de verdade entre instâncias e reinícios precisa de armazenamento
// (ver README); a interface é a mesma, então trocar não muda o resto.
function criarContador() {
  const usadas = new Map();
  return {
    tentar(cliente, mes, teto) {
      const chave = `${cliente}|${mes}`;
      const ja = usadas.get(chave) || 0;
      if (ja >= teto) return { permitido: false, usadas: ja };
      usadas.set(chave, ja + 1);
      return { permitido: true, usadas: ja + 1 };
    },
  };
}

const mesDe = (data) => new Date(data).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7);

module.exports = { TETOS, criarContador, mesDe };
