/**
 * PaySave — VTEX IO Checkout UI Custom App
 * vendor: trocafone | version: 1.0.0
 *
 * Este script é injetado no template do Checkout v6 pelo builder
 * checkout-ui-custom.
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

  var isDevWorkspace = /--/.test(window.location.hostname)

  /* ────────────────────────────────────────────────────────────────────
   * 2. SETTINGS — configuração versionada do template Checkout
   * ────────────────────────────────────────────────────────────────────*/
  var DEFAULT_PAYMENT_METHODS = [
    {
      id: 'pix',
      label: 'Pagar com Pix',
      description: 'Aprovação rápida · copie ou escaneie',
      selector: '#payment-group-instantPaymentPaymentGroup, [data-payment-group="instantPaymentPaymentGroup"]',
      toast: 'Pix selecionado — seu pedido continua reservado',
      iconClass: 'cr-pix',
      icon: '<img class="cr-logo-vtex cr-logo-pix" src="https://io2.vtex.com/checkout-ui/v6.152.1/img/payment-pix-logo.svg" alt="">',
    },
    {
      id: 'retry',
      label: 'Tentar outro cartão',
      description: 'Use um cartão diferente ou revise os dados',
      selector: '#payment-group-creditCardPaymentGroup, .paymentGroupItem.creditCard, [data-payment-group="creditCardPaymentGroup"]',
      toast: 'Você pode informar um novo cartão',
      iconClass: 'cr-card',
      icon: '<img class="cr-logo-vtex cr-logo-card" src="https://io2.vtex.com/checkout-ui/v6.152.1/img/ico-credit2.png" alt="">',
    },
  ]

  var S = Object.assign(
    {
      enabled: true,
      reservationMinutes: 10,
      showPixDiscount: false,
      pixDiscountLabel: '15% OFF',
      assistantName: 'Trocafone Chat',
      modalEyebrow: 'NÃO FOI POSSÍVEL APROVAR O PAGAMENTO',
      modalTitle: 'Seu pedido ainda está reservado',
      modalDescription: 'Não se preocupe: isso pode acontecer por segurança do banco. Você pode tentar novamente ou escolher outra forma de pagamento.',
      optionsTitle: 'Escolha a melhor alternativa',
      supportText: 'Quero ajuda para concluir minha compra',
      chatGreeting: 'Olá! Vi que o banco não aprovou a tentativa, mas seu pedido continua reservado. Posso te ajudar a concluir?',
      chatPaymentTitle: 'Escolha uma opção para continuar com segurança:',
      chatLogoUrl: '',
      chatHumanLabel: 'Falar com o atendimento',
      chatHumanUrl: '',
      chatHumanMessage: 'Posso conectar você ao atendimento da loja para continuar por outro canal.',
      chatProductSuggestions: [],
      chatCatalogSuggestions: true,
      chatCatalogSuggestionsLimit: 3,
      aiEndpoint: '',
      aiRequestTimeoutMs: 5000,
      launcherTitle: 'Precisa de ajuda?',
      launcherSubtitle: 'Fale com a gente',
      primaryColor: '#ff9933',
      primaryLightColor: '#fff4e6',
      accentColor: '#161616',
      paymentMethods: DEFAULT_PAYMENT_METHODS,
      enableSplitPayment: false,
      splitPaymentSelector: '[data-testid="split-payment"], [data-payment-action="split-payment"], .add-payment',
      sendAnalytics: true,
      hideNativeDeclineMessage: true,
    },
    window.__cr_settings || {}
  )

  if (!S.enabled) return // feature flag de emergência

  /* ────────────────────────────────────────────────────────────────────
   * 3. ESTADO INTERNO
   * ────────────────────────────────────────────────────────────────────*/
  var state = {
    handledDeclines: {}, // cada tentativa recusada abre o modal apenas uma vez
    lastNativeDeclineKey: null,
    events: [],
    declines: 0,
    recoveries: 0,
    timer: null,
    secondsLeft: S.reservationMinutes * 60,
    currentOrderForm: null,
    catalogSuggestions: [],
    catalogSuggestionKey: null,
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

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
    })
  }

  function getPaymentMethods(orderForm) {
    var systems = (((orderForm || {}).paymentData || {}).paymentSystems || [])
    var groups = {}
    var methods = []

    systems.forEach(function (system) {
      if (system && system.groupName) groups[system.groupName] = system
    })

    Object.keys(groups).forEach(function (groupName) {
      var system = groups[groupName]
      var systemName = String((system || {}).name || '')
      var method = null

      if (groupName === 'instantPaymentPaymentGroup') {
        method = {
          id: 'pix',
          label: system.name || 'Pix',
          description: 'Aprovação rápida · copie ou escaneie',
          toast: 'Pix selecionado — seu pedido continua reservado',
          iconClass: 'cr-pix',
          icon: '<img class="cr-logo-vtex cr-logo-pix" src="https://io2.vtex.com/checkout-ui/v6.152.1/img/payment-pix-logo.svg" alt="">',
        }
      } else if (/^creditCardPaymentGroup$/i.test(groupName)) {
        method = {
          id: 'credit-card',
          label: 'Cartão de crédito',
          description: 'Use outro cartão ou revise os dados',
          toast: 'Você pode informar um novo cartão',
          iconClass: 'cr-card',
          icon: '<img class="cr-logo-vtex cr-logo-card" src="https://io2.vtex.com/checkout-ui/v6.152.1/img/ico-credit2.png" alt="">',
        }
      } else if (/pagaleve/i.test(groupName) || /pagaleve/i.test(systemName)) {
        method = {
          id: 'pagaleve',
          label: system.name || 'Pix Parcelado',
          description: 'Escolha o parcelamento disponível',
          toast: (system.name || 'Pix Parcelado') + ' selecionado',
          iconClass: 'cr-pagaleve',
          icon: '<img class="cr-logo-vtex cr-logo-pagaleve" src="https://io2.vtex.com/checkout-ui/v6.152.1/img/pagaleve/payment-pagaleve-logo.png" alt="">',
        }
      } else if (/nubank|nupay/i.test(groupName) || /nubank|nupay/i.test(systemName)) {
        method = {
          id: 'nubank',
          label: system.name || 'NuPay',
          description: 'Pague pelo app Nubank',
          toast: (system.name || 'NuPay') + ' selecionado',
          iconClass: 'cr-nubank',
          icon: '<img class="cr-logo-vtex cr-logo-nubank" src="https://io2.vtex.com/checkout-ui/v6.152.1/img/payment-nupay-logo.svg" alt="">',
        }
      }

      if (method) {
        method.groupName = groupName
        methods.push(method)
      }
    })

    if (S.enableSplitPayment && groups.creditCardPaymentGroup) {
      methods.push({
        id: 'split-card',
        label: 'Pagar com dois cartões',
        description: 'Divida o valor entre dois cartões de crédito',
        toast: 'Informe os valores e os dados dos dois cartões',
        iconClass: 'cr-card',
        groupName: 'creditCardPaymentGroup',
        afterSelect: S.splitPaymentSelector,
        icon: '<img class="cr-logo-vtex cr-logo-card" src="https://io2.vtex.com/checkout-ui/v6.152.1/img/ico-credit2.png" alt="">',
      })
    }

    return methods.length ? methods : getConfiguredPaymentMethods()
  }

  function chatPaymentOptionsHtml(orderForm) {
    return getPaymentMethods(orderForm)
      .map(function (method) {
        return [
          '<button class="cr-chat-method" data-cr-chat-method="' + escapeHtml(method.id) + '">',
          '  <span class="cr-method-icon ' + escapeHtml(method.iconClass || 'cr-card') + '">' + (method.icon || '') + '</span>',
          '  <span><strong>' + escapeHtml(method.label) + '</strong><small>' + escapeHtml(method.description || '') + '</small></span>',
          '  <b>&#8250;</b>',
          '</button>',
        ].join('')
      })
      .join('')
  }

  function getChatProductSuggestions() {
    var suggestions = S.chatProductSuggestions
    if (typeof suggestions === 'string') {
      try {
        suggestions = JSON.parse(suggestions)
      } catch (e) {
        suggestions = []
      }
    }
    if (!Array.isArray(suggestions)) suggestions = []
    suggestions = suggestions.filter(function (product) {
      return product && product.id && product.sku && product.name
    })
    if (suggestions.length) return suggestions
    if (state.catalogSuggestions.length) return state.catalogSuggestions
    if (!isDevWorkspace || !isDebugMode()) return suggestions

    var item = ((state.currentOrderForm || {}).items || [])[0]
    if (!item || !item.id || !item.name) return suggestions
    return [{
      id: 'debug-current-cart-item-' + item.id,
      sku: item.id,
      seller: item.seller || '1',
      quantity: 1,
      name: item.name,
      description: 'Demonstração: adicionar mais uma unidade do item atual',
      price: '',
    }]
  }

  function chatProductSuggestionsHtml() {
    var suggestions = getChatProductSuggestions()
    if (!suggestions.length) return ''
    return [
      '<section class="cr-chat-products" aria-label="Alternativas de produtos">',
      '<p>' + escapeHtml(S.chatProductSuggestionsTitle || 'Prefere reduzir o valor da compra?') + '</p>',
      suggestions.map(function (product) {
        var image = isExternalSupportUrl(product.image)
          ? '<img src="' + escapeHtml(product.image) + '" alt="">'
          : ''
        return [
          '<article class="cr-chat-product">',
          image,
          '<div><strong>' + escapeHtml(product.name) + '</strong>',
          product.description ? '<small>' + escapeHtml(product.description) + '</small>' : '',
          product.price ? '<span>' + escapeHtml(product.price) + '</span>' : '',
          '</div>',
          '<button data-cr-product-id="' + escapeHtml(product.id) + '">Adicionar</button>',
          '</article>',
        ].join('')
      }).join(''),
      '</section>',
    ].join('')
  }

  function getChatProductSuggestion(id) {
    var suggestions = getChatProductSuggestions()
    for (var i = 0; i < suggestions.length; i++) {
      if (String(suggestions[i].id) === String(id)) return suggestions[i]
    }
    return null
  }

  function formatPrice(value) {
    var price = Number(value)
    if (!isFinite(price) || price <= 0) return ''
    return price.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  function normalizeCatalogSuggestion(product, excludedProductId) {
    var sku = (product.items || [])[0]
    var seller = ((sku || {}).sellers || [])[0]
    var offer = (seller || {}).commertialOffer || {}
    if (!product || !sku || !sku.itemId || !seller || String(product.productId) === String(excludedProductId)) return null
    return {
      id: 'catalog-' + sku.itemId,
      sku: sku.itemId,
      seller: seller.sellerId || '1',
      quantity: 1,
      name: product.productName || product.productTitle || 'Produto recomendado',
      description: product.brand || 'Alternativa disponível na loja',
      price: formatPrice(offer.Price),
      image: (((sku.images || [])[0] || {}).imageUrl || ''),
    }
  }

  function loadCatalogSuggestions() {
    var item = ((state.currentOrderForm || {}).items || [])[0]
    var key = item && (item.productId || item.id)
    if (!S.chatCatalogSuggestions || !key || !item.name || state.catalogSuggestionKey === key || typeof window.fetch !== 'function') return

    state.catalogSuggestionKey = key
    window.fetch('/api/catalog_system/pub/products/search?ft=' + encodeURIComponent(item.name) + '&_from=0&_to=' + Math.max(2, Number(S.chatCatalogSuggestionsLimit) || 3))
      .then(function (response) {
        if (!response.ok) throw new Error('catalog_unavailable')
        return response.json()
      })
      .then(function (products) {
        state.catalogSuggestions = (Array.isArray(products) ? products : [])
          .map(function (product) { return normalizeCatalogSuggestion(product, item.productId) })
          .filter(Boolean)
          .slice(0, Number(S.chatCatalogSuggestionsLimit) || 3)
        renderChatProductSuggestions()
        if (state.catalogSuggestions.length) pushEvent('chat_catalog_suggestions_loaded', { count: state.catalogSuggestions.length })
      })
      .catch(function () {
        state.catalogSuggestions = []
      })
  }

  function isExternalSupportUrl(value) {
    return /^https?:\/\//i.test(String(value || '').trim())
  }

  function getConfiguredPaymentMethods() {
    var methods = S.paymentMethods
    if (typeof methods === 'string') {
      try {
        methods = JSON.parse(methods)
      } catch (e) {
        methods = null
      }
    }
    if (!Array.isArray(methods) || !methods.length) return DEFAULT_PAYMENT_METHODS
    return methods.filter(function (method) {
      return method && method.id && method.label && method.selector
    })
  }

  function getPaymentMethod(action) {
    var methods = getPaymentMethods(state.currentOrderForm)
    for (var i = 0; i < methods.length; i++) {
      if (methods[i].id === action) return methods[i]
    }
    return null
  }

  function applyTheme() {
    var root = qs('#cr-root')
    if (!root) return
    root.style.setProperty('--cr-green', S.primaryColor)
    root.style.setProperty('--cr-green-light', S.primaryLightColor)
    root.style.setProperty('--cr-orange', S.accentColor)
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
    'não foi autorizad',
    'nao foi autorizad',
    'não autorizad',
    'nao autorizad',
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
      if (tx && tx.transactionId) {
        // Após uma recusa, alguns gateways removem metadados opcionais do
        // orderForm. O status terminal da própria transação é a fonte confiável.
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

  function responseIndicatesDenial(jqXHR) {
    var response = (jqXHR || {}).responseJSON || (jqXHR || {}).responseText || ''
    if (typeof response !== 'string') {
      try {
        response = JSON.stringify(response)
      } catch (e) {
        response = ''
      }
    }
    return /status\s*[":=]+\s*"?denied|não foi possível aprovar sua compra|nao foi possivel aprovar sua compra/i.test(response)
  }

  function getDeclineKey(value, fallback) {
    var text = typeof value === 'string' ? value : JSON.stringify(value || {})
    var match = text.match(/(?:transactionId|paymentId|tid)\s*[":=]+\s*"?([a-z0-9-]+)/i)
    return match ? match[1].toLowerCase() : fallback
  }

  function hideNativeDeclineMessage() {
    if (!S.hideNativeDeclineMessage) return

    var markers = [
      'por favor, revise seus dados de pagamento',
      'não foi possível aprovar sua compra',
      'nao foi possivel aprovar sua compra',
    ]
    var candidates = qsa('body *').filter(function (element) {
      if (element.closest('#cr-root')) return false
      var text = (element.textContent || '').toLowerCase()
      return markers.some(function (marker) {
        return text.indexOf(marker) !== -1
      })
    })

    candidates.forEach(function (element) {
      var container = element
      while (container && container !== document.body) {
        var className = typeof container.className === 'string'
          ? container.className
          : ''
        var role = container.getAttribute && container.getAttribute('role')
        if (
          role === 'dialog' ||
          role === 'alertdialog' ||
          /(?:^|[-_\s])(modal|alert|error|notification)(?:[-_\s]|$)/i.test(className)
        ) {
          break
        }
        container = container.parentElement
      }

      ;(container && container !== document.body ? container : element)
        .classList.add('cr-vtex-decline-hidden')
    })

    // O Checkout pode manter o backdrop do alerta nativo no body mesmo depois
    // que a caixa de recusa foi ocultada. Sem removê-lo, a página fica bloqueada.
    if (candidates.length) {
      qsa('.modal-backdrop, .vtex-modal-backdrop, [data-testid="modal-backdrop"]')
        .filter(function (element) { return !element.closest('#cr-root') })
        .forEach(function (element) {
          element.classList.add('cr-vtex-decline-hidden')
        })
    }
  }

  function openDeclineRecovery(key, source, orderForm) {
    if (state.handledDeclines[key]) return

    var modal = qs('#cr-modal')
    if (modal && !modal.classList.contains('cr-hidden')) return

    state.handledDeclines[key] = true
    state.declines++
    pushEvent('payment_declined', { source: source })
    openModal(orderForm || state.currentOrderForm)
    hideNativeDeclineMessage()
  }

  function openGatewayRecovery(source, response) {
    var key = getDeclineKey(response, source)
    openDeclineRecovery(key, source)
  }

  /* ────────────────────────────────────────────────────────────────────
   * 6. INJEÇÃO DO HTML DO MODAL
   *    Inserido dinamicamente no <body> para não interferir com o checkout.
   * ────────────────────────────────────────────────────────────────────*/
  function injectModal() {
    if (qs('#cr-root')) return // já injetado

    var pixBadge = S.showPixDiscount
      ? '<em class="cr-pix-badge">' + escapeHtml(S.pixDiscountLabel) + '</em>'
      : ''

    function paymentOptionsHtml(paymentMethods) {
      return paymentMethods
      .map(function (method) {
        var badge = method.id === 'pix' ? pixBadge : ''
        return [
          '    <button data-cr-action="' + escapeHtml(method.id) + '">',
          '      <span class="cr-method-icon ' + escapeHtml(method.iconClass || 'cr-card') + '">' + (method.icon || '&#9635;') + '</span>',
          '      <span><strong>' + escapeHtml(method.label) + '</strong><small>' + escapeHtml(method.description || '') + '</small></span>',
          '      ' + badge,
          '      <b>&#8250;</b>',
          '    </button>',
        ].join('\n')
      })
      .join('\n')
    }

    var html = [
      '<div id="cr-root">',

      // Backdrop
      '<div id="cr-backdrop" class="cr-backdrop cr-hidden"></div>',

      // Modal de recuperação
      '<section id="cr-modal" class="cr-modal cr-hidden" role="dialog" aria-modal="true" aria-labelledby="cr-modal-title">',
      '  <button class="cr-close" id="cr-close-btn" aria-label="Fechar">&times;</button>',
      '  <div class="cr-status-icon">!</div>',
      '  <span class="cr-eyebrow cr-danger">' + escapeHtml(S.modalEyebrow) + '</span>',
      '  <h2 id="cr-modal-title">' + escapeHtml(S.modalTitle) + '</h2>',
      '  <p class="cr-lead">' + escapeHtml(S.modalDescription) + '</p>',
      '  <div class="cr-reservation">',
      '    <span>&#9201;</span>',
      '    <div>',
      '      <strong>Reserva por mais <b id="cr-countdown">' + pad(S.reservationMinutes) + ':00</b></strong>',
      '      <small id="cr-product-name">Seu produto continua separado para você.</small>',
      '    </div>',
      '  </div>',
      '  <h3>' + escapeHtml(S.optionsTitle) + '</h3>',
      '  <div class="cr-options" id="cr-options">',
      paymentOptionsHtml(getConfiguredPaymentMethods()),
      '  </div>',
      '  <button id="cr-talk-now" class="cr-support-link">&#9685; ' + escapeHtml(S.supportText) + '</button>',
      '  <p class="cr-reason-code" id="cr-reason-code">Tentativa de pagamento não autorizada.</p>',
      '</section>',

      // Chat
      '<aside id="cr-chat" class="cr-chat cr-hidden" aria-label="Assistente de compra">',
      '  <header>',
      '    <div class="cr-agent-avatar" aria-hidden="true">' +
        (isExternalSupportUrl(S.chatLogoUrl)
          ? '<img src="' + escapeHtml(S.chatLogoUrl) + '" alt="">'
          : '<b>T</b>') +
      '</div>',
      '    <div>',
      '      <strong>' + escapeHtml(S.assistantName) + '</strong>',
      '      <span><i></i> Atendimento para finalizar sua compra</span>',
      '    </div>',
      '    <button id="cr-chat-close" data-cr-chat-close aria-label="Fechar chat">&times;</button>',
      '  </header>',
      '  <div id="cr-messages" class="cr-messages">',
      '    <div class="cr-bot-msg">',
      '      ' + escapeHtml(S.chatGreeting),
      '      <time>agora</time>',
      '    </div>',
      '    <div class="cr-chat-payment-actions">',
      '      <p>' + escapeHtml(S.chatPaymentTitle) + '</p>',
      '      <div id="cr-chat-payment-options">' + chatPaymentOptionsHtml() + '</div>',
      '    </div>',
      '    <div class="cr-quick-actions">',
      '      <button data-cr-chat-action="human">' + escapeHtml(S.chatHumanLabel) + '</button>',
      '    </div>',
      '    <div id="cr-chat-product-suggestions">' + chatProductSuggestionsHtml() + '</div>',
      '  </div>',
      '  <form id="cr-chat-form">',
      '    <input id="cr-chat-input" placeholder="Digite sua mensagem..." aria-label="Mensagem">',
      '    <button type="submit" aria-label="Enviar">&#10148;</button>',
      '  </form>',
      '</aside>',

      // Chat launcher (FAB)
      '<button id="cr-launcher" class="cr-launcher cr-hidden" aria-label="Falar com assistente">',
      '  <span aria-hidden="true">&#9685;</span>',
      '  <span>' + escapeHtml(S.launcherTitle) + '<small>' + escapeHtml(S.launcherSubtitle) + '</small></span>',
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

    applyTheme()
    bindEvents()
  }

  function renderPaymentOptions(orderForm) {
    var options = qs('#cr-options')
    if (!options) return
    var methods = getPaymentMethods(orderForm)
    options.innerHTML = methods
      .map(function (method) {
        var badge = method.id === 'pix' && S.showPixDiscount
          ? '<em class="cr-pix-badge">' + escapeHtml(S.pixDiscountLabel) + '</em>'
          : ''
        return [
          '<button data-cr-action="' + escapeHtml(method.id) + '">',
            '      <span class="cr-method-icon ' + escapeHtml(method.iconClass || 'cr-card') + '">' + (method.icon || '<img class="cr-logo-vtex cr-logo-card" src="https://io2.vtex.com/checkout-ui/v6.152.1/img/ico-credit2.png" alt="">') + '</span>',
          '<span><strong>' + escapeHtml(method.label) + '</strong><small>' + escapeHtml(method.description || '') + '</small></span>',
          badge,
          '<b>&#8250;</b>',
          '</button>',
        ].join('')
      })
      .join('')
    bindPaymentOptionEvents()
  }

  function renderChatPaymentOptions(orderForm) {
    var options = qs('#cr-chat-payment-options')
    if (!options) return
    options.innerHTML = chatPaymentOptionsHtml(orderForm)
    bindChatPaymentEvents()
  }

  function renderChatProductSuggestions() {
    var container = qs('#cr-chat-product-suggestions')
    if (!container) return
    container.innerHTML = chatProductSuggestionsHtml()
    bindChatPaymentEvents()
  }

  /* ────────────────────────────────────────────────────────────────────
   * 7. ABRIR / FECHAR MODAL
   * ────────────────────────────────────────────────────────────────────*/
  function openModal(orderForm) {
    injectModal()

    orderForm =
      orderForm ||
      state.currentOrderForm ||
      (((window.vtexjs || {}).checkout || {}).orderForm || null)

    // Personaliza com dados reais do orderForm
    if (orderForm) {
      state.currentOrderForm = orderForm
      renderPaymentOptions(orderForm)
      renderChatPaymentOptions(orderForm)
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

    // Cada parceiro configura o seletor da opção nativa no Checkout v6.
    var method = getPaymentMethod(action)
    var tab = method && method.groupName
      ? document.getElementById('payment-group-' + method.groupName)
      : qs(method && method.selector)
    if (tab) {
      tab.click()
      setTimeout(function () {
        if (method && method.afterSelect) {
          var splitControl = qs(method.afterSelect)
          if (splitControl) splitControl.click()
        }
        // Scroll para o formulário de pagamento
        var form = qs('#payment-data') || qs('.payment-option')
        if (form) form.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 300)
    }

    state.recoveries++
    renderMetrics()

    showToast((method && method.toast) || 'Método atualizado')
    pushEvent('checkout_recovered', { new_method: action })
  }

  /* ────────────────────────────────────────────────────────────────────
   * 10. CHAT
   * ────────────────────────────────────────────────────────────────────*/
  function openChat() {
    closeModal()
    var orderForm = state.currentOrderForm || (((window.vtexjs || {}).checkout || {}).orderForm || null)
    if (orderForm) state.currentOrderForm = orderForm
    renderChatPaymentOptions(orderForm)
    renderChatProductSuggestions()
    loadCatalogSuggestions()
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
    div.innerHTML = escapeHtml(text) + '<time>agora</time>'
    msgs.appendChild(div)
    msgs.scrollTop = msgs.scrollHeight
  }

  function addSuggestedProduct(id) {
    var product = getChatProductSuggestion(id)
    var checkout = ((window.vtexjs || {}).checkout || {})
    if (!product || typeof checkout.addToCart !== 'function') return

    var button = qs('[data-cr-product-id="' + id + '"]')
    if (button) {
      button.disabled = true
      button.textContent = 'Adicionando...'
    }

    var item = {
      id: product.sku,
      quantity: Number(product.quantity) > 0 ? Number(product.quantity) : 1,
      seller: String(product.seller || '1'),
    }
    Promise.resolve(checkout.addToCart([item]))
      .then(function (orderForm) {
        if (orderForm) state.currentOrderForm = orderForm
        pushEvent('chat_product_added', { product_id: product.id, sku: product.sku })
        botReply(product.name + ' foi adicionado ao seu carrinho.')
        if (button) button.textContent = 'Adicionado'
      })
      .catch(function () {
        if (button) {
          button.disabled = false
          button.textContent = 'Tentar novamente'
        }
        botReply('Não foi possível adicionar este produto agora. Tente novamente ou fale com o atendimento.')
      })
  }

  function getAssistantFallbackReply() {
    return 'Posso ajudar você a escolher outra forma de pagamento, entender o parcelamento disponível ou ver produtos semelhantes. Por segurança, não compartilhe dados de pagamento ou senhas por aqui.'
  }

  function getCheckoutReply(message) {
    var text = String(message || '').toLowerCase()
    if (/pix|boleto|pagaleve|nupay|nubank|pagamento|cart[aã]o|parcel/.test(text)) {
      return 'Você pode selecionar uma das formas de pagamento acima. A confirmação e as condições de parcelamento são mostradas pela própria Trocafone antes de finalizar.'
    }
    if (/produto|celular|modelo|valor|pre[cç]o|barat/.test(text)) {
      return 'Estou buscando alternativas do catálogo para você. Quando aparecerem, escolha Adicionar para incluir o item no carrinho.'
    }
    if (/atendimento|humano|ajuda|suporte/.test(text)) {
      return S.chatHumanMessage
    }
    return getAssistantFallbackReply()
  }

  function askAssistant(message) {
    if (!isExternalSupportUrl(S.aiEndpoint) || typeof window.fetch !== 'function') {
      botReply(getCheckoutReply(message))
      return
    }

    var orderForm = state.currentOrderForm || {}
    var items = (orderForm.items || []).map(function (item) {
      return {
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      }
    })
    var controller = window.AbortController ? new window.AbortController() : null
    var timeout = setTimeout(function () {
      if (controller) controller.abort()
    }, Number(S.aiRequestTimeoutMs) || 5000)

    window.fetch(S.aiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller && controller.signal,
      body: JSON.stringify({
        message: message,
        cart: { items: items, totalValue: orderForm.value || 0 },
        paymentStatus: 'declined',
      }),
    })
      .then(function (response) {
        if (!response.ok) throw new Error('assistant_unavailable')
        return response.json()
      })
      .then(function (response) {
        var reply = response && typeof response.reply === 'string' ? response.reply.trim() : ''
        botReply(reply || getAssistantFallbackReply())
        pushEvent('ai_chat_reply')
      })
      .catch(function () {
        botReply(getAssistantFallbackReply())
        pushEvent('ai_chat_fallback')
      })
      .then(function () { clearTimeout(timeout) })
  }

  function openExternalSupport() {
    if (!isExternalSupportUrl(S.chatHumanUrl)) {
      botReply(S.chatHumanMessage)
      return
    }
    pushEvent('external_support_open', { channel: 'external' })
    window.open(S.chatHumanUrl, '_blank', 'noopener,noreferrer')
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

    bindPaymentOptionEvents()

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

    // Opções de atendimento do chat
    qsa('[data-cr-chat-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.getAttribute('data-cr-chat-action')
        pushEvent('chat_quick_reply', { reply: action })
        if (action === 'human') openExternalSupport()
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
        var message = input.value.trim()
        input.value = ''
        askAssistant(message)
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

  function bindPaymentOptionEvents() {
    qsa('[data-cr-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        recover(btn.getAttribute('data-cr-action'))
      })
    })
  }

  function bindChatPaymentEvents() {
    qsa('[data-cr-chat-method]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.getAttribute('data-cr-chat-method')
        var method = getPaymentMethod(action)
        pushEvent('chat_payment_option_selected', { option: action })
        botReply('Perfeito. Vou abrir ' + escapeHtml((method || {}).label || 'essa forma de pagamento') + ' para você.')
        recover(action)
      })
    })

    qsa('[data-cr-product-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        addSuggestedProduct(btn.getAttribute('data-cr-product-id'))
      })
    })
  }

  /* ────────────────────────────────────────────────────────────────────
   * 13. ESCUTA DE EVENTOS NATIVOS DO CHECKOUT V6
   * ────────────────────────────────────────────────────────────────────*/

  function bindCheckoutEvents() {
    var checkoutJQuery = window.$ || window.jQuery
    if (!checkoutJQuery || state.checkoutEventsBound) return
    state.checkoutEventsBound = true

    // Evento primário: orderForm atualizado
    checkoutJQuery(window).on(
      'orderFormUpdated.vtex',
      function (evt, orderForm) {
        if (!orderForm) return

        // Só exibe se for uma transação nova (não o mesmo transactionId)
        var txId = null
        try {
          var txs = orderForm.paymentData.transactions
          if (txs && txs.length > 0) txId = txs[0].transactionId
        } catch (e) {}

        if (isPaymentDenied(orderForm)) {
          openDeclineRecovery(
            txId || 'orderform:' + (orderForm.orderFormId || 'unknown'),
            'orderFormUpdated',
            orderForm
          )
        }
      }
    )

    // Evento fallback: transactionValidation (disparado pelo Payment App ou Gateway)
    checkoutJQuery(document).on(
      'transactionValidation.vtex',
      function (evt, data) {
        if (data && data.status === 'denied') {
          openDeclineRecovery(
            getDeclineKey(data, 'transactionValidation'),
            'transactionValidation'
          )
        }
      }
    )

    checkoutJQuery(document).ajaxError(function (evt, jqXHR, ajaxSettings) {
      var requestUrl = ((ajaxSettings || {}).url || '').toLowerCase()
      var status = Number((jqXHR || {}).status || 0)
      var isPaymentRequest = /transaction|payment/.test(requestUrl)
      var isRequestFailure = status >= 400 && status < 600

      if (isPaymentRequest && isRequestFailure) {
        openGatewayRecovery('checkout_ajax_error', jqXHR)
      }
    })

    // Gateways como a Tuna podem responder 200 e informar a recusa no corpo.
    checkoutJQuery(document).ajaxComplete(function (evt, jqXHR, ajaxSettings) {
      var requestUrl = ((ajaxSettings || {}).url || '').toLowerCase()
      if (/transaction|payment/.test(requestUrl) && responseIndicatesDenial(jqXHR)) {
        openGatewayRecovery('checkout_transaction_response', jqXHR)
      }
    })

    // Última proteção: observa o aviso nativo exibido pela VTEX quando nenhum
    // evento do orderForm chega ao script de customização.
    if (window.MutationObserver && document.body) {
      var nativeDeclineObserver = new window.MutationObserver(function () {
        var pageText = document.body.textContent || ''
        if (/status\s*:\s*denied/i.test(pageText)) {
          hideNativeDeclineMessage()
          var nativeDeclineKey = getDeclineKey(
            pageText,
            'checkout_native_denial_message'
          )
          if (nativeDeclineKey === state.lastNativeDeclineKey) return

          state.lastNativeDeclineKey = nativeDeclineKey
          openDeclineRecovery(nativeDeclineKey, 'checkout_native_denial_message')
        }
      })
      nativeDeclineObserver.observe(document.body, { childList: true, subtree: true })
    }

  }

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

  function isDebugMode() {
    return /(?:[?#&])cr-debug=1(?:[&#]|$)/.test(window.location.href)
  }

  /* ────────────────────────────────────────────────────────────────────
   * 14. INICIALIZAÇÃO
   * ────────────────────────────────────────────────────────────────────*/
  function init() {
    injectModal()
    waitForjQuery(bindCheckoutEvents)
    pushEvent('paysave_loaded', { version: '1.0.0' })

    if (isDevWorkspace && isDebugMode()) {
      openModal()
    }

    // Adiciona botão de métricas discreta para o parceiro validar
    // (apenas em workspaces dev — verificado pelo hostname)
    if (isDevWorkspace) {
      var metricsBtn = document.createElement('button')
      metricsBtn.id = 'cr-metrics-trigger'
      metricsBtn.className = 'cr-metrics-trigger'
      metricsBtn.setAttribute('aria-label', 'Abrir painel ou simular recusa PaySave')
      metricsBtn.innerHTML = '&#9660; PaySave'
      metricsBtn.addEventListener('click', function () {
        var modal = qs('#cr-modal')
        if (modal && modal.classList.contains('cr-hidden')) {
          openDeclineRecovery('manual_workspace_test:' + Date.now(), 'manual_workspace_test')
        } else {
          var panel = qs('#cr-metrics')
          if (panel) {
            panel.classList.toggle('cr-hidden')
            renderMetrics()
          }
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
