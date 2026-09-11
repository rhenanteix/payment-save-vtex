---
title: Dois cartões
---

# Split payment nativo

O PaySave pode encaminhar para o split payment nativo, mas não divide valores nem processa cartões.

```js
enableSplitPayment: true,
splitPaymentSelector: '.SELETOR-DO-CONTROLE-NATIVO',
```

1. Confirme no Checkout da conta que existe uma opção de adicionar segundo cartão.
2. Inspecione o botão e defina o seletor em `splitPaymentSelector`.
3. Ative `enableSplitPayment` na workspace.
4. Selecione “Pagar com dois cartões” no PaySave.
5. Valide que o Checkout, e não o PaySave, solicita valores e cartões.

Mantenha o recurso desligado em contas que não oferecem esse fluxo nativamente.