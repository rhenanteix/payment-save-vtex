---
title: Landing e portal
---

# Integrar a landing ao portal

A landing em `landing/` direciona seus links de documentação para o portal Docusaurus publicado:

```text
https://rhenanteix.github.io/payment-save-vtex/
```

Os botões de instalação e validação levam diretamente às respectivas páginas do manual. Assim, a landing continua uma página comercial leve e o conteúdo técnico completo permanece organizado no portal.

## Publicação automática

O workflow `.github/workflows/deploy-docs.yml` gera `website/build/` e publica o resultado no GitHub Pages a cada push na branch `main` que altere `website/`.

1. No GitHub, abra **Settings > Pages** do repositório.
2. Em **Build and deployment**, selecione **GitHub Actions** como fonte.
3. Envie o workflow e os arquivos do portal para a branch `main`.
4. Aguarde a execução **Publicar documentação Docusaurus** concluir.
5. Acesse a URL do portal e teste os três links da landing.

Para validar localmente antes do push, execute os dois servidores em terminais separados:

```bash
npm run docs:docusaurus
npm run landing -- -l 4173
```

O portal local fica em `http://localhost:3000/payment-save-vtex/` e a landing em `http://localhost:4173/`.