import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const baseURL = process.env.REDVERSE_URL || 'http://127.0.0.1:5173/'
const executablePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const outputDir = 'tmp/qa/latest'
await mkdir(outputDir, { recursive: true })

const browser = await chromium.launch({ executablePath, headless: true })
const results = []

async function verify(name, viewport) {
  const page = await browser.newPage({ viewport })
  const errors = []
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') errors.push(`${message.type()}: ${message.text()}`)
  })
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  await page.goto(baseURL, { waitUntil: 'networkidle' })
  const title = await page.locator('h1').first().textContent()
  const bodyText = await page.locator('body').innerText()
  const dimensions = await page.evaluate(() => {
    const root = globalThis.document.documentElement
    return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth }
  })
  if (!bodyText.includes('语音讲述')) throw new Error(`${name}: 语音入口不可见`)
  if (!bodyText.includes('开始')) throw new Error(`${name}: 主入口不可见`)
  if (dimensions.scrollWidth > dimensions.clientWidth + 1) throw new Error(`${name}: 横向溢出 ${dimensions.scrollWidth}/${dimensions.clientWidth}`)
  await page.screenshot({ path: `${outputDir}/${name}.png`, fullPage: true })
  results.push({ name, title, dimensions, errors })
  await page.close()
}

try {
  await verify('landing-desktop', { width: 1440, height: 1000 })
  await verify('landing-mobile', { width: 375, height: 812 })
} finally {
  await browser.close()
}

const failures = results.flatMap((result) => result.errors.map((error) => `${result.name}: ${error}`))
console.log(JSON.stringify(results, null, 2))
if (failures.length) throw new Error(`浏览器控制台不干净：\n${failures.join('\n')}`)
