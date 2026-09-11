# Validação do PaySave

Use este roteiro antes de instalar o PaySave em produção. Faça todos os testes em um workspace de desenvolvimento e com um carrinho controlado.

## Roteiro funcional

1. Abra o Checkout no passo de pagamento com um item no carrinho.
2. Confirme que as opções nativas disponíveis aparecem no Checkout.
3. Simule uma recusa apenas com o método de homologação fornecido pelo gateway ou adquirente.
4. Verifique que o modal aparece somente uma vez para a mesma tentativa.
5. Confirme que os métodos do modal correspondem aos grupos retornados pelo `orderForm`.
6. Clique em cada alternativa e confirme que a aba nativa correspondente fica ativa.
7. Confirme no DevTools que eventos `paysave_*` chegam ao `window.dataLayer`.

## Verificação visual

Na Trocafone, o modal deve apresentar os mesmos assets que o Checkout VTEX usa para:

- Pix
- Pagaleve Pix Mensal Transparente
- NuPay
- Cartão de crédito

Não deve haver boleto na lista padrão. As opções devem conservar o texto e os métodos realmente habilitados na conta.

## Cenários de recusa tratados

| Origem | Condição esperada |
|---|---|
| `orderFormUpdated.vtex` | Transação `denied`, `voided` ou `cancelled` |
| `transactionValidation.vtex` | `status: denied` |
| Erro HTTP do Checkout | Status `400` a `599` em uma rota de pagamento ou transação |

## Evidência para aprovação

Registre para cada conta validada: URL do workspace, data, versão instalada, grupos de pagamento exibidos, evento de recusa usado e resultado de cada clique. Não registre número de cartão, CVV, token ou qualquer dado pessoal do comprador.

## Demonstração sem VTEX

Para uma apresentação sem Checkout real, execute:

```bash
npm run presentation
```

Abra a URL exibida pelo servidor. A demonstração simula uma recusa e permite acompanhar os eventos do funil sem comunicação com um gateway.