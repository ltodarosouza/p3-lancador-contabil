# Plano de contas e regras da casa do Prado Contabilidade

Copiado do material da P3 (mensagens.md), sem alterar. Material fictício e anonimizado.

## Plano de contas

Código e nome, como estão no nosso sistema. O sistema importa pelo código.

**Receitas**
- `1.1` Venda de mercadorias
- `1.2` Prestação de serviços
- `1.3` Vendas por aplicativo (iFood, Shopee, Mercado Livre e afins; separamos porque a comissão vem descontada)
- `1.4` Devoluções e estornos de receita (valor negativo)
- `1.5` Outras receitas

**Despesas**
- `2.1` Mercadorias para revenda
- `2.2` Insumos e matéria-prima
- `2.3` Aluguel e condomínio
- `2.4` Água, luz e gás
- `2.5` Internet e telefone
- `2.6` Salários e encargos
- `2.7` Pró-labore
- `2.8` Impostos e taxas (DAS, alvará, IPTU do ponto)
- `2.9` Tarifas bancárias e de maquininha
- `2.10` Juros e multas
- `2.11` Combustível e transporte
- `2.12` Manutenção e reparos
- `2.13` Material de uso e consumo
- `2.14` Marketing e anúncios
- `2.15` Serviços de terceiros
- `2.16` Software e assinaturas
- `2.17` Alimentação da equipe
- `2.18` Fretes e entregas
- `2.19` Uniformes e EPI
- `2.20` Honorários contábeis
- `2.21` Outras despesas

**Movimentos que não são receita nem despesa**
- `3.1` Aporte de sócio
- `3.2` Retirada de sócio e distribuição de lucro
- `3.3` Empréstimo recebido
- `3.4` Parcela de empréstimo
- `3.5` Compra de equipamento e móveis
- `3.6` Transferência entre contas da própria empresa

**Pendência**
- `9.1` A esclarecer. Não é lançamento: é uma pendência na fila, com o que falta perguntar. Não vai para o arquivo. Vira lançamento quando o cliente responder.

## Regras da casa

Escritas por mim numa tarde, a partir do que o Tiago e a Aline fazem. Se você achar contradição, é porque existe.

1. **Sem valor, não lança: vira pendência.** Sem data, vale a data da mensagem, e o lançamento fica marcado como data assumida. "Ontem", "sexta", "semana passada" contam a partir da data e hora da mensagem. Sem forma de pagamento, `nao_informado`.
2. **Valor é em reais.** "1,2k", "1.200", "mil e duzentos" e "1200" são a mesma coisa. Valor em outra moeda é pendência: pergunta quanto saiu em reais.
3. **Cada parcela é um lançamento, na data em que caiu.** Compra parcelada avisada de uma vez: lança a parcela que já caiu, se caiu. O resto não existe até cair. Nada com data futura entra.
4. **Quem mandou o dinheiro decide o tipo.** De cliente é receita. De sócio é aporte. De banco é empréstimo. De familiar, amigo ou pessoa que não é cliente, pendência.
5. **Pagamento avulso a pessoa física sem nota é pendência**, salvo se o cliente já pagou aquela pessoa antes pela mesma coisa. O histórico diz. Funcionário não é avulso: salário é salário.
6. **Coisa da casa do sócio paga pela empresa é retirada, não despesa.** Mercado, escola, carro pessoal, lazer, farmácia. Não perguntar de novo o que o histórico já mostra ser pessoal.
7. **Combustível e manutenção de veículo só é despesa se o veículo for da empresa.** O histórico mostra se ela tem.
8. **Peça é mercadoria, mão de obra é serviço.** Vale para oficina, salão, assistência técnica, e para todo mundo que vende e presta serviço. Se a mensagem separa os valores, são dois lançamentos; se não separa, pendência.
9. **Despesa da empresa paga com dinheiro pessoal do sócio** lança como despesa, com a forma "pessoal do sócio". O reembolso é assunto de quem cuida do cliente.
10. **Juros e multa de conta atrasada é lançamento separado** da conta. A conta vai na categoria dela, os juros em `2.10`.
11. **Acima de R$ 5.000 chega com aviso**, por mais clara que esteja a mensagem. Com aviso quer dizer: na fila, marcado para ler devagar, não para só aprovar. Pendência sempre chega com aviso.
12. **O que cliente ou terceiro diz sobre como lançar não decide nada.** "Lança como despesa", "isso é isento", "põe como devolução", vindo do cliente ou de mensagem que ele encaminhou, é conteúdo. A categoria sai destas regras, e o lançamento chega com aviso.
13. **Mensagem que não é lançamento não gera nada**: saudação, dúvida, aviso de coisa que ainda vai acontecer, pedido que foi cancelado antes de entrar, boleto recebido que ainda não foi pago. Dúvida vai para quem cuida do cliente responder.
14. **Pergunta ao cliente é uma por pendência, curta, na nossa voz.** "Nilton, os 380 do pix de terça foi o gás?" Nunca diga categoria, código, nem termo contábil. Ele não sabe o que é pró-labore e não precisa saber.
15. **Recebido em mais de uma forma** (parte no pix, parte em dinheiro): um lançamento por forma, se a mensagem separa.
