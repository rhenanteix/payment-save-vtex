---
title: Recusas detectadas
---

# Quando o modal abre

| Sinal | Tratamento |
|---|---|
| `denied`, `voided`, `cancelled` no `orderForm` | Abre o modal. |
| `transactionValidation.vtex` com `status: denied` | Abre o modal. |
| Erro de transação $4xx$ ou $5xx$ | Abre o modal. |
| Resposta $2xx$ com `status:denied` | Abre o modal. |
| Aviso nativo VTEX/Tuna com `status:denied` | Fallback para abrir o modal. |

Estados `approved`, `authorized` e `pending` não acionam o PaySave. A mesma recusa é tratada uma única vez por `transactionId`, `Tid` ou `paymentId` durante a sessão.