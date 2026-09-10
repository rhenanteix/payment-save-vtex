/**
 * PaySave — VTEX IO Pixel App
 * vendor: myvendor | version: 1.0.0
 *
 * Este script é injetado em todas as páginas da loja pelo builder pixel.
 * Ele escuta eventos nativos do Checkout v6 da VTEX e exibe o modal de
 * recuperação quando uma transação é recusada.
 *
 * ─── Eventos monitorados ──────────────────────────────────────────────
 *  orderFormUpdated.vtex   → dispara toda vez que o orderForm muda
 *  transactionValidation.vtex → dispara ao finalizar uma tentativa
 *
 * ─── NÃO faz ──────────────────────────────────────────────────────────
 *  - Capturar dados de cartão, CVV ou tokens
 *  - Repetir automaticamente a chamada de autorização
 *  - Exibir o modal para erros de estoque, endereço ou frete
 */

;(function () {
  'use strict'

  /* ────────────────────────────────────────────────────────────────────
   * 1. GUARD: só executa no Checkout v6
   * ────────────────────────────────────────────────────────────────────*/
  var isCheckout =
    window.location.pathname.indexOf('/checkout') === 0 &&
    window.location.pathname.indexOf('/_v/segment/graphql/v1') === -1

  if (!isCheckout) return

  /* ────────────────────────────────────────────────────────────────────
   * 2. SETTINGS — injetados pelo settingsSchema via (window.__cr_settings || globalThis.__cr_settings)
   *    Fallback para valores padrão se o admin não configurou.
   * ────────────────────────────────────────────────────────────────────*/
  var S = Object.assign(
    {
      enabled: true,
      reservationMinutes: 10,
      showPixDiscount: false,
      pixDiscountLabel: '15% OFF',
      assistantName: 'Nina',
      sendAnalytics: true,
    },
    (window.__cr_settings || globalThis.__cr_settings) || {}
  )

  if (!S.enabled) return // feature flag de emergência

  /* ────────────────────────────────────────────────────────────────────
   * 3. ESTADO INTERNO
   * ────────────────────────────────────────────────────────────────────*/
  var state = {
    modalShownForTransaction: null, // evita exibir duas vezes na mesma tentativa
    events: [],
    declines: 0,
    recoveries: 0,
    timer: null,
    secondsLeft: S.reservationMinutes * 60,
    currentOrderForm: null,
  }

  /* ────────────────────────────────────────────────────────────────────
   * 4. UTILITÁRIOS
   * ────────────────────────────────────────────────────────────────────*/
  function qs(sel, ctx) {
    return (ctx || document).querySelector(sel)
  }
  function qsa(sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel))
  }

  function pushEvent(name, data) {
    var entry = {
      name: name,
      data: data || {},
      time: new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    }
    state.events.unshift(entry)

    // GA4 / GTM via dataLayer
    if (S.sendAnalytics && Array.isArray(window.dataLayer)) {
      window.dataLayer.push(
        Object.assign({ event: 'paysave_' + name }, data || {})
      )
    }

    renderMetrics()
  }

  function showToast(text) {
    var el = qs('#cr-toast')
    if (!el) return
    el.textContent = text
    el.classList.remove('cr-hidden')
    setTimeout(function () {
      el.classList.add('cr-hidden')
    }, 2800)
  }

  function pad(n) {
    return String(n).padStart(2, '0')
  }

  /* ────────────────────────────────────────────────────────────────────
   * 5. DETECÇÃO DE RECUSA — baseada no orderForm real da VTEX
   *
   *  A VTEX retorna mensagens de erro em orderForm.messages[].status
   *  ou em orderForm.paymentData.transactions[].isActive + código do gateway.
   *  Também escutamos o evento transactionValidation.vtex como fallback.
   * ────────────────────────────────────────────────────────────────────*/

  // Códigos de recusa conhecidos retornados pelo gateway VTEX
  var DENIAL_REASON_CODES = ['51', '14', '54', '57', '61', '62', '65', '91']

  // Mensagens de status que indicam recusa no orderForm.messages
  var DENIAL_MESSAGE_PATTERNS = [
    'denied',
    'declined',
    'recusad',
    'negad',
    'não autorizado',
    'nao autorizado',
    'reprovad',
  ]

  function isPaymentDenied(orderForm) {
    if (!orderForm) return false

    // Verifica mensagens do sistema
    var msgs = orderForm.messages || []
    for (var i = 0; i < msgs.length; i++) {
      var txt = (msgs[i].text || '').toLowerCase()
      for (var j = 0; j < DENIAL_MESSAGE_PATTERNS.length; j++) {
        if (txt.indexOf(DENIAL_MESSAGE_PATTERNS[j]) !== -1) return true
      }
    }

    // Verifica status de transações ativas
    var payData = orderForm.paymentData || {}
    var transactions = payData.transactions || []
    for (var t = 0; t < transactions.length; t++) {
      var tx = transactions[t]
      if (
        tx.isActive &&
        tx.transactionId &&
        tx.merchantName &&
        payData.payments
      ) {
        // Se há transação ativa mas o orderForm ainda está na etapa de pagamento,
        // e existe um código de recusa nas mensagens — considera recusado
        var txStatus = (tx.status || '').toLowerCase()
        if (
          txStatus === 'denied' ||
          txStatus === 'voided' ||
          txStatus === 'cancelled'
        ) {
          return true
        }
      }
    }

    return false
  }

  /* ────────────────────────────────────────────────────────────────────
   * 6. INJEÇÃO DO HTML DO MODAL
   *    Inserido dinamicamente no <body> para não interferir com o checkout.
   * ────────────────────────────────────────────────────────────────────*/
  function injectModal() {
    if (qs('#cr-root')) return // já injetado

    var pixBadge = S.showPixDiscount
      ? '<em class="cr-pix-badge">' + S.pixDiscountLabel + '</em>'
      : ''

    var html = [
      '<div id="cr-root">',

      // Backdrop
      '<div id="cr-backdrop" class="cr-backdrop cr-hidden"></div>',

      // Modal de recuperação
      '<section id="cr-modal" class="cr-modal cr-hidden" role="dialog" aria-modal="true" aria-labelledby="cr-modal-title">',
      '  <button class="cr-close" id="cr-close-btn" aria-label="Fechar">&times;</button>',
      '  <div class="cr-status-icon">!</div>',
      '  <span class="cr-eyebrow cr-danger">NÃO FOI POSSÍVEL APROVAR O PAGAMENTO</span>',
      '  <h2 id="cr-modal-title">Seu pedido ainda está reservado</h2>',
      '  <p class="cr-lead">Não se preocupe: isso pode acontecer por segurança do banco. Você pode tentar novamente ou escolher outra forma de pagamento.</p>',
      '  <div class="cr-reservation">',
      '    <span>&#9201;</span>',
      '    <div>',
      '      <strong>Reserva por mais <b id="cr-countdown">' + pad(S.reservationMinutes) + ':00</b></strong>',
      '      <small id="cr-product-name">Seu produto continua separado para você.</small>',
      '    </div>',
      '  </div>',
      '  <h3>Escolha a melhor alternativa</h3>',
      '  <div class="cr-options">',
      '    <button data-cr-action="pix">',
      '      <span class="cr-method-icon cr-pix">&#9674;</span>',
      '      <span><strong>Pagar com Pix</strong><small>Aprovação rápida · copie ou escaneie</small></span>',
      '      ' + pixBadge,
      '      <b>&#8250;</b>',
      '    </button>',
      '    <button data-cr-action="retry">',
      '      <span class="cr-method-icon cr-card">&#9635;</span>',
      '      <span><strong>Tentar outro cartão</strong><small>Use um cartão diferente ou revise os dados</small></span>',
      '      <b>&#8250;</b>',
      '    </button>',
      '    <button data-cr-action="boleto">',
      '      <span class="cr-method-icon cr-boleto">&#9636;</span>',
      '      <span><strong>Gerar boleto</strong><small>Vencimento amanhã · confirmação em até 2 dias</small></span>',
      '      <b>&#8250;</b>',
      '    </button>',
      '  </div>',
      '  <button id="cr-talk-now" class="cr-support-link">&#9685; Quero ajuda para concluir minha compra</button>',
      '  <p class="cr-reason-code" id="cr-reason-code">Tentativa de pagamento não autorizada.</p>',
      '</section>',

      // Chat
      '<aside id="cr-chat" class="cr-chat cr-hidden" aria-label="Assistente de compra">',
      '  <header>',
      '    <div class="cr-agent-avatar" aria-hidden="true">' + S.assistantName[0].toUpperCase() + '</div>',
      '    <div>',
      '      <strong>' + S.assistantName + ' &middot; Assistente de compra</strong>',
      '      <span><i></i> Online agora</span>',
      '    </div>',
      '    <button id="cr-chat-close" data-cr-chat-close aria-label="Fechar chat">&times;</button>',
      '  </header>',
      '  <div id="cr-messages" class="cr-messages">',
      '    <div class="cr-bot-msg">',
      '      Olá! Vi que o banco não aprovou a tentativa, mas seu pedido continua reservado. Posso te ajudar a concluir?',
      '      <time>agora</time>',
      '    </div>',
      '    <div class="cr-quick-actions">',
      '      <button data-cr-chat-action="pix">Quero pagar com Pix</button>',
      '      <button data-cr-chat-action="card">Tentar outro cartão</button>',
      '      <button data-cr-chat-action="human">Falar com uma pessoa</button>',
      '    </div>',
      '  </div>',
      '  <form id="cr-chat-form">',
      '    <input id="cr-chat-input" placeholder="Digite sua mensagem..." aria-label="Mensagem">',
      '    <button type="submit" aria-label="Enviar">&#10148;</button>',
      '  </form>',
      '</aside>',

      // Chat launcher (FAB)
      '<button id="cr-launcher" class="cr-launcher cr-hidden" aria-label="Falar com assistente">',
      '  <span aria-hidden="true">&#9685;</span>',
      '  <span>Precisa de ajuda?<small>Fale com a gente</small></span>',
      '  <b id="cr-badge" class="cr-hidden" aria-label="1 mensagem">1</b>',
      '</button>',

      // Painel de métricas
      '<aside id="cr-metrics" class="cr-metrics cr-hidden" aria-label="Painel de métricas">',
      '  <header>',
      '    <div><span class="cr-eyebrow">CHECKOUT RESCUE</span><h2>Eventos da recuperação</h2></div>',
      '    <button id="cr-metrics-close" aria-label="Fechar painel">&times;</button>',
      '  </header>',
      '  <p>Eventos desta sessão — os mesmos que seriam enviados ao GA4/GTM.</p>',
      '  <div class="cr-metric-row">',
      '    <div><small>RECUSAS</small><strong id="cr-declines">0</strong></div>',
      '    <div><small>RECUPERAÇÕES</small><strong id="cr-recoveries">0</strong></div>',
      '    <div><small>TAXA</small><strong id="cr-rate">0%</strong></div>',
      '  </div>',
      '  <div class="cr-event-head"><strong>Timeline</strong><button id="cr-clear-events">Limpar</button></div>',
      '  <div id="cr-event-log" class="cr-event-log"><p class="cr-empty">Nenhum evento ainda.</p></div>',
      '</aside>',

      // Toast
      '<div id="cr-toast" class="cr-toast cr-hidden" role="status" aria-live="polite"></div>',

      '</div>', // #cr-root
    ].join('\n')

    var wrapper = document.createElement('div')
    wrapper.innerHTML = html
    document.body.appendChild(wrapper.firstChild)

    bindEvents()
  }

  /* ────────────────────────────────────────────────────────────────────
   * 7. ABRIR / FECHAR MODAL
   * ────────────────────────────────────────────────────────────────────*/
  function openModal(orderForm) {
    injectModal()

    // Personaliza com dados reais do orderForm
    if (orderForm) {
      state.currentOrderForm = orderForm
      var items = (orderForm.items || [])
      var firstName = ''
      try {
        firstName = ((orderForm.clientProfileData || {}).firstName || '').split(' ')[0]
      } catch (e) {}

      // Atualiza nome do produto
      var productNameEl = qs('#cr-product-name')
      if (productNameEl && items.length > 0) {
        productNameEl.textContent =
          (firstName ? firstName + ', seu ' : 'Seu ') +
          (items[0].name || 'produto') +
          ' continua separado para você.'
      }

      // Atualiza saudação no chat
      var firstMsg = qs('#cr-messages .cr-bot-msg')
      if (firstMsg && firstName) {
        firstMsg.innerHTML =
          'Olá, ' + firstName + '! Vi que o banco não aprovou a tentativa, ' +
          'mas seu pedido continua reservado. Posso te ajudar a concluir?' +
          '<time>agora</time>'
      }

      // Código de recusa real (se disponível nas mensagens)
      var messages = orderForm.messages || []
      if (messages.length > 0) {
        var rcEl = qs('#cr-reason-code')
        if (rcEl) rcEl.textContent = messages[0].text || 'Tentativa de pagamento não autorizada.'
      }
    }

    qs('#cr-backdrop').classList.remove('cr-hidden')
    qs('#cr-modal').classList.remove('cr-hidden')
    qs('#cr-badge') && qs('#cr-badge').classList.remove('cr-hidden')

    startCountdown()
    pushEvent('recovery_modal_view', { variant: 'modal_v1' })
  }

  function closeModal() {
    clearInterval(state.timer)
    var modal = qs('#cr-modal')
    var backdrop = qs('#cr-backdrop')
    if (modal) modal.classList.add('cr-hidden')
    if (backdrop) backdrop.classList.add('cr-hidden')
  }

  /* ────────────────────────────────────────────────────────────────────
   * 8. CONTAGEM REGRESSIVA
   * ────────────────────────────────────────────────────────────────────*/
  function startCountdown() {
    clearInterval(state.timer)
    state.secondsLeft = S.reservationMinutes * 60

    var cdEl = qs('#cr-countdown')
    state.timer = setInterval(function () {
      state.secondsLeft--
      if (cdEl) {
        cdEl.textContent =
          pad(Math.floor(state.secondsLeft / 60)) +
          ':' +
          pad(state.secondsLeft % 60)
      }
      if (state.secondsLeft <= 0) clearInterval(state.timer)
    }, 1000)
  }

  /* ────────────────────────────────────────────────────────────────────
   * 9. AÇÃO DE RECUPERAÇÃO
   *    Fecha o modal e direciona para o método escolhido.
   *    No Checkout v6 nativo, trocar o método = clicar na tab correta.
   * ────────────────────────────────────────────────────────────────────*/
  function recover(action) {
    pushEvent('recovery_option_selected', { option: action })
    closeModal()

    // Tenta clicar na tab de pagamento correta do Checkout v6 nativo
    var tabSelectors = {
      pix: '[data-payment-group="instantPaymentPaymentGroup"]',
      boleto: '[data-payment-group="bankInvoicePaymentGroup"]',
      retry: '.paymentGroupItem.creditCard, [data-payment-group="creditCardPaymentGroup"]',
    }

    var selector = tabSelectors[action]
    if (selector) {
      var tab = qs(selector)
      if (tab) {
        tab.click()
        setTimeout(function () {
          // Scroll para o formulário de pagamento
          var form = qs('#payment-data') || qs('.payment-option')
          if (form) form.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 300)
      }
    }

    state.recoveries++
    renderMetrics()

    var messages = {
      pix: 'Pix selecionado — seu pedido continua reservado',
      boleto: 'Boleto selecionado — pedido preservado',
      retry: 'Você pode informar um novo cartão',
    }
    showToast(messages[action] || 'Método atualizado')
    pushEvent('checkout_recovered', { new_method: action })
  }

  /* ────────────────────────────────────────────────────────────────────
   * 10. CHAT
   * ────────────────────────────────────────────────────────────────────*/
  function openChat() {
    closeModal()
    var chat = qs('#cr-chat')
    var launcher = qs('#cr-launcher')
    var badge = qs('#cr-badge')
    if (chat) chat.classList.remove('cr-hidden')
    if (launcher) launcher.classList.add('cr-hidden')
    if (badge) badge.classList.add('cr-hidden')
    pushEvent('recovery_chat_open', { source: 'checkout' })
  }

  function botReply(text) {
    var msgs = qs('#cr-messages')
    if (!msgs) return
    var div = document.createElement('div')
    div.className = 'cr-bot-msg'
    div.innerHTML = text + '<time>agora</time>'
    msgs.appendChild(div)
    msgs.scrollTop = msgs.scrollHeight
  }

  /* ────────────────────────────────────────────────────────────────────
   * 11. MÉTRICAS / EVENTOS
   * ────────────────────────────────────────────────────────────────────*/
  function renderMetrics() {
    var log = qs('#cr-event-log')
    if (!log) return

    log.innerHTML = state.events.length
      ? state.events
          .map(function (e) {
            var dataStr = Object.keys(e.data)
              .map(function (k) { return k + ': ' + e.data[k] })
              .join(' · ') || '—'
            return (
              '<div class="cr-event">' +
              '<b>' + e.name + '</b>' +
              '<span>' + e.time + '</span>' +
              '<br>' + dataStr +
              '</div>'
            )
          })
          .join('')
      : '<p class="cr-empty">Nenhum evento ainda.</p>'

    var dEl = qs('#cr-declines')
    var rEl = qs('#cr-recoveries')
    var rateEl = qs('#cr-rate')
    if (dEl) dEl.textContent = state.declines
    if (rEl) rEl.textContent = state.recoveries
    if (rateEl)
      rateEl.textContent = state.declines
        ? Math.round((state.recoveries / state.declines) * 100) + '%'
        : '0%'
  }

  /* ────────────────────────────────────────────────────────────────────
   * 12. BIND DE EVENTOS DOM
   * ────────────────────────────────────────────────────────────────────*/
  function bindEvents() {
    // Fechar modal
    var closeBtn = qs('#cr-close-btn')
    var backdrop = qs('#cr-backdrop')
    if (closeBtn) closeBtn.addEventListener('click', closeModal)
    if (backdrop) backdrop.addEventListener('click', closeModal)

    // Opções de recuperação
    qsa('[data-cr-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        recover(btn.getAttribute('data-cr-action'))
      })
    })

    // Chat
    var talkBtn = qs('#cr-talk-now')
    var launcherBtn = qs('#cr-launcher')
    var chatCloseBtn = qs('#cr-chat-close')
    if (talkBtn) talkBtn.addEventListener('click', openChat)
    if (launcherBtn) launcherBtn.addEventListener('click', openChat)
    if (chatCloseBtn)
      chatCloseBtn.addEventListener('click', function () {
        var chat = qs('#cr-chat')
        var launcher = qs('#cr-launcher')
        if (chat) chat.classList.add('cr-hidden')
        if (launcher) launcher.classList.remove('cr-hidden')
      })

    // Quick replies do chat
    qsa('[data-cr-chat-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.getAttribute('data-cr-chat-action')
        pushEvent('chat_quick_reply', { reply: action })
        if (action === 'pix') {
          botReply('Perfeito! Vou selecionar Pix para você. Clique no método Pix para confirmar.')
          recover('pix')
          state.recoveries++
          renderMetrics()
        } else if (action === 'card') {
          botReply('Sem problema. Informe os dados do outro cartão. Seu pedido continua reservado.')
          recover('retry')
        } else {
          botReply('Certo! Estou chamando alguém do nosso time. Tempo médio de resposta: 1 minuto.')
        }
      })
    })

    // Formulário de chat (mensagem livre)
    var chatForm = qs('#cr-chat-form')
    if (chatForm) {
      chatForm.addEventListener('submit', function (e) {
        e.preventDefault()
        var input = qs('#cr-chat-input')
        if (!input || !input.value.trim()) return
        var msgs = qs('#cr-messages')
        var div = document.createElement('div')
        div.className = 'cr-user-msg'
        div.innerHTML =
          input.value.replace(/[<>]/g, '') + '<time>agora</time>'
        if (msgs) msgs.appendChild(div)
        pushEvent('chat_message_sent')
        input.value = ''
        setTimeout(function () {
          botReply('Entendi. Posso manter seu pedido reservado enquanto ajudamos você com o pagamento.')
        }, 600)
      })
    }

    // Métricas
    var metricsClose = qs('#cr-metrics-close')
    var clearEvents = qs('#cr-clear-events')
    if (metricsClose)
      metricsClose.addEventListener('click', function () {
        qs('#cr-metrics').classList.add('cr-hidden')
      })
    if (clearEvents)
      clearEvents.addEventListener('click', function () {
        state.events = []
        state.declines = 0
        state.recoveries = 0
        renderMetrics()
      })
  }

  /* ────────────────────────────────────────────────────────────────────
   * 13. ESCUTA DE EVENTOS NATIVOS DO CHECKOUT V6
   * ────────────────────────────────────────────────────────────────────*/

  // Evento primário: orderForm atualizado
  ;(window.$ || window.jQuery) &&
    (window.$ || window.jQuery)(window).on(
      'orderFormUpdated.vtex',
      function (evt, orderForm) {
        if (!orderForm) return

        // Só exibe se for uma transação nova (não o mesmo transactionId)
        var txId = null
        try {
          var txs = orderForm.paymentData.transactions
          if (txs && txs.length > 0) txId = txs[0].transactionId
        } catch (e) {}

        if (txId && txId === state.modalShownForTransaction) return

        if (isPaymentDenied(orderForm)) {
          state.declines++
          state.modalShownForTransaction = txId
          pushEvent('payment_declined', {
            method: 'creditCard',
            order_form_id: orderForm.orderFormId || 'unknown',
          })
          openModal(orderForm)
        }
      }
    )

  // Evento fallback: transactionValidation (disparado pelo Payment App ou Gateway)
  ;(window.$ || window.jQuery) &&
    (window.$ || window.jQuery)(document).on(
      'transactionValidation.vtex',
      function (evt, data) {
        if (data && data.status === 'denied') {
          state.declines++
          pushEvent('payment_declined', { source: 'transactionValidation' })
          openModal(state.currentOrderForm)
        }
      }
    )

  // Aguarda jQuery ser carregado (o Checkout v6 carrega o jQuery nativo)
  function waitForjQuery(cb, attempts) {
    attempts = attempts || 0
    if (attempts > 20) return // desiste após 10s
    if (window.$ || window.jQuery) {
      cb()
    } else {
      setTimeout(function () {
        waitForjQuery(cb, attempts + 1)
      }, 500)
    }
  }

  /* ────────────────────────────────────────────────────────────────────
   * 14. INICIALIZAÇÃO
   * ────────────────────────────────────────────────────────────────────*/
  function init() {
    injectModal()
    pushEvent('paysave_loaded', { version: '1.0.0' })



    // Adiciona botão de métricas discreta para o parceiro validar
    // (apenas em workspaces dev — verificado pelo hostname)
    var isDevWorkspace = /--/.test(window.location.hostname)
    if (isDevWorkspace) {
      var metricsBtn = document.createElement('button')
      metricsBtn.id = 'cr-metrics-trigger'
      metricsBtn.className = 'cr-metrics-trigger'
      metricsBtn.setAttribute('aria-label', 'Abrir painel PaySave')
      metricsBtn.innerHTML = '&#9660; PaySave'
      metricsBtn.addEventListener('click', function () {
        var panel = qs('#cr-metrics')
        if (panel) {
          panel.classList.toggle('cr-hidden')
          renderMetrics()
        }
      })
      document.body.appendChild(metricsBtn)
    }
  }

  // Executa após o DOM estar pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
