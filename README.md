# Lançador — P3, Prado Contabilidade

A mensagem de WhatsApp de um cliente entra, e o sistema devolve o que lançar, o que perguntar de volta ou nada. Quem confere é o Tiago ou a Aline. Esta é a primeira fatia: **só o lançador**. A fila de conferência e o eval ainda não existem.

Material usado: `instrucoes.md` é o plano de contas e as 15 regras da casa, copiadas sem alterar do material da P3 (fictício e anonimizado).

**No ar:** https://p3-lancador-contabil.vercel.app (página de teste em `/`, rota em `POST /api/lancar`). A chave fica nas variáveis de ambiente da Vercel.

## Como rodar

```bash
cp .env.example .env        # depois preencha GEMINI_API_KEY no .env; o .env está no .gitignore
npm test                    # 10 testes, sem rede e sem chave
npm start                   # http://localhost:3000, com uma página para testar
```

## Exemplo com `curl` (sem credenciais)

O corpo leva o código do cliente, a mensagem e a data em que ela foi enviada. Quem é o cliente e qual o plano dele sai da tabela do sistema (`dados/clientes.json`), não do que a requisição diz.

Primeira mensagem do Nilton (`C-0417`):

```bash
curl -s -X POST http://localhost:3000/api/lancar \
  -H 'content-type: application/json' \
  -d '{"cliente_id":"C-0417","mensagem":"pix pro marcão 450","recebida_em":"2026-10-03T18:05:00-03:00"}'
```

Segunda mensagem seguida, do mesmo cliente. O modelo não guarda nada entre chamadas, então quem chama manda as mensagens anteriores (no máximo 5) como contexto:

```bash
curl -s -X POST http://localhost:3000/api/lancar \
  -H 'content-type: application/json' \
  -d '{"cliente_id":"C-0417","mensagem":"abasteci a fiorino sábado 250 no cartão","recebida_em":"2026-10-05T09:34:00-03:00","anteriores":[{"recebida_em":"2026-10-03T18:05:00-03:00","texto":"pix pro marcão 450"}]}'
```

A resposta traz `lancamentos`, `pendencias` (a pergunta de volta, na voz da casa), `aviso`, `motivo` e `tokens` (entrada e saída). Respostas reais estão em `evidencia/endpoint-local.txt` e `evidencia/chamada-1-m10.txt`.

Erros: `400` (corpo ou mensagem inválidos), `405` (só POST), `422` (cliente desconhecido), `502` (modelo fora do ar ou resposta que não é JSON) e `503` (sem chave configurada). Nenhum devolve detalhe do modelo.

## A chave do modelo

O provedor é o Gemini, no plano gratuito, escolhido para não gastar nada nesta etapa. A chave fica só no `.env` (local) e nas variáveis de ambiente da Vercel. Ela vai no cabeçalho da chamada, nunca na URL, e nunca volta em resposta nem em erro; os testes conferem isso, e um deles falha se uma chave do Google aparecer em qualquer arquivo versionado. Nos testes só entram mensagens de exemplo, nunca dado de cliente de verdade, porque o plano gratuito pode usar o que se manda.

## O que os testes provam, e o que não provam

Os 10 testes cobrem a validação, a origem do plano do cliente e o caminho da chave. Para ver se eles pegam erro de verdade, quebrei o código de quatro jeitos e cada um fez exatamente um teste falhar: plano vindo da requisição, chave na URL, erro do modelo devolvido e cliente desconhecido aceito. **Os testes não provam que o modelo lança certo**: para isso precisa de um eval com casos e um número, que ainda não existe. Só rodei três mensagens reais.

## Custo por mensagem

A primeira chamada (1.666 tokens de entrada, 70 de saída) custaria **R$ 0,0037** no plano pago do Gemini 3.5 Flash-Lite (US$ 0,30 por milhão de entrada e US$ 2,50 de saída, página do Google atualizada em 28/10/2026; dólar PTAX de venda de 30/10/2026, R$ 5,4212). Cerca de 74% é a entrada, o pacote fixo de regras. Para 5.000 mensagens por mês do mesmo tamanho: cerca de R$ 18,29. No plano gratuito que o projeto usa hoje, o custo é zero. Conta completa em `evidencia/custo-primeira-chamada.txt`.

Medido em 8 mensagens reais do Rubens (plano Essencial, R$ 290 por mês): média de 1.663 tokens de entrada e 126 de saída, ou **R$ 0,0044 por mensagem**. Um cliente de 80 mensagens no mês custaria cerca de R$ 0,35 de modelo (0,12% do plano), e um que mandasse 400, cerca de R$ 1,76 (0,6%). Saída crua e limites em `evidencia/custo-essencial-rubens.txt`.

## Custo de cada mensagem, em reais

| Item | Valor | Fonte e data |
|---|---|---|
| Modelo | Gemini 3.5 Flash-Lite, plano pago (Standard) | página de preços do Google, atualizada em 28/10/2026 |
| Preço | US$ 0,30 por milhão de tokens de entrada e US$ 2,50 de saída | idem |
| Câmbio | R$ 5,4212 (dólar PTAX de venda) | Banco Central, 30/10/2026 |
| Custo medido | **R$ 0,0044 por mensagem** (média de 1.663 tokens de entrada e 126 de saída, em 8 mensagens do Rubens) | `evidencia/custo-essencial-rubens.txt` |
| Com o histórico da padaria | R$ 0,0060 (+955 tokens de entrada) | `evidencia/custo-historico-padaria.txt` |

No plano gratuito que o projeto usa hoje o custo real é zero. Os números acima são o que seria no pago, e preço e câmbio mudam.

Cinco mensagens escolhidas pela tutora (M06, M09, M13, M18, M22), processadas pelo sistema, com o log cru e a conta refeita só com os tokens: média de **R$ 0,0046 por mensagem** (1.672 tokens de entrada e 138 de saída), e a entrada responde por 59% do custo. A saudação (M13) custou R$ 0,0035, quase o mesmo que um lançamento (R$ 0,0048): sem lançamento, o custo é quase todo o pacote fixo de regras. Ver `evidencia/log-cinco-mensagens.txt`.

## Teto por plano

Contado no servidor, por cliente e por mês, **antes** de chamar o modelo (o mês é o do relógio do servidor, não o da requisição). Acima do teto a chamada responde `429` com `{"encaminhar":"fila_manual","motivo":"teto_do_plano",...}`: a mensagem não vai ao modelo, fica na fila para o Tiago olhar à mão, e o log registra que o cliente passou do plano.

| Plano | Teto de mensagens por mês | Motivo | Custo no teto |
|---|---|---|---|
| Essencial (até 80 lançamentos) | 160 | 2 mensagens por lançamento: uma mensagem gera 0, 1 ou vários lançamentos, e a pendência pede resposta | R$ 0,71 (0,24% de R$ 290) |
| Completo (até 250 lançamentos) | 500 | idem | R$ 2,98 (0,61% de R$ 490), contando o histórico da padaria |

Os números 160 e 500 são uma proposta minha, a partir da regra do brief ("ninguém manda muito mais mensagem do que lançamento"). **Quem decide é a Denise.** Limite honesto desta versão: o contador fica na memória de cada instância da função, então vale por instância e se perde quando ela reinicia. Para valer de verdade precisa de armazenamento (banco ou cache); a interface do contador já está separada para trocar sem mexer no resto.

## Log

Uma linha em JSON por chamada, na saída da função (na Vercel, em Logs): `mensagem_id`, `cliente_id`, `quando`, `modelo`, `status` (`ok`, `teto`, `erro_modelo`, `resposta_ilegivel`), `duracao_ms`, `tokens_entrada`, `tokens_saida`, `custo_brl`, o preço usado (`preco_usd_por_milhao`, `data_preco`, `cambio_brl`, `data_cambio`) e `resultado` (`lancou`, `pendencia`, `nada`) com `aviso`. **Fica de fora de propósito:** o texto da mensagem, o lançamento e o motivo devolvidos pelo modelo, nome, telefone, o prompt e a chave. Com o `mensagem_id` se acha o texto no sistema do escritório. Testes: `test/teto.test.js`.

## O limite do provedor

O que a página do Google (rate limits, atualizada em 28/10/2026) diz: o limite é **por projeto, não por chave**, e a cota diária zera à meia-noite no horário do Pacífico. **Os números do `gemini-3.5-flash-lite` não estão na página**: ela manda ver no AI Studio, na conta de quem usa, e eu ainda não os li. Como o limite é do projeto, um cliente que dispara muitas mensagens gasta a cota de todos, e por isso o teto por cliente fica no servidor.

## O que ainda falta

- A fila de conferência do Tiago e da Aline (a tela) e o eval.
- O histórico de lançamentos aprovados do cliente na chamada. As regras 5 e 7 dizem que "o histórico diz", e a versão atual não o envia, então o modelo devolve pendência onde o histórico resolveria (a Fiorino e o pix para o Marcão, nas evidências).
- O teto por cliente guardado de verdade: hoje o contador fica na memória de cada instância da função (ver "Teto por plano"). Para valer entre instâncias e reinícios precisa de armazenamento, que ainda não tem.
- Os `pendencias` voltam como texto simples; o formato pedido no prompt era um objeto com `pergunta`. Os testes aceitam as duas formas.
- Evidências do navegador no site publicado: feitas, em `evidencia/navegador-producao.txt` (busca pela chave na página e aba de rede).
