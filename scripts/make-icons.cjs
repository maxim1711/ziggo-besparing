// Genereert de PWA-iconen uit public/favicon.svg (eenmalig; vereist Playwright).
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')
;(async () => {
  const svg = fs.readFileSync(path.join(__dirname, '../public/favicon.svg'), 'utf8')
  const browser = await chromium.launch()
  for (const [name, size] of [['pwa-192.png', 192], ['pwa-512.png', 512], ['apple-touch-icon.png', 180]]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } })
    await page.setContent(`<style>*{margin:0}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`)
    await page.screenshot({ path: path.join(__dirname, '../public', name) })
    await page.close()
  }
  await browser.close()
})()
