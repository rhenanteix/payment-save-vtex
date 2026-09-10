import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'pixel', 'paysave.js')
const SCRIPT_SRC = readFileSync(SCRIPT_PATH, 'utf8')

  function createJQuery() {
    const handlers = {}
    const $ = function (selector, ctx) {
      return $
    }
    $.on = function (evt, fn) {
      ;(handlers[evt] = handlers[evt] || []).push(fn)
    }
    $.trigger = function (evt, ...args) {
      const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args
      ;(handlers[evt] || []).forEach((fn) => fn(...params))
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

    it.skip('aplica valores customizados do admin', () => {
      globalThis.__cr_settings = {
        reservationMinutes: 5,
        assistantName: 'Bia',
        pixDiscountLabel: '10% OFF',
        showPixDiscount: true,
      }
      runScript()
      const countdown = document.querySelector('#cr-countdown')
      expect(countdown.textContent).toBe('05:00')
      expect(document.querySelector('#cr-agent-avatar').textContent).toBe('B')
      expect(document.querySelector('.cr-pix-badge').textContent).toBe('10% OFF')
    })
  })

  describe('detecção de recusa', () => {
    it.skip('exibe modal para status denied', async () => {
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

    it.skip('não exibe duas vezes para o mesmo transactionId', async () => {
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

    it.skip('dispara evento payment_declined no dataLayer', async () => {
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
      document.querySelector('[data-cr-action="pix"]').click()
      await new Promise((r) => setTimeout(r, 50))
      expect(document.querySelector('#cr-modal').classList.contains('cr-hidden')).toBe(true)
      const evts = window.dataLayer.filter((e) => e.event === 'paysave_checkout_recovered')
      expect(evts.length).toBe(1)
      expect(evts[0].new_method).toBe('pix')
    })

    it('exibe toast de confirmação', async () => {
      await openRecovery()
      document.querySelector('[data-cr-action="boleto"]').click()
      await new Promise((r) => setTimeout(r, 50))
      const toast = document.querySelector('#cr-toast')
      expect(toast.classList.contains('cr-hidden')).toBe(false)
      expect(toast.textContent).toContain('Boleto')
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
      const css = readFileSync(join(__dirname, '..', 'pixel', 'paysave.css'), 'utf8')
      const classes = css.match(/\.[a-z][a-z0-9_-]+/gi) || []
      const bad = classes.filter((c) => !c.startsWith('.cr-'))
      expect(bad.length).toBe(0)
    })
  })
})
