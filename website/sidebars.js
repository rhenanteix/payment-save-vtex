const sidebars = {
  docsSidebar: [
    'introduction',
    'landing-integration',
    {
      type: 'category', label: 'Implementação VTEX',
      items: ['visual-installation', 'installation', 'configuration', 'payment-methods', 'validation'],
    },
    {
      type: 'category', label: 'Operação',
      items: ['declines', 'native-alert', 'analytics', 'support-chat', 'recovery-api'],
    },
    {type: 'category', label: 'Evolução', items: ['split-payment', 'experiments', 'production']},
  ],
}

export default sidebars