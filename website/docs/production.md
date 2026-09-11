---
title: Produção
---

# Checklist de produção

1. Execute `npm test` na raiz do repositório.
2. Valide todos os meios na workspace de desenvolvimento.
3. Confirme que o modal aparece uma vez e que a mesma recusa não reabre após fechamento.
4. Confirme a política de alerta nativo com `hideNativeDeclineMessage`.
5. Publique e instale a versão em uma janela de baixo tráfego.
6. Monitore os eventos e erros do Checkout.
7. Mantenha uma versão anterior disponível para rollback.

```bash
vtex publish
vtex deploy
vtex install FORNECEDOR.paysave@1.x
```

Para interromper o experimento, publique uma versão com `enabled: false` ou reinstale a versão anterior.