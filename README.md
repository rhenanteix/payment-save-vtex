# PaySave — VTEX IO App

Modal de recuperação de vendas para o **Checkout v6 da VTEX**. Quando uma transação é recusada pelo gateway, exibe automaticamente as alternativas de pagamento configuradas pela loja e um chat de suporte, mantendo o pedido reservado e aumentando a taxa de conversão.

> **Versão atual:** `1.0.0` · **Builder:** `checkout-ui-custom 0.x`
> O diretório `dist/` contém o **protótipo navegável** para apresentações. A pasta `checkout-ui-custom/` contém o app VTEX IO publicado no Checkout v6.

## Material para parceiros

- [Portal Docusaurus](website/docs/introduction.md)
- [Instalação do PaySave](website/docs/installation.md)
- [Validação antes da produção](website/docs/validation.md)
- [Landing page do produto](landing/index.html)

### Executar a documentação Docusaurus

O portal fica em `website/` e contém o manual completo de instalação, configuração, validação, eventos, atendimento, API de recuperação, dois cartões e checklist de produção.

```bash
npm install --prefix website
npm run docs:docusaurus
npm run docs:docusaurus:build
```

O comando de build gera os arquivos estáticos em `website/build/`. O workflow [deploy-docs.yml](.github/workflows/deploy-docs.yml) publica esse conteúdo em `https://rhenanteix.github.io/payment-save-vtex/` após um push na branch `main`. A ativação inicial de GitHub Pages está detalhada em [Landing e portal](website/docs/landing-integration.md).

### Material Mintlify legado

O portal fonte está em `docs/`, com configuração em `docs/docs.json`. Para conectá-lo ao Mintlify, crie ou acesse a organização em `app.mintlify.com`, conecte este repositório e selecione a pasta `docs` como raiz da documentação. Após a autorização, use:

```bash
npm install -g mint
cd docs
mint login
mint dev
mint validate
mint broken-links
```

O Mintlify publica automaticamente as alterações enviadas à branch configurada e fornece a URL `https://SEU-PROJETO.mintlify.app`. Configure essa URL nos links da landing hospedada separadamente.

---

## Estrutura do repositório

```text
paysave-vtex/
├── manifest.json              ← identidade do app VTEX IO
├── checkout-ui-custom/
│   ├── checkout6-custom.js    ← script principal injetado no Checkout v6
│   └── checkout6-custom.css   ← estilos do modal (prefixo cr- para isolamento)
├── dist/                      ← protótipo estático para demo/apresentação
│   ├── index.html
│   ├── styles.css
│   └── app.js
└── README.md
```

---

## Como funciona na VTEX real

1. O parceiro instala o app na conta dele via `vtex install`.
2. O builder `checkout-ui-custom` vincula `checkout6-custom.js` e `checkout6-custom.css` ao template do Checkout v6.
3. O script aguarda o jQuery nativo do Checkout v6 e escuta eventos do `orderForm`, do gateway e as respostas de transação.
4. Quando detecta uma transação recusada, exibe o modal **uma única vez** por tentativa.
5. O cliente escolhe uma alternativa; o script clica na tab correta do Checkout v6 nativo.
6. Os eventos são enviados para `window.dataLayer` (compatível com GA4/GTM).

---

## Status e sinais validados

O PaySave é uma camada de recuperação. Ele nunca autoriza, captura ou cancela pagamentos: a decisão financeira continua sendo da VTEX e do gateway.

| Retorno ou sinal do Checkout | PaySave abre o modal? | Como é identificado |
|---|---:|---|
| Transação `denied` | Sim | `orderFormUpdated.vtex` com `paymentData.transactions[].status` |
| Transação `voided` | Sim | `orderFormUpdated.vtex` com `paymentData.transactions[].status` |
| Transação `cancelled` | Sim | `orderFormUpdated.vtex` com `paymentData.transactions[].status` |
| Gateway com `{ status: "denied" }` | Sim | `transactionValidation.vtex` |
| Erro HTTP de transação ou pagamento ($4xx$/$5xx$) | Sim | `ajaxError` do Checkout |
| Recusa no corpo de resposta HTTP $2xx$, comum em gateways como Tuna | Sim | resposta de `transaction` ou `payment` com `status:denied` ou mensagem de não aprovação |
| Aviso nativo VTEX/Tuna com `status:denied` | Sim | observação do aviso renderizado no Checkout |
| `approved`, `authorized`, `pending` ou pagamento em processamento | Não | não representa uma recusa confirmada |
| Estoque, endereço, entrega ou frete inválidos | Não | não são respostas de pagamento |

### Funcionalidades disponíveis

- Modal de recuperação sobre o Checkout nativo, sem remover a mensagem original da VTEX.
- Métodos renderizados do `orderForm`: Pix, Pagaleve, Nubank e uma opção de cartão quando esses grupos estiverem habilitados; fallback configurável para cada parceiro.
- Ícones oficiais usados pelo Checkout VTEX para os métodos reconhecidos.
- Chat de suporte, respostas rápidas e painel de métricas da sessão no workspace de desenvolvimento.
- Eventos `dataLayer` para acompanhar recusa, visualização, seleção de método e recuperação.
- Modo controlado `?cr-debug=1` para abrir o modal no Checkout de uma workspace, sem tentativa de cobrança.
- Feature flag `enabled` para interrupção imediata em uma nova versão do app.
- Split payment opcional: encaminha para a opção nativa de dois cartões do Checkout, quando habilitada pela loja.

---

## Instalação para parceiros

## Plano de início gradual

O PaySave deve começar como distribuição privada para um parceiro piloto. A App Store VTEX fica para a etapa em que a configuração for autônoma e o suporte estiver definido.

### Fase 1: piloto controlado

1. Crie uma versão de piloto com `enabled: false` no objeto `S`. A configuração-base do repositório permanece habilitada para preservar o comportamento exercitado pela suíte de testes.
2. Escolha uma única conta parceira e crie uma workspace exclusiva, como `paysave-piloto`.
3. Configure apenas métodos já habilitados no Checkout dessa conta.
4. Valide com `?cr-debug=1`, depois com a recusa de homologação aprovada pelo gateway.
5. Confira os eventos `paysave_*`, erros do navegador e o encaminhamento para cada meio nativo.

### Fase 2: janela de produção

1. Publique a versão com o modal desativado.
2. Altere apenas `enabled` para `true` e publique uma nova versão.
3. Instale-a em horário de baixo tráfego e acompanhe recusa, abertura, seleção e recuperação pelo analytics.
4. Para interromper, reinstale a versão anterior ou publique imediatamente outra versão com `enabled: false`.

### Fase 3: distribuição para parceiros

1. Crie ou use o vendor VTEX IO da empresa fornecedora.
2. Altere `vendor` em `manifest.json` antes da publicação definitiva.
3. Publique o ID final, por exemplo `FORNECEDOR.paysave@1.x`.
4. Cada parceiro instala a versão publicada com o Toolbelt; não executa comandos dentro da página de Checkout.

O diagrama e os comandos detalhados ficam no [guia visual de instalação](website/docs/visual-installation.md).

### Pré-requisitos

```bash
npm install -g vtex   # instala o VTEX Toolbelt (uma vez)
```

### 1. Instalar o app

```bash
vtex login NOME-DA-CONTA
vtex install FORNECEDOR.paysave@1.x
```

### 2. Configurar o template do Checkout

O app usa o builder oficial `checkout-ui-custom`, que publica scripts versionados para o template. Altere o objeto `S` em `checkout-ui-custom/checkout6-custom.js` para mudar nome do chat, textos, métodos, seletores e feature flag. As cores ficam em `checkout-ui-custom/checkout6-custom.css`. Depois execute `vtex link --no-watch` no workspace de desenvolvimento.

As mudanças ficam versionadas no app e podem ser revertidas ao instalar a versão anterior. Uma tela no Admin para edição sem novo link exigirá um segundo app administrativo e uma API pública de configurações; o template de Checkout não fornece `settingsSchema` diretamente ao browser.

### Personalizar chat e atendimento

O parceiro configura aparência e comunicação no objeto `S`. As cores padrão do piloto usam rosa, azul e tons claros para acompanhar a identidade visual de teste atual; substitua pelos valores da marca do parceiro antes de publicar.

```js
assistantName: 'Equipe da Loja',
chatGreeting: 'Posso ajudar você a concluir esta compra.',
chatPaymentTitle: 'Escolha outra forma de pagamento',
chatHumanLabel: 'Falar com nossa equipe',
chatHumanUrl: 'https://wa.me/5511999999999?text=Preciso%20de%20ajuda',
primaryColor: '#e50046',
primaryLightColor: '#fff0f4',
accentColor: '#004e70',
```

`chatHumanUrl` pode ser uma URL de WhatsApp, Zendesk, CRM, central de ajuda ou qualquer outro canal externo que comece com `https://` ou `http://`. O botão abre o destino em nova aba. O chat não envia dados de cartão, CVV ou token para esse canal.

### Métodos de pagamento e outras empresas

Quando o Checkout informa `orderForm.paymentData.paymentSystems`, o modal monta suas opções a partir desses grupos. A configuração padrão reconhece Pix, Pagaleve, Nubank e uma única opção de cartão de crédito, mesmo quando existem várias bandeiras. O botão selecionado sempre clica no grupo nativo correspondente do Checkout. Boleto não é incluído.

Para uma conta que não exponha esses grupos reconhecidos, `S.paymentMethods` aceita uma lista JSON de fallback. Cada item usa o `selector` da opção já existente no Checkout v6 da conta; por isso o app não cria nem tenta processar meios de pagamento.

```json
[
	{
		"id": "pix",
		"label": "Pagar com Pix",
		"description": "Aprovação rápida",
		"selector": "[data-payment-group='instantPaymentPaymentGroup']",
		"toast": "Pix selecionado"
	},
	{
		"id": "wallet",
		"label": "Pagar com carteira",
		"description": "Use seu saldo disponível",
		"selector": "[data-payment-group='walletPaymentGroup']",
		"toast": "Carteira selecionada"
	}
]
```

Confirme o seletor na página de pagamento de cada loja antes de publicar a configuração.

Para identificar o seletor, abra o Checkout da conta em um workspace de desenvolvimento e inspecione o botão do método de pagamento nativo. Os grupos podem ser acessados pelo padrão `#payment-group-NOME_DO_GRUPO`. Mantenha o seletor alternativo somente quando a implementação de Checkout usar `data-payment-group`.

### Split payment com dois cartões

O PaySave não coleta nem divide valores de cartão. Quando a loja já possui o split payment habilitado no Checkout VTEX, habilite a alternativa no objeto `S` e informe o seletor do controle nativo que adiciona o segundo cartão:

```js
enableSplitPayment: true,
splitPaymentSelector: '.SELETOR-DO-CONTROLE-NATIVO',
```

Ao escolher **Pagar com dois cartões**, o PaySave abre o grupo nativo de cartão e aciona o controle informado. Valide o seletor em uma workspace antes de publicar. Em contas sem esse recurso nativo, mantenha `enableSplitPayment: false`; o PaySave não exibirá essa alternativa.

---

## Desenvolvimento e testes

### Validar com dados reais do Checkout

O workspace de desenvolvimento usa o catálogo e a configuração de checkout da conta, mas é isolado da URL que os clientes acessam. Faça a primeira validação nele, com um produto de teste e uma conta de comprador controlada.

```bash
vtex login NOME-DA-CONTA
vtex use paysave-test
vtex link
```

Acesse `https://paysave-test--NOME-DA-CONTA.myvtex.com/checkout?cr-debug=1`. O parâmetro abre o modal com o `orderForm` real somente em URL de workspace (`workspace--conta.myvtex.com`); ele é ignorado na URL de produção.

1. Confirme que os textos, cores e nome do chat configurados no app aparecem no modal.
2. Clique em cada método configurado e valide que o Checkout abre o meio de pagamento nativo correto.
3. Verifique no DevTools que os eventos `paysave_*` chegam ao `window.dataLayer`.
4. Teste uma recusa apenas com o método de homologação autorizado pelo adquirente ou gateway da conta. Não use cartão real nem provoque recusas em pedidos de clientes.

O app está validado para recusas em `orderFormUpdated.vtex` (`denied`, `voided` ou `cancelled`), `transactionValidation.vtex` (`status: denied`), erros HTTP de transação e respostas $2xx$ cujo corpo contenha a recusa do gateway. Ele também reconhece o aviso nativo VTEX com `status:denied` como última proteção. A recusa financeira real depende do cartão de teste homologado pelo gateway ativo na conta; peça esse dado ao responsável por pagamentos do parceiro antes de finalizar um pedido de teste.

### Ativar em produção

Depois da validação no workspace, publique uma versão com o vendor VTEX IO da organização. Antes de distribuir para outros parceiros, substitua o `vendor` em `manifest.json` pelo vendor da organização que publicará o app.

```bash
vtex publish
vtex deploy
vtex install FORNECEDOR.paysave@1.x
```

Antes de ativar, mantenha `enabled: false` no objeto `S`, faça a validação no workspace e publique essa versão. Para iniciar o experimento, altere para `enabled: true`, publique uma nova versão e instale-a em uma janela de baixo tráfego. Para interromper o experimento, reinstale a versão anterior ou publique imediatamente uma versão com `enabled: false`.

### Verificar integração

No workspace dev, um botão discreto **"▼ PaySave"** aparece na borda inferior da página com o painel de métricas e timeline de eventos.

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
- ✅ Feature flag versionada no template para ativação e desativação controladas

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
4. Teste os métodos configurados e o assistente
5. Abra "Ver eventos do funil" para acompanhar a timeline

---

## Próximas evoluções

- [x] Piloto privado com feature flag `enabled` desativada por padrão.
- [x] Split payment nativo opcional, mantido desativado até validação do parceiro.
- [ ] Criar app administrativo VTEX para configurar textos, cores, meios e integrações sem editar código.
- [ ] Criar API de recuperação para e-mail, CRM ou WhatsApp com segurança, idempotência e conformidade LGPD.
- [ ] Criar webhook para notificar o parceiro sobre recuperações.
- [ ] Adicionar variantes A/B configuráveis e relatório de conversão por meio escolhido.
- [ ] Preparar cadastro e aprovação para VTEX App Store após a configuração autônoma e o suporte operacional estarem prontos.
