// A fila de conferência do Tiago e da Aline. Três tipos de item, cada um no seu lugar:
//   lancamento    o que o sistema montou, para aprovar ou corrigir
//   pendencia     leitura que deu certo e sabe o que perguntar ao cliente
//   sem_lancamento a mensagem não é lançamento (saudação, dúvida, tentativa de mandar no sistema): item só de leitura, que se dispensa
//   nao_entendido o sistema não conseguiu ler: vai com a mensagem original e o motivo, e só pede o olho do Tiago
// Os itens ficam no armazém (lib/armazem.js): em memória por instância, ou no Redis quando o ambiente traz as variáveis.
const { validarLancamento } = require("./validar");
const { armazemEmMemoria } = require("./armazem");

class ErroDeFila extends Error {
  constructor(erro, extra = {}) { super(erro); this.erro = erro; Object.assign(this, extra); }
}

const CAMPOS_CORRIGIVEIS = ["data", "tipo", "categoria", "valor", "forma", "contraparte", "descricao"];
const IDS = "fila:ids";
const chaveDoItem = (id) => `fila:item:${id}`;
const chaveDoFechamento = (id) => `fila:fechado:${id}`;

function criarFila({ agora = () => new Date(), armazem = armazemEmMemoria() } = {}) {
  const ler = async (id) => { const t = await armazem.get(chaveDoItem(id)); return t ? JSON.parse(t) : null; };
  const gravar = (item) => armazem.set(chaveDoItem(item.id), JSON.stringify(item));
  const achar = async (id) => { const i = typeof id === "string" ? await ler(id) : null; if (!i) throw new ErroDeFila("item_inexistente"); return i; };
  const todos = async () => {
    const ids = (await armazem.smembers(IDS)).sort();
    const textos = await armazem.mget(ids.map(chaveDoItem));
    return textos.filter(Boolean).map((t) => JSON.parse(t));
  };
  // Quem chega primeiro fecha o item; o segundo clique (ou a outra instância) recebe ja_resolvido e não grava por cima.
  const fechar = async (i) => {
    if (i.estado !== "aguardando" || !(await armazem.setnx(chaveDoFechamento(i.id), "1"))) {
      const atual = (await ler(i.id)) ?? i;
      throw new ErroDeFila("ja_resolvido", { estado: atual.estado });
    }
  };

  return {
    armazem: armazem.nome,
    async adicionar(item) {
      const id = `F-${String(await armazem.incr("fila:seq")).padStart(4, "0")}`;
      await gravar({ id, estado: "aguardando", criado_em: agora().toISOString(), ...item });
      await armazem.sadd(IDS, id);
      return id;
    },
    obter: (id) => (typeof id === "string" ? ler(id) : null),
    // clientes: quando vem, só entram os itens desses clientes. É por onde a fila de cada pessoa é cortada.
    async listar({ estado, tipo, clientes } = {}) {
      return (await todos()).filter((i) => (!estado || i.estado === estado) && (!tipo || i.tipo === tipo) && (!clientes || clientes.includes(i.cliente_id)));
    },
    // O que uma pessoa conferiu, do cliente: aprovado ou corrigido. É a única fonte do histórico que entra na chamada.
    async aprovados(cliente_id) {
      return (await todos())
        .filter((i) => i.tipo === "lancamento" && (i.estado === "aprovado" || i.estado === "corrigido") && i.cliente_id === cliente_id)
        .map((i) => ({ cliente_id, ...i.lancamento }));
    },
    // O que uma pessoa conferiu e pode ir para o arquivo de importação. novos: só o que ainda não saiu num arquivo.
    async conferidos({ clientes, novos = false } = {}) {
      return (await todos()).filter((i) => i.tipo === "lancamento" && (i.estado === "aprovado" || i.estado === "corrigido") && (!clientes || clientes.includes(i.cliente_id)) && (!novos || !i.exportado_em));
    },
    async marcarExportados(ids, quem) {
      for (const id of ids) { const i = await ler(id); if (i) await gravar({ ...i, exportado_em: agora().toISOString(), exportado_por: quem }); }
    },
    async resumo({ clientes } = {}) {
      const r = {};
      for (const i of (await todos()).filter((x) => !clientes || clientes.includes(x.cliente_id))) { r[i.tipo] ??= {}; r[i.tipo][i.estado] = (r[i.tipo][i.estado] || 0) + 1; }
      return r;
    },
    async aprovar(id, quem) {
      const i = await achar(id);
      if (i.tipo !== "lancamento") throw new ErroDeFila("so_lancamento_se_aprova");
      await fechar(i);
      Object.assign(i, { estado: "aprovado", resolvido_por: quem, resolvido_em: agora().toISOString() });
      await gravar(i);
      return i;
    },
    // Item de leitura (mensagem sem lançamento): a pessoa viu e dispensa. Não aprova, não corrige, não vai para o arquivo.
    async dispensar(id, quem) {
      const i = await achar(id);
      if (i.tipo !== "sem_lancamento") throw new ErroDeFila("so_leitura_se_dispensa");
      await fechar(i);
      Object.assign(i, { estado: "dispensado", resolvido_por: quem, resolvido_em: agora().toISOString() });
      await gravar(i);
      return i;
    },
    // Mandar de volta: a pessoa não aprova nem corrige, devolve com o motivo. O item fecha e não vira histórico nem arquivo.
    async devolver(id, motivo, quem) {
      const i = await achar(id);
      if (i.tipo !== "lancamento") throw new ErroDeFila("so_lancamento_se_devolve");
      if (typeof motivo !== "string" || !motivo.trim() || motivo.length > 300) throw new ErroDeFila("motivo_obrigatorio");
      await fechar(i);
      Object.assign(i, { estado: "devolvido", devolucao: { motivo: motivo.trim(), por: quem, em: agora().toISOString() }, resolvido_por: quem, resolvido_em: agora().toISOString() });
      await gravar(i);
      return i;
    },
    // A correção do Tiago também passa pela validação: corrigir não é um jeito de contornar as regras.
    async corrigir(id, campos, quem) {
      const i = await achar(id);
      if (i.tipo !== "lancamento") throw new ErroDeFila("so_lancamento_se_corrige");
      if (i.estado !== "aguardando") throw new ErroDeFila("ja_resolvido", { estado: i.estado });
      const mudou = Object.keys(campos || {}).filter((c) => CAMPOS_CORRIGIVEIS.includes(c));
      if (!mudou.length) throw new ErroDeFila("nada_para_corrigir");
      const novo = { ...i.lancamento, ...Object.fromEntries(mudou.map((c) => [c, campos[c]])) };
      const erros = validarLancamento(novo, { cliente: { codigo: i.cliente_id }, referencia: i.recebida_em });
      if (erros.length) throw new ErroDeFila("correcao_invalida", { detalhes: erros });
      const correcao = Object.fromEntries(mudou.filter((c) => i.lancamento[c] !== novo[c]).map((c) => [c, { de: i.lancamento[c], para: novo[c] }]));
      if (novo.data !== i.lancamento.data) novo.data_assumida = false; // a data agora foi conferida por uma pessoa
      await fechar(i);
      Object.assign(i, { lancamento: novo, estado: "corrigido", correcao: { campos: correcao, por: quem, em: agora().toISOString() }, resolvido_por: quem, resolvido_em: agora().toISOString() });
      await gravar(i);
      return i;
    },
  };
}

module.exports = { criarFila, ErroDeFila };
