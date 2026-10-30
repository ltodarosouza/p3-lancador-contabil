# Lançador — P3, Prado Contabilidade

A mensagem de WhatsApp de um cliente entra, e o sistema devolve o que lançar, o que perguntar de volta ou nada. Quem confere é o Tiago ou a Aline. Esta é a primeira fatia: **só o lançador**. A fila de conferência e o eval ainda não existem.

Material usado: `instrucoes.md` é o plano de contas e as 15 regras da casa, copiadas sem alterar do material da P3 (fictício e anonimizado).

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

## O que ainda falta

- A fila de conferência do Tiago e da Aline (a tela) e o eval.
- O histórico de lançamentos aprovados do cliente na chamada. As regras 5 e 7 dizem que "o histórico diz", e a versão atual não o envia, então o modelo devolve pendência onde o histórico resolveria (a Fiorino e o pix para o Marcão, nas evidências).
- O teto de mensagens por cliente e o custo em reais por mensagem (aula 3.4). Hoje só a contagem de tokens aparece.
- Os `pendencias` voltam como texto simples; o formato pedido no prompt era um objeto com `pergunta`. Os testes aceitam as duas formas.
- Evidências do navegador no site publicado: ainda não feitas.
