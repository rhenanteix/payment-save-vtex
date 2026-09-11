---
title: Validação
---

# Validar com segurança

## Teste de interface

Em uma URL de workspace, adicione `cr-debug=1`:

```text
https://paysave-test--NOME-DA-CONTA.myvtex.com/checkout?cr-debug=1#/payment
```

O modal abre sem enviar pagamento. O botão `PaySave` no canto inferior da workspace também simula uma recusa quando o modal está fechado.

## Checklist

1. Use carrinho com produto, identificação e entrega preenchidas para carregar os métodos reais.
2. Confirme nome, textos, cores e ícones.
3. Selecione cada alternativa e confirme que o Checkout abre a opção nativa correta.
4. Verifique eventos `paysave_*` em `window.dataLayer`.
5. Para uma recusa real, use somente cartão de teste ou sandbox fornecido pelo gateway.

Não use limite de cartão real como cenário de homologação: uma autorização pode ser aprovada por regras do banco que não são visíveis no Checkout.