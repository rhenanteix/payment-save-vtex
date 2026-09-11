---
title: Configuração
---

# Configuração do PaySave

As opções ficam no objeto `S` em `checkout-ui-custom/checkout6-custom.js`.

```js
enabled: true,
assistantName: 'Nina',
primaryColor: '#e50046',
primaryLightColor: '#fff0f4',
accentColor: '#004e70',
chatHumanUrl: 'https://empresa.example/atendimento',
hideNativeDeclineMessage: true,
enableSplitPayment: false,
```

## Parâmetros principais

| Campo | Finalidade |
|---|---|
| `enabled` | Liga ou desliga o PaySave na versão instalada. |
| `assistantName` | Nome mostrado no chat. |
| `modalTitle` e `modalDescription` | Conteúdo do modal. |
| `primaryColor`, `primaryLightColor`, `accentColor` | Cores da experiência. |
| `chatGreeting` e `chatPaymentTitle` | Mensagens iniciais do atendimento. |
| `chatHumanLabel` | Texto do botão de atendimento humano. |
| `chatHumanUrl` | URL `https` ou `http` para WhatsApp, Zendesk, CRM ou outro canal. |
| `hideNativeDeclineMessage` | Oculta o alerta financeiro duplicado da VTEX após o PaySave abrir. |
| `enableSplitPayment` | Mostra dois cartões somente se a conta oferecer o recurso nativo. |

Depois de alterar, use `vtex link` e faça uma recarga completa no Checkout.

:::tip
As cores padrão seguem a identidade visual usada no piloto atual. Cada parceiro pode trocar os três campos de cor e todos os textos antes de publicar sua versão.
:::