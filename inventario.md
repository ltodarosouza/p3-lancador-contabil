# Inventário da P3, Prado Contabilidade

Feito em 31/10/2026, depois das aulas 3.3 a 3.9, antes de fechar a prática. Lista montada a partir do brief (`praticas/p3/brief.md`) e do que está no repositório e no site no ar. Cada "já existe" foi conferido no código, nos testes ou nas evidências; o que não consegui conferir está dito.

## 1. O que o brief pede

**Lançador**
- Entra a mensagem do cliente: texto, áudio transcrito e a foto da nota quando tem.
- As mensagens anteriores do mesmo cliente fazem parte da leitura.
- Sai o lançamento com data, valor, tipo, categoria do plano de contas, forma, contraparte e descrição curta.
- Uma mensagem pode dar vários lançamentos ou nenhum.
- Quando falta valor ou não dá para saber o que é, não chuta: vira pendência dizendo o que falta perguntar.

**Fila de conferência**
- Cada lançamento aparece com a mensagem original ao lado; a pessoa aprova, corrige ou manda de volta.
- Chega com aviso: lançamento grande (acima de R$ 5.000), tudo de que a máquina não tinha certeza e a mensagem que tenta mandar no sistema (regra 12).
- O que foi aprovado sai num arquivo que o sistema da casa importa, com as dez colunas do material.
- Tiago vê só os 70 clientes dele, Aline os 70 dela, Denise vê tudo. Isso provado num teste que qualquer um roda.

**Pergunta de volta**
- Pronta, curta, na voz da casa, para o Tiago ou a Aline mandarem do celular. A Denise disse que, se não couber, corta e avisa.

**Planos, teto e custo**
- O sistema sabe o plano de cada cliente, conta as mensagens do mês e, passando do teto, deixa a mensagem na fila para olhar à mão e avisa que o cliente está no plano errado.
- Custo de cada mensagem em reais, no preço pago do modelo, com a data do preço, saído dos tokens registrados e não estimado.
- A Denise vê quanto o mês teria custado e quem passou do teto.
- Bateu no limite do provedor: a mensagem espera e passa depois, ou cai na fila, e o Tiago vê que foi isso. Sem tela quebrada, sem mensagem perdida.

**Entrega**
- Sistema no ar e repositório público, sem senha nenhuma dentro.
- Eval com os casos e o número; custo por mensagem com data; README com decisões, o que ficou de fora e por quê, modelo e por quê, custo e teto, o que o eval mede e quanto deu, e o que o sistema nunca faz sozinho.
- README também diz como rodar os testes, como rodar o eval, e traz um exemplo pronto de mensagem para o sistema no ar.

**O brief diz que não entra:** WhatsApp (receber ou mandar), conciliação bancária, nota fiscal eletrônica, ligação com o sistema contábil, cobrança, e decidir sozinho.

## 2. O que já existe

- **Lançador com o Gemini** (`gemini-3.5-flash-lite`), com as 15 regras da casa e o plano de contas em `instrucoes.md`, copiados do material. Resultado por mensagem: lançou, pendência, nada ou não entendido. Mensagens anteriores entram, no máximo 5, e cada uma tem de ser do mesmo cliente (senão 400).
- **Validação do que o modelo devolve** em código. Falha do modelo (limite, resposta cortada, bloqueada, recusada, vazia) vira "não entendido" na fila, com o motivo, o que fazer e as tentativas; nunca vira lançamento. A espera por limite cresce, com 3 tentativas.
- **Data assumida decidida pelo código**, olhando o texto da mensagem, não o que o modelo diz.
- **Fila de conferência em memória**, com tela em `/fila`: mensagem original ao lado, aprovar e corrigir, aviso, "Salvando…/Salvo.", item que não gravou volta ao topo. Pergunta de volta já sai como pendência, na voz da casa.
- **Teto por plano** (Essencial 80, Completo 250) com contagem por cliente e mês; passando, vai para a fila manual.
- **Custo por mensagem em reais**, dos tokens registrados: R$ 0,00485 sem histórico e R$ 0,00495 com, preço de 28/10/2026, câmbio de 30/10/2026. Log de uma linha por chamada, sem texto da mensagem.
- **Isolamento entre clientes na chamada**: mensagem anterior de outro cliente é recusada; o histórico conferido é filtrado por cliente em código, duas vezes. Testado.
- **Histórico conferido do cliente na chamada** (só o que uma pessoa aprovou ou corrigiu, no máximo 60 linhas).
- **Provas hostis** no Gemini real: a injeção respondeu `nada`; HTML e script aparecem como texto na fila.
- **Eval**: 23 casos, 20 contam na nota, 3 fora da nota esperando a Denise (`eval/lacunas-para-a-denise.md`). Faixa limpa de 15 a 16 de 17 sem mudança, e a comparação sem e com histórico em três rodadas cada. O gabarito é meu, nenhuma pessoa da casa aprovou.
- **73 testes** que rodam sem rede e sem chave.
- **README** com decisões, custo, teto, limite do provedor e o que falta; evidências em `evidencia/`.
- **No ar** em https://p3-lancador-contabil.vercel.app, mas **numa versão antiga**: o código novo (eval, histórico, isolamento, falhas) está no repositório e ainda não foi publicado. Publicar só quando o Lucas pedir.

## 3. O que ainda vai entrar

Em ordem de peso para a Denise. A ordem e o que entra é decisão do Lucas; abaixo está o que eu proporia.

1. **Arquivo de importação.** Conferi no código: não existe nada que gere o arquivo. É a entrega central ("o que foi aprovado sai num arquivo"). Dez colunas do material, uma linha por lançamento, `origem` e `aprovado_por` preenchidos; sem coluna de aviso, data assumida ou pendência.
2. **Cada um vê os seus clientes.** Não existe: a fila mostra tudo para todos e não há login. O brief exige prova em teste. Decisão aberta antes do código: quem é a pessoa tem de vir de algo que o servidor confere (uma chave por pessoa guardada no ambiente), não de um campo que a requisição preenche, e quem confere o trabalho não tem senha.
3. **Fila e contador guardados de verdade.** Hoje ficam na memória de cada instância da função; entre instâncias e reinícios somem. Sem isso o teto e a fila não valem no ar.
4. **Visão da Denise:** custo do mês e quem passou do teto, a partir do log. Hoje o log existe, a leitura não.
5. **Aviso quando a mensagem tenta mandar no sistema (regra 12).** Hoje a injeção que testei voltou `nada`, e `nada` não entra na fila: o aviso que a Denise quer não chega. Proposta: mensagem que o modelo marca como tentativa de mandar vira item de leitura na fila.
6. **"Mandar de volta"** como terceira ação da fila. Hoje há aprovar e corrigir.
7. **Sem valor vira pendência (regra 1), no código.** E05 e E23 do eval falham pelo mesmo motivo: o modelo monta o lançamento sem valor, a validação barra e sai "não entendido" em vez de pendência. Correção em código, com teste vermelho antes.
8. **Acertar o README:** o começo ainda diz que o eval não existe e que são 58 testes; hoje há eval e 73 testes. A lista "o que ainda falta" também está velha.
9. **Publicar a versão nova**, a pedido do Lucas, e rodar o exemplo do README contra o site no ar.

## 4. O que fica de fora, com o motivo

- **Foto da nota.** O brief a lista como entrada, mas o material não traz nenhuma foto (a Denise tirou: não dá para anonimizar nota fiscal; onde tinha, só há a marcação no texto). Sem foto para testar, eu não teria como medir se a leitura acerta, e um recurso sem medida eu não entrego.
- **Transcrever áudio.** O material traz os áudios já transcritos pelo aplicativo (M06 e M24, por exemplo, marcados "áudio, transcrito"), e o sistema lê esse texto como qualquer outro. Receber o arquivo de áudio e transcrever ele mesmo não está no brief e ficaria sem material para medir.
- **Aprender com os 140 clientes de uma vez** (ideia da Denise). Contradiz o isolamento: o histórico de um cliente não pode entrar na leitura de outro, e o que o Marcão é na padaria não vale para outro Marcão. Fica o histórico do próprio cliente.
- **Login com conta e senha de verdade.** Quem confere o trabalho não tem usuário nem senha, e senha não vai para um repositório público. Entra no item 2 só o que o teste consegue provar.
- **Busca no histórico por mês ou palavra, e fila global de limite entre clientes.** Só existem como desenho; não resolvem falha que eu tenha medido.
- **Botão de copiar a pergunta para o celular e tela bonita.** A pergunta já sai pronta; o acabamento da tela fica para depois, como combinado.
- **Tudo o que o brief já tira:** WhatsApp, conciliação, nota fiscal eletrônica, ligação com o sistema contábil, cobrança, decisão sozinha.
- **Aprovação do gabarito do eval pela Denise.** Não está no meu alcance. Fica registrado em `eval/lacunas-para-a-denise.md` e o número do eval continua dito como "gabarito meu, sem aprovação".
