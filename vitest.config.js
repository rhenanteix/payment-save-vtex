import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost:4173/checkout/cart',
        runScripts: 'dangerously',
      },
    },
    include: ['test/**/*.test.js'],
  },
})
