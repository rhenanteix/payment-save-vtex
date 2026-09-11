---
title: E-mail e API de recuperação
---

# Recuperação pós-abandono

Uma recusa pode acontecer antes de existir um pedido no OMS, então a Orders API não é o gatilho do e-mail. Use uma API backend própria para registrar a recusa e chamar o provedor de e-mail ou CRM.

```js
app.post('/recovery-email', async (request, response) => {
  const {email, orderFormId, checkoutUrl} = request.body
  await emailProvider.send({
    to: email,
    template: 'payment-recovery',
    data: {orderFormId, checkoutUrl},
  })
  response.status(202).json({accepted: true})
})
```

Proteja a rota com autenticação, limite de requisições, validação de origem e idempotência por `orderFormId + transactionId`. Chaves do provedor ficam apenas no servidor. Respeite a base legal e as obrigações de LGPD aplicáveis à comunicação.