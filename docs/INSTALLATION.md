# Instalação do PaySave

Este guia instala o PaySave no Checkout v6 de uma conta VTEX. O aplicativo só altera a interface depois de uma recusa de pagamento: ele não coleta dados sensíveis nem processa pagamentos.

## Antes de começar

- Tenha perfil de administrador da conta VTEX.
- Use uma conta ou workspace de desenvolvimento para a primeira validação.
- Confirme que a loja usa Checkout v6.
- Peça ao fornecedor o identificador da versão publicada, por exemplo `FORNECEDOR.paysave@1.x`.

## Instalação no workspace de desenvolvimento

```bash
npm install -g vtex
vtex login NOME-DA-CONTA
vtex use workspace-paysave
vtex install FORNECEDOR.paysave@1.x
```

Abra `https://workspace-paysave--NOME-DA-CONTA.myvtex.com/checkout` e monte um carrinho de teste. O PaySave é injetado automaticamente pelo builder `checkout-ui-custom`.

## Publicação para parceiros

Somente o vendor proprietário do app pode publicar versões instaláveis por outras contas. No repositório do fornecedor:

```bash
vtex login CONTA-DO-FORNECEDOR
vtex publish
vtex deploy
```

Após a publicação, o fornecedor deve informar o identificador exato da app aos parceiros. Cada parceiro instala esse identificador na própria conta com `vtex install`.

## Produção

Depois da validação descrita em [VALIDATION.md](VALIDATION.md), instale a versão aprovada no workspace `master`:

```bash
vtex use master
vtex install FORNECEDOR.paysave@1.x
```

Para interromper o experimento, reinstale a versão anterior conhecida ou publique uma nova versão com `enabled: false` na configuração do PaySave.

## Configuração por loja

O modal lê os grupos presentes em `orderForm.paymentData.paymentSystems`. Na Trocafone, os grupos reconhecidos são Pix, Pagaleve Pix Mensal Transparente, Nubank/NuPay e cartão de crédito. Para uma loja com grupos diferentes, configure `paymentMethods` em `checkout-ui-custom/checkout6-custom.js` com o seletor da opção nativa do Checkout.

O PaySave não cria novos meios de pagamento; apenas encaminha o cliente para a opção já habilitada pela loja.