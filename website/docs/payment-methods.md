---
title: Métodos de pagamento
---

# Métodos dinâmicos

O PaySave lê `orderForm.paymentData.paymentSystems`. Em contas que expõem esses grupos, reconhece Pix, Pagaleve, Nubank e cartão de crédito. Boleto não é incluído.

Para outra loja, use um fallback quando o grupo não for reconhecido:

```js
paymentMethods: [
  {
    id: 'wallet',
    label: 'Pagar com carteira',
    description: 'Use seu saldo disponível',
    selector: '[data-payment-group="walletPaymentGroup"]',
    toast: 'Carteira selecionada',
  },
]
```

O seletor deve apontar para uma opção que já existe no Checkout. O PaySave não cria nem processa meios de pagamento.