---
sidebar_position: 1
title: Visão geral
slug: /
---

# PaySave para Checkout VTEX

O PaySave exibe opções de recuperação depois que o gateway recusa um pagamento no Checkout v6 da VTEX. Ele não coleta cartão, CVV, token nem autoriza pagamentos. A VTEX e a adquirente continuam sendo responsáveis pela decisão financeira.

## O fluxo

1. A VTEX recebe a tentativa de pagamento.
2. O gateway devolve uma recusa confirmada.
3. O PaySave identifica a recusa e mostra um modal uma vez para aquela tentativa.
4. O cliente escolhe Pix, outro cartão, NuPay, Pagaleve ou outra alternativa já habilitada pela loja.
5. O PaySave seleciona o grupo nativo correspondente no Checkout.

## Requisitos

- Conta VTEX IO com acesso para instalar e vincular apps.
- Checkout v6 habilitado.
- Pelo menos uma forma alternativa de pagamento configurada na conta.
- Ambiente de workspace para validar antes de publicar.

:::important
Uma recusa pode ocorrer antes da criação de um pedido no OMS. Por isso, o PaySave trabalha com eventos e `orderForm` do Checkout, não com a Orders API para decidir quando abrir o modal.
:::