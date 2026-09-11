---
title: Analytics
---

# Eventos para GA4 e GTM

O PaySave envia eventos para `window.dataLayer` quando ela está disponível.

| Evento | Momento |
|---|---|
| `paysave_paysave_loaded` | Script carregado. |
| `paysave_payment_declined` | Recusa confirmada. |
| `paysave_recovery_modal_view` | Modal mostrado. |
| `paysave_recovery_option_selected` | Método escolhido. |
| `paysave_checkout_recovered` | Cliente foi encaminhado a uma alternativa. |
| `paysave_recovery_chat_open` | Chat aberto. |

No GTM, crie acionadores de Evento Personalizado para esses nomes e envie para GA4 com campos como `source`, `option` e `new_method`.