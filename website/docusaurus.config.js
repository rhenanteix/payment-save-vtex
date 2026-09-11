import {themes as prismThemes} from 'prism-react-renderer'

const config = {
  title: 'PaySave',
  tagline: 'Recuperação de pagamento para Checkout VTEX',
  favicon: 'img/favicon.svg',
  url: 'https://rhenanteix.github.io',
  baseUrl: '/payment-save-vtex/',
  organizationName: 'rhenanteix',
  projectName: 'payment-save-vtex',
  onBrokenLinks: 'throw',
  markdown: {mermaid: true},
  i18n: {defaultLocale: 'pt-BR', locales: ['pt-BR']},
  themes: ['@docusaurus/theme-mermaid'],
  presets: [[
    'classic',
    {
      docs: {sidebarPath: './sidebars.js', routeBasePath: '/'},
      blog: false,
      theme: {customCss: './src/css/custom.css'},
    },
  ]],
  themeConfig: {
    navbar: {
      title: 'PaySave',
      items: [
        {type: 'docSidebar', sidebarId: 'docsSidebar', position: 'left', label: 'Documentação'},
        {href: 'https://github.com/rhenanteix/payment-save-vtex', label: 'GitHub', position: 'right'},
      ],
    },
    footer: {style: 'dark', copyright: `Copyright ${new Date().getFullYear()} PaySave.`},
    prism: {theme: prismThemes.github, darkTheme: prismThemes.dracula},
  },
}

export default config