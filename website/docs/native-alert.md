---
title: Alerta nativo VTEX
---

# Alerta do gateway

O alerta da VTEX/Tuna não pode ser desativado no gateway pelo PaySave. Ele registra a decisão financeira. O que pode ser controlado é a camada visual duplicada depois que o PaySave assume o fluxo.

```js
hideNativeDeclineMessage: true
```

Com `true`, o PaySave oculta somente o contêiner que mostra uma recusa de pagamento. Alertas de estoque, frete, endereço e entrega continuam visíveis. Com `false`, ambos os avisos ficam disponíveis.

:::caution
Não oculte mensagens de erro genéricas por seletores globais. A regra deve continuar limitada a recusa de pagamento confirmada.
:::