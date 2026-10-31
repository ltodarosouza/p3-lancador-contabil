# Inventário da P3, Prado Contabilidade

Feito em 31/10/2026, depois das aulas 3.3 a 3.9, antes de fechar a prática. Lista montada a partir do brief (`praticas/p3/brief.md`) e do que está no repositório e no site no ar. Cada "já existe" foi conferido no código, nos testes ou nas evidências; o que não consegui conferir está dito.

**Duas versões.** A primeira (commit `e8e1f3c`) listava nove itens em "ainda vai entrar" e mostrava que o arquivo de importação e o corte por pessoa não existiam. Nos commits seguintes fechei os itens 1, 2, 4, 5, 6, 7 e 8 (cada um com teste escrito antes e quebra de propósito para ver o teste falhar). O item 3, guardar a fila e o contador, fechei só até o código e o teste contra um Redis de mentira; falta um Redis de verdade. O item 9, publicar, só com pedido do Lucas. Esta versão mostra o estado depois disso, e o que sobrou é o que depende de outra pessoa.

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

Do que o brief pede, conferido no código e nos testes (suíte: 116 testes, sem rede e sem chave):

- **Lançador com o Gemini** (`gemini-3.5-flash-lite`), com as 15 regras da casa e o plano de contas em `instrucoes.md`, copiados do material. Resultado por mensagem: lançou, pendência, nada ou não entendido. Mensagens anteriores entram, no máximo 5, e cada uma tem de ser do mesmo cliente (senão 400). O material traz áudio já transcrito, e o sistema lê esse texto.
- **Sem valor vira pendência, no código** (regra 1), com uma pergunta só na voz da casa. Valor presente e errado continua sendo "não entendido".
- **Validação do que o modelo devolve** em código. Falha do modelo (limite, resposta cortada, bloqueada, recusada, vazia) vira "não entendido" na fila, com o motivo, o que fazer e as tentativas; nunca vira lançamento. A espera por limite cresce, com 3 tentativas.
- **Data assumida decidida pelo código**, olhando o texto da mensagem, não o que o modelo diz.
- **Fila de conferência** com tela em `/fila`: mensagem original ao lado, aprovar, corrigir, **mandar de volta com motivo**, dispensar o que não é lançamento, aviso, "Salvando…/Salvo.". A pergunta de volta já sai pronta como pendência, na voz da casa.
- **Mensagem sem lançamento não some**: entra como item de leitura, com aviso quando o modelo marca ou cita a regra 12.
- **Cada um vê os seus clientes**: chave por pessoa no ambiente do servidor, Tiago (`C-0417`, `C-0288`), Aline (`C-0533`, `C-0601`), Denise todos. Item de outro cliente responde como item inexistente e não muda. Provado em `test/pessoas.test.js`, que qualquer um roda sem senha.
- **Arquivo de importação**: as dez colunas do material, só o conferido, por pessoa, sem repetir linha já entregue, com defesa contra texto que vira fórmula.
- **Teto por plano**: 160 mensagens no Essencial e 500 no Completo (duas por lançamento do plano, de 80 e 250), proposta minha que a Denise ainda não decidiu. A mensagem barrada não vai ao modelo e fica na fila manual.
- **Painel da Denise** (`/painel`, só com a chave dela): mensagens, custo do mês e quem passou do teto, a partir do que o sistema contou.
- **Custo por mensagem em reais**, dos tokens registrados: R$ 0,00485 sem histórico e R$ 0,00495 com, preço de 28/10/2026, câmbio de 30/10/2026. O log tem uma linha por chamada e não leva o texto da mensagem.
- **Fila e contador num armazém** (memória, ou Redis por HTTP quando o ambiente traz as variáveis). Duas instâncias sobre o mesmo armazém veem a mesma fila e o item só fecha uma vez. **Provado contra um Redis de mentira que fala o protocolo do Upstash e, em 31/10/2026, contra o Redis de verdade (Upstash, ligado ao projeto na Vercel) com `scripts/prova-armazem.js`. O site publicado usando esse Redis ainda não foi visto.**
- **Isolamento entre clientes na chamada** e **histórico conferido do cliente na chamada** (só o que uma pessoa aprovou ou corrigiu, no máximo 60 linhas).
- **Provas hostis** no Gemini real: a injeção respondeu `nada` (agora esse `nada` chega à fila); HTML e script aparecem como texto.
- **Eval**: 23 casos, 20 contam na nota, 3 fora da nota esperando a Denise. O gabarito é meu, ninguém da casa o aprovou. Depois do conserto da regra 1, a única rodada limpa deu 19 de 20 (E05 e E23 passaram); as outras bateram no limite diário do provedor. Detalhe em "Eval" no README.
- **README** com decisões, custo, teto, limite do provedor, o que o sistema nunca faz sozinho e o que falta; evidências em `evidencia/`.
- **No ar** em https://p3-lancador-contabil.vercel.app, mas **numa versão antiga**. O código novo está no repositório e só vai para o ar quando o Lucas pedir.

## 3. O que ainda vai entrar

Só o que depende de outra pessoa; o que dependia só do código está na parte 2.

1. **Publicar a versão nova** e rodar o exemplo do README contra o site no ar. Só quando o Lucas pedir.
2. **Ver o sistema no ar usando o Redis e as chaves** (já registrados na Vercel em 31/10/2026): só depois da publicação.
3. **Rodar o `curl` do README contra o endereço no ar**, quando a cota do Gemini permitir.
4. **A Denise decidir**: o teto de 160 e 500 mensagens, as quatro lacunas do eval (`eval/lacunas-para-a-denise.md`) e aprovar o gabarito.

## 4. O que fica de fora, com o motivo

- **Foto da nota.** O brief a lista como entrada, mas o material não traz nenhuma foto (a Denise tirou: não dá para anonimizar nota fiscal; onde tinha, só há a marcação no texto). Sem foto para testar, eu não teria como medir se a leitura acerta, e um recurso sem medida eu não entrego.
- **Transcrever áudio.** O material traz os áudios já transcritos pelo aplicativo (M06 e M24, por exemplo, marcados "áudio, transcrito"), e o sistema lê esse texto como qualquer outro. Receber o arquivo de áudio e transcrever ele mesmo não está no brief e ficaria sem material para medir.
- **Aprender com os 140 clientes de uma vez** (ideia da Denise). Contradiz o isolamento: o histórico de um cliente não pode entrar na leitura de outro, e o que o Marcão é na padaria não vale para outro Marcão. Fica o histórico do próprio cliente.
- **Login com conta e senha de verdade.** Quem confere o trabalho não tem usuário nem senha, e senha não vai para um repositório público. Entram três chaves de ambiente, que o teste consegue provar.
- **Busca no histórico por mês ou palavra, e fila global de limite entre clientes.** Só existem como desenho; não resolvem falha que eu tenha medido.
- **Botão de copiar a pergunta para o celular e tela bonita.** A pergunta já sai pronta; o acabamento da tela fica para depois, como combinado.
- **Tudo o que o brief já tira:** WhatsApp, conciliação, nota fiscal eletrônica, ligação com o sistema contábil, cobrança, decisão sozinha.
