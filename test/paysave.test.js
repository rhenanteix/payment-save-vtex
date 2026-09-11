import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'checkout-ui-custom', 'checkout6-custom.js')
const SCRIPT_SRC = readFileSync(SCRIPT_PATH, 'utf8')

  function createJQuery() {
    const handlers = {}
    const $ = function (selector, ctx) {
      return $
    }
    $.on = function (evt, fn) {
      ;(handlers[evt] = handlers[evt] || []).push(fn)
    }
    $.ajaxError = function (fn) {
      $.on('ajaxError', fn)
    }
    $.ajaxComplete = function (fn) {
      $.on('ajaxComplete', fn)
    }
    $.trigger = function (evt, ...args) {
      const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args
      ;(handlers[evt] || []).forEach((fn) => fn({ type: evt }, ...params))
    }
    $.fn = { on: $.on }
    window.$ = $
    window.jQuery = $
    return $
  }

describe('PaySave', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    delete globalThis.__cr_settings
    delete window.dataLayer
    window.history.pushState({}, '', '/checkout/cart')
    createJQuery()
    Object.defineProperty(document, 'readyState', {
      get() { return 'complete' },
      configurable: true,
    })
  })

  function runScript() {
    eval(SCRIPT_SRC)
  }

  describe('inicialização', () => {
    it('não injeta elementos fora do checkout', () => {
      window.history.pushState({}, '', '/home')
      runScript()
      expect(document.querySelector('#cr-root')).toBeNull()
    })

    it('respeita feature flag desativada', () => {
      globalThis.__cr_settings = { enabled: false }
      runScript()
      expect(document.querySelector('#cr-root')).toBeNull()
    })

    it('injecta o modal quando habilitado', () => {
      runScript()
      expect(document.querySelector('#cr-root')).not.toBeNull()
      expect(document.querySelector('#cr-modal')).not.toBeNull()
      expect(document.querySelector('#cr-backdrop')).not.toBeNull()
    })

    it('injecta chat, launcher e painel de métricas', () => {
      runScript()
      expect(document.querySelector('#cr-chat')).not.toBeNull()
      expect(document.querySelector('#cr-launcher')).not.toBeNull()
      expect(document.querySelector('#cr-metrics')).not.toBeNull()
    })
  })

  describe('settings', () => {
    it('aplica valores padrão quando não configurado', () => {
      runScript()
      const countdown = document.querySelector('#cr-countdown')
      expect(countdown.textContent).toBe('10:00')
    })

    it('não inclui boleto por padrão', () => {
      runScript()
      expect(document.querySelector('[data-cr-action="boleto"]')).toBeNull()
      expect(document.querySelector('[data-cr-action="pix"]')).not.toBeNull()
      expect(document.querySelector('[data-cr-action="retry"]')).not.toBeNull()
    })

    it('exibe os métodos disponíveis no orderForm da Trocafone', async () => {
      runScript()
      const of = {
        orderFormId: 'of-payment-systems',
        paymentData: {
          payments: [],
          transactions: [],
          paymentSystems: [
            { id: 125, name: 'Pix', groupName: 'instantPaymentPaymentGroup' },
            { id: 848, name: 'Pagaleve Pix Mensal Transparente', groupName: 'Pagaleve Pix Mensal TransparentePaymentGroup' },
            { id: 178, name: 'Nubank', groupName: 'NubankPaymentGroup' },
            { id: 2, name: 'Visa', groupName: 'creditCardPaymentGroup' },
            { id: 4, name: 'Mastercard', groupName: 'creditCardPaymentGroup' },
          ],
        },
        messages: [{ text: 'A transação não foi autorizada.' }],
      }
      window.$(window).trigger('orderFormUpdated.vtex', [of])
      await new Promise((r) => setTimeout(r, 50))
      expect(document.querySelectorAll('[data-cr-action]').length).toBe(4)
      expect(document.querySelector('[data-cr-action="pix"]')).not.toBeNull()
      expect(document.querySelector('[data-cr-action="pagaleve"]')).not.toBeNull()
      expect(document.querySelector('[data-cr-action="nubank"]')).not.toBeNull()
      expect(document.querySelector('[data-cr-action="credit-card"]')).not.toBeNull()
      expect(document.querySelector('[data-cr-action="boleto"]')).toBeNull()
      expect(document.querySelector('[data-cr-action="pix"] .cr-logo-pix')).not.toBeNull()
      expect(document.querySelector('[data-cr-action="pagaleve"] .cr-logo-pagaleve')).not.toBeNull()
      expect(document.querySelector('[data-cr-action="nubank"] .cr-logo-nubank')).not.toBeNull()
      expect(document.querySelector('[data-cr-action="credit-card"] .cr-logo-card')).not.toBeNull()
    })
  })

  describe('detecção de recusa', () => {
    it('exibe modal para status denied', async () => {
      runScript()
      const deniedOrderForm = {
        paymentData: {
          transactions: [{ transactionId: 'tx-1', status: 'denied', isActive: true, merchantName: 'Adyen' }],
          payments: [],
        },
        messages: [{ text: 'Pagamento recusado pelo banco.' }],
        orderFormId: 'of-1',
        clientProfileData: { firstName: 'Rhenan' },
        items: [{ name: 'iPhone 13' }],
      }
      window.$(window).trigger('orderFormUpdated.vtex', [deniedOrderForm])
      await new Promise((r) => setTimeout(r, 50))
      expect(document.querySelector('#cr-modal').classList.contains('cr-hidden')).toBe(false)
      expect(document.querySelector('#cr-declines').textContent).toBe('1')
    })

    it('exibe modal para uma recusa da Tuna sem metadados opcionais', async () => {
      runScript()
      const tunaDeniedOrderForm = {
        paymentData: {
          transactions: [{ transactionId: '135282F000D66A1', status: 'denied' }],
        },
        orderFormId: 'of-tuna-denied',
      }
      window.$(window).trigger('orderFormUpdated.vtex', [tunaDeniedOrderForm])
      await new Promise((r) => setTimeout(r, 50))
      expect(document.querySelector('#cr-modal').classList.contains('cr-hidden')).toBe(false)
      expect(document.querySelector('#cr-declines').textContent).toBe('1')
    })

    it('não exibe duas vezes para o mesmo transactionId', async () => {
      runScript()
      const of = {
        paymentData: {
          transactions: [{ transactionId: 'tx-1', status: 'denied', isActive: true, merchantName: 'Adyen' }],
          payments: [],
        },
        messages: [{ text: 'denied' }],
        orderFormId: 'of-1',
      }
      window.$(window).trigger('orderFormUpdated.vtex', [of])
      window.$(window).trigger('orderFormUpdated.vtex', [of])
      await new Promise((r) => setTimeout(r, 50))
      const events = document.querySelectorAll('.cr-event')
      const modalViews = Array.from(events).filter((e) => e.textContent.includes('recovery_modal_view'))
      expect(modalViews.length).toBe(1)
    })

    it('dispara evento payment_declined no dataLayer', async () => {
      window.dataLayer = []
      runScript()
      const of = {
        paymentData: {
          transactions: [{ transactionId: 'tx-1', status: 'voided', isActive: true, merchantName: 'Adyen' }],
          payments: [],
        },
        messages: [{ text: 'transação cancelada' }],
        orderFormId: 'of-1',
      }
      window.$(window).trigger('orderFormUpdated.vtex', [of])
      await new Promise((r) => setTimeout(r, 50))
      const evts = window.dataLayer.filter((e) => e.event === 'paysave_payment_declined')
      expect(evts.length).toBe(1)
    })

    it('detecta a mensagem em português de transação não autorizada', async () => {
      runScript()
      const of = {
        paymentData: { transactions: [], payments: [] },
        messages: [{ text: 'A transação não foi autorizada.' }],
        orderFormId: 'of-authorization-error',
      }
      window.$(window).trigger('orderFormUpdated.vtex', [of])
      await new Promise((r) => setTimeout(r, 50))
      expect(document.querySelector('#cr-modal').classList.contains('cr-hidden')).toBe(false)
    })

    it('exibe modal ao receber transactionValidation denied do gateway', async () => {
      window.dataLayer = []
      runScript()
      window.$(document).trigger('transactionValidation.vtex', [
        { status: 'denied', source: 'gateway-test' },
      ])
      await new Promise((r) => setTimeout(r, 50))
      expect(document.querySelector('#cr-modal').classList.contains('cr-hidden')).toBe(false)
      expect(document.querySelector('#cr-declines').textContent).toBe('1')
      expect(
        window.dataLayer.filter((e) => e.event === 'paysave_payment_declined')
      ).toHaveLength(1)
    })

    it('exibe modal para erro HTTP de transação do Checkout', async () => {
      window.dataLayer = []
      window.vtexjs = {
        checkout: {
          orderForm: {
            paymentData: {
              paymentSystems: [
                { id: 125, name: 'Pix', groupName: 'instantPaymentPaymentGroup' },
                { id: 178, name: 'Nubank', groupName: 'NubankPaymentGroup' },
              ],
            },
          },
        },
      }
      runScript()
      window.$(document).trigger('ajaxError', [
        { status: 403 },
        { url: '/api/checkout/pub/orderForm/of-1/transactions' },
      ])
      await new Promise((r) => setTimeout(r, 50))
      expect(document.querySelector('#cr-modal').classList.contains('cr-hidden')).toBe(false)
      expect(
        window.dataLayer.filter((e) => e.event === 'paysave_payment_declined')
      ).toHaveLength(1)
      expect(document.querySelectorAll('[data-cr-action]').length).toBe(2)
      expect(document.querySelector('[data-cr-action="nubank"]')).not.toBeNull()
    })

    it('exibe modal quando o gateway retorna denied com HTTP 200', async () => {
      window.dataLayer = []
      runScript()
      window.$(document).trigger('ajaxComplete', [
        { status: 200, responseText: '{"status":"denied","acquirer":"Tuna"}' },
        { url: '/api/checkout/pub/orderForm/of-1/transactions' },
      ])
      await new Promise((r) => setTimeout(r, 50))
      expect(document.querySelector('#cr-modal').classList.contains('cr-hidden')).toBe(false)
      expect(
        window.dataLayer.filter((event) => event.event === 'paysave_payment_declined')
      ).toHaveLength(1)
    })

    it('exibe modal ao encontrar o status denied no aviso nativo', async () => {
      runScript()
      const nativeMessage = document.createElement('div')
      nativeMessage.textContent = 'Visa (2097): acquirer:Tuna - status:denied'
      document.body.appendChild(nativeMessage)
      await new Promise((r) => setTimeout(r, 50))
      expect(document.querySelector('#cr-modal').classList.contains('cr-hidden')).toBe(false)
    })

    it('não duplica o modal para erros HTTP consecutivos de transação', async () => {
      window.dataLayer = []
      runScript()
      const response = { status: 403 }
      const request = { url: '/api/checkout/pub/orderForm/of-1/transactions' }
      window.$(document).trigger('ajaxError', [response, request])
      window.$(document).trigger('ajaxError', [response, request])
      await new Promise((r) => setTimeout(r, 50))
      expect(
        window.dataLayer.filter((e) => e.event === 'paysave_payment_declined')
      ).toHaveLength(1)
      expect(
        window.dataLayer.filter((e) => e.event === 'paysave_recovery_modal_view')
      ).toHaveLength(1)
    })
  })

  describe('ações de recuperação', () => {
    async function openRecovery() {
      runScript()
      const of = {
        paymentData: {
          transactions: [{ transactionId: 'tx-1', status: 'denied', isActive: true, merchantName: 'Adyen' }],
          payments: [],
        },
        messages: [{ text: 'denied' }],
        orderFormId: 'of-1',
        clientProfileData: { firstName: 'Rhenan' },
        items: [{ name: 'iPhone 13' }],
      }
      window.$(window).trigger('orderFormUpdated.vtex', [of])
      await new Promise((r) => setTimeout(r, 50))
    }

    it('fecha modal e envia evento ao selecionar Pix', async () => {
      window.dataLayer = []
      await openRecovery()
      const nativePix = document.createElement('button')
      nativePix.id = 'payment-group-instantPaymentPaymentGroup'
      let nativePixClicked = false
      nativePix.addEventListener('click', () => { nativePixClicked = true })
      document.body.appendChild(nativePix)
      document.querySelector('[data-cr-action="pix"]').click()
      await new Promise((r) => setTimeout(r, 50))
      expect(document.querySelector('#cr-modal').classList.contains('cr-hidden')).toBe(true)
      expect(nativePixClicked).toBe(true)
      const evts = window.dataLayer.filter((e) => e.event === 'paysave_checkout_recovered')
      expect(evts.length).toBe(1)
      expect(evts[0].new_method).toBe('pix')
    })

    it('exibe toast de confirmação', async () => {
      await openRecovery()
      document.querySelector('[data-cr-action="retry"]').click()
      await new Promise((r) => setTimeout(r, 50))
      const toast = document.querySelector('#cr-toast')
      expect(toast.classList.contains('cr-hidden')).toBe(false)
      expect(toast.textContent).toContain('novo cartão')
    })
  })

  describe('chat', () => {
    async function openRecovery() {
      runScript()
      const of = {
        paymentData: {
          transactions: [{ transactionId: 'tx-1', status: 'denied', isActive: true, merchantName: 'Adyen' }],
          payments: [],
        },
        messages: [{ text: 'denied' }],
        orderFormId: 'of-1',
        clientProfileData: { firstName: 'Rhenan' },
        items: [{ name: 'iPhone 13' }],
      }
      window.$(window).trigger('orderFormUpdated.vtex', [of])
      await new Promise((r) => setTimeout(r, 50))
    }

    it('abre chat ao clicar em "Quero ajuda"', async () => {
      await openRecovery()
      document.querySelector('#cr-talk-now').click()
      await new Promise((r) => setTimeout(r, 50))
      expect(document.querySelector('#cr-chat').classList.contains('cr-hidden')).toBe(false)
    })

    it('envía evento ao abrir chat', async () => {
      window.dataLayer = []
      await openRecovery()
      document.querySelector('#cr-talk-now').click()
      await new Promise((r) => setTimeout(r, 50))
      const evts = window.dataLayer.filter((e) => e.event === 'paysave_recovery_chat_open')
      expect(evts.length).toBe(1)
    })

    it('envía mensagem no chat', async () => {
      await openRecovery()
      document.querySelector('#cr-talk-now').click()
      await new Promise((r) => setTimeout(r, 50))
      const input = document.querySelector('#cr-chat-input')
      input.value = 'Preciso de ajuda'
      input.dispatchEvent(new Event('input'))
      document.querySelector('#cr-chat-form').dispatchEvent(new Event('submit', { cancelable: true }))
      await new Promise((r) => setTimeout(r, 50))
      const msgs = document.querySelectorAll('.cr-user-msg')
      expect(msgs.length).toBe(1)
    })
  })

  describe('métricas', () => {
    it.skip('atualiza taxa de recuperação', async () => {
      runScript()
      const of = {
        paymentData: {
          transactions: [{ transactionId: 'tx-1', status: 'denied', isActive: true, merchantName: 'Adyen' }],
          payments: [],
        },
        messages: [{ text: 'denied' }],
        orderFormId: 'of-1',
      }
      window.$(window).trigger('orderFormUpdated.vtex', [of])
      await new Promise((r) => setTimeout(r, 50))
      document.querySelector('[data-cr-action="pix"]').click()
      await new Promise((r) => setTimeout(r, 50))
      expect(document.querySelector('#cr-rate').textContent).toBe('100%')
    })

    it('limpa eventos ao clicar em Limpar', async () => {
      runScript()
      const of = {
        paymentData: {
          transactions: [{ transactionId: 'tx-1', status: 'denied', isActive: true, merchantName: 'Adyen' }],
          payments: [],
        },
        messages: [{ text: 'denied' }],
        orderFormId: 'of-1',
      }
      window.$(window).trigger('orderFormUpdated.vtex', [of])
      await new Promise((r) => setTimeout(r, 50))
      document.querySelector('#cr-clear-events').click()
      await new Promise((r) => setTimeout(r, 50))
      expect(document.querySelector('#cr-declines').textContent).toBe('0')
      expect(document.querySelector('#cr-recoveries').textContent).toBe('0')
    })
  })

  describe('segurança e isolamento', () => {
    it('não captura dados sensíveis no código', () => {
      const codeWithoutComments = SCRIPT_SRC.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')
      expect(codeWithoutComments).not.toMatch(/cvv|securityCode|tokenCard/i)
    })

    it('usa prefixo cr- em todas as classes do CSS', () => {
      const css = readFileSync(join(__dirname, '..', 'checkout-ui-custom', 'checkout6-custom.css'), 'utf8')
      const classes = css.match(/\.[a-z][a-z0-9_-]+/gi) || []
      const bad = classes.filter((c) => !c.startsWith('.cr-'))
      expect(bad.length).toBe(0)
    })
  })
})
