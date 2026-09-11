---
title: Instalação
---

# Instalação no Checkout VTEX

:::tip
Para entender onde cada comando roda e seguir o fluxo completo com diagramas, comece pelo [Guia visual de instalação](./visual-installation.md).
:::

## 1. Instale o Toolbelt

```bash
npm install -g vtex
vtex login NOME-DA-CONTA
```

## 2. Use uma workspace de validação

```bash
vtex use paysave-test
vtex link
```

O link associa o app local à workspace sem publicar em produção. Mantenha o terminal aberto durante o desenvolvimento.

## 3. Acesse o Checkout

```text
https://paysave-test--NOME-DA-CONTA.myvtex.com/checkout
```

O builder `checkout-ui-custom` entrega `checkout6-custom.js` e `checkout6-custom.css` ao Checkout v6.

## 4. Publique quando validado

```bash
vtex publish
vtex deploy
vtex install FORNECEDOR.paysave@1.x
```

Publique com `enabled: false` primeiro, valide uma janela controlada e só então ative uma nova versão.