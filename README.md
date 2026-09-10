# PaySave — VTEX IO App

Modal de recuperação de vendas para o **Checkout v6 da VTEX**. Quando uma transação é recusada pelo gateway, exibe automaticamente alternativas de pagamento (Pix, boleto, outro cartão) e um chat de suporte — mantendo o pedido reservado e aumentando a taxa de conversão.

> **Versão atual:** `1.0.0` · **Builder:** `pixel 1.x`  
> O diretório `dist/` contém o **protótipo navegável** para apresentações. A pasta `pixel/` contém o **app VTEX IO real**.

---

## Estrutura do repositório

```text
paysave-vtex/
├── manifest.json              ← identidade e configurações do app VTEX IO
├── pixel/
│   ├── paysave.js     ← script principal (injetado pelo builder pixel)
│   └── paysave.css    ← estilos do modal (prefixo cr- para isolamento)
├── dist/                      ← protótipo estático para demo/apresentação
│   ├── index.html
│   ├── styles.css
│   └── app.js
└── README.md
```

---

## Como funciona na VTEX real

1. O parceiro instala o app na conta dele via `vtex install`.
2. O builder `pixel` injeta `paysave.js` e `paysave.css` automaticamente em todas as páginas da loja.
3. O script aguarda o jQuery nativo do Checkout v6 e escuta o evento `orderFormUpdated.vtex`.
4. Quando detecta uma transação recusada (`denied`, `voided`, `cancelled`), exibe o modal **uma única vez** por tentativa.
5. O cliente escolhe uma alternativa; o script clica na tab correta do Checkout v6 nativo.
6. Os eventos são enviados para `window.dataLayer` (compatível com GA4/GTM).

---

## Instalação para parceiros

### Pré-requisitos

```bash
npm install -g vtex   # instala o VTEX Toolbelt (uma vez)
```

### 1. Instalar o app

```bash
vtex login NOME-DA-CONTA
vtex install myvendor.paysave@1.x
```

### 2. Configurar no Admin VTEX

Acesse **Admin → Apps → PaySave → Configurações** e ajuste:

| Campo | Padrão | Descrição |
|---|---|---|
| Ativar PaySave | `true` | Feature flag de emergência |
| Tempo de reserva (min) | `10` | Countdown exibido no modal |
| Mostrar badge Pix | `false` | Badge promocional na opção Pix |
| Label do badge Pix | `15% OFF` | Texto do badge |
| Nome da assistente | `Nina` | Nome no chat de suporte |
| Enviar para dataLayer | `true` | Integração com GTM/GA4 |

---

## Desenvolvimento e testes

### Publicar em workspace dev

```bash
vtex use dev        # cria workspace de desenvolvimento
vtex link           # publica em tempo real (hot reload)
```

Acesse `https://CONTA--dev.myvtex.com/checkout` e adicione `?cr-debug=1` para forçar a abertura do modal durante testes.

### Verificar integração

No workspace dev, um botão discreto **"▼ PaySave"** aparece na borda inferior da página com o painel de métricas e timeline de eventos.

### Publicar para produção

```bash
vtex publish        # publica versão no registro VTEX IO
vtex deploy         # disponibiliza no App Store (requer conta parceiro)
```

---

## Eventos disparados (dataLayer / GA4)

| Evento | Quando dispara |
|---|---|
| `paysave_paysave_loaded` | Script carregado |
| `paysave_payment_declined` | Transação recusada detectada |
| `paysave_recovery_modal_view` | Modal exibido |
| `paysave_recovery_option_selected` | Usuário clicou em uma alternativa |
| `paysave_checkout_recovered` | Pedido recuperado com novo método |
| `paysave_recovery_chat_open` | Chat de suporte aberto |
| `paysave_chat_quick_reply` | Resposta rápida enviada |

---

## Regras de segurança (obrigatórias)

- ✅ Nunca captura número de cartão, CVV ou tokens
- ✅ Não repete a chamada de autorização automaticamente
- ✅ Não exibe para erros de estoque, endereço ou frete
- ✅ Exibe **uma única vez** por transação (flag por `transactionId`)
- ✅ Usa prefixo `cr-` em todas as classes CSS (sem colisão)
- ✅ Feature flag no Admin para desativação imediata sem redeploy

---

## Protótipo navegável (demo)

Para apresentações e validação visual sem conta VTEX:

```bash
# Python
python3 -m http.server 4173 --directory dist
# Acesse: http://localhost:4173

# Node.js
npx serve dist
```

**Fluxo de teste:**
1. Abra a página
2. Mantenha "Cartão de crédito" selecionado
3. Clique em "Simular recusa do pagamento"
4. Teste Pix, boleto, outro cartão e o assistente
5. Abra "Ver eventos do funil" para acompanhar a timeline

---

## Próximos passos sugeridos

- [ ] Integrar com a API de Orders da VTEX para enviar e-mail de recuperação
- [ ] Adicionar suporte a split payment (dois cartões)
- [ ] Criar webhook para notificar o parceiro sobre recuperações
- [ ] A/B test entre variantes do modal via settings
