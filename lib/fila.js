// A fila de conferência do Tiago e da Aline. Três tipos de item, cada um no seu lugar:
//   lancamento    o que o sistema montou, para aprovar ou corrigir
//   pendencia     leitura que deu certo e sabe o que perguntar ao cliente
//   nao_entendido o sistema não conseguiu ler: vai com a mensagem original e o motivo, e só pede o olho do Tiago
// Em memória, por instância; para valer de verdade entre instâncias e reinícios precisa de armazenamento (ver README).
const { validarLancamento } = require("./validar");

class ErroDeFila extends Error {
  constructor(erro, extra = {}) { super(erro); this.erro = erro; Object.assign(this, extra); }
}

const CAMPOS_CORRIGIVEIS = ["data", "tipo", "categoria", "valor", "forma", "contraparte", "descricao"];

function criarFila({ agora = () => new Date() } = {}) {
  const itens = new Map();
  let proximo = 1;
  const achar = (id) => { const i = itens.get(id); if (!i) throw new ErroDeFila("item_inexistente"); return i; };

  return {
    adicionar(item) {
      const id = `F-${String(proximo++).padStart(4, "0")}`;
      const novo = { id, estado: "aguardando", criado_em: agora().toISOString(), ...item };
      itens.set(id, novo);
      return id;
    },
    obter: (id) => itens.get(id) ?? null,
    listar({ estado, tipo } = {}) {
      return [...itens.values()].filter((i) => (!estado || i.estado === estado) && (!tipo || i.tipo === tipo));
    },
    // O que uma pessoa conferiu, do cliente: aprovado ou corrigido. É a única fonte do histórico que entra na chamada.
    aprovados(cliente_id) {
      return [...itens.values()]
        .filter((i) => i.tipo === "lancamento" && (i.estado === "aprovado" || i.estado === "corrigido") && i.cliente_id === cliente_id)
        .map((i) => ({ cliente_id, ...i.lancamento }));
    },
    resumo() {
      const r = {};
      for (const i of itens.values()) { r[i.tipo] ??= {}; r[i.tipo][i.estado] = (r[i.tipo][i.estado] || 0) + 1; }
      return r;
    },
    aprovar(id, quem) {
      const i = achar(id);
      if (i.tipo !== "lancamento") throw new ErroDeFila("so_lancamento_se_aprova");
      if (i.estado !== "aguardando") throw new ErroDeFila("ja_resolvido", { estado: i.estado }); // o clique duplo não aprova duas vezes
      Object.assign(i, { estado: "aprovado", resolvido_por: quem, resolvido_em: agora().toISOString() });
      return i;
    },
    // A correção do Tiago também passa pela validação: corrigir não é um jeito de contornar as regras.
    corrigir(id, campos, quem) {
      const i = achar(id);
      if (i.tipo !== "lancamento") throw new ErroDeFila("so_lancamento_se_corrige");
      if (i.estado !== "aguardando") throw new ErroDeFila("ja_resolvido", { estado: i.estado });
      const mudou = Object.keys(campos || {}).filter((c) => CAMPOS_CORRIGIVEIS.includes(c));
      if (!mudou.length) throw new ErroDeFila("nada_para_corrigir");
      const novo = { ...i.lancamento, ...Object.fromEntries(mudou.map((c) => [c, campos[c]])) };
      const erros = validarLancamento(novo, { cliente: { codigo: i.cliente_id }, referencia: i.recebida_em });
      if (erros.length) throw new ErroDeFila("correcao_invalida", { detalhes: erros });
      const correcao = Object.fromEntries(mudou.filter((c) => i.lancamento[c] !== novo[c]).map((c) => [c, { de: i.lancamento[c], para: novo[c] }]));
      if (novo.data !== i.lancamento.data) novo.data_assumida = false; // a data agora foi conferida por uma pessoa
      Object.assign(i, { lancamento: novo, estado: "corrigido", correcao: { campos: correcao, por: quem, em: agora().toISOString() }, resolvido_por: quem, resolvido_em: agora().toISOString() });
      return i;
    },
  };
}

module.exports = { criarFila, ErroDeFila };
