---
title: Chat e atendimento
---

# Chat e atendimento externo

O chat mostra os mesmos meios de pagamento disponíveis na modal e encaminha o cliente ao grupo nativo do Checkout escolhido. A opção de atendimento humano pode abrir um canal externo em nova aba.

## Configurar WhatsApp, Zendesk ou CRM

Configure uma URL segura no objeto `S`:

```js
chatHumanLabel: 'Falar com nossa equipe',
chatHumanUrl: 'https://wa.me/5511999999999?text=Preciso%20de%20ajuda%20com%20meu%20pagamento',
```

Também funciona com uma central de ajuda ou formulário externo:

```js
chatHumanUrl: 'https://empresa.zendesk.com/hc/pt-br',
```

O campo aceita URLs iniciadas em `https://` ou `http://`. Quando vazio ou inválido, o chat informa que o atendimento será conectado, mas não redireciona o cliente.

## Próxima evolução

O dashboard próprio do PaySave poderá criar sessões de atendimento e enviar contexto não sensível: `orderFormId`, primeiro item, valor, método selecionado e origem da recusa. Nunca envie número de cartão, CVV, token ou conteúdo técnico desnecessário do gateway.