import { chromium } from 'playwright'

const executablePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser = await chromium.launch({ executablePath, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
const speechRequests = []

page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') errors.push(`${message.type()}: ${message.text()}`)
})
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
await page.route('**/api/**', async (route) => {
  const headers = { ...route.request().headers(), 'X-User-Info': JSON.stringify({ userId: 'browser-voice-smoke', name: 'Browser QA' }) }
  if (route.request().url().endsWith('/api/tts')) speechRequests.push(route.request().postDataJSON())
  await route.continue({ headers })
})

try {
  await page.goto('http://127.0.0.1:3000/children.html', { waitUntil: 'networkidle' })
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: /生成今天的小冒险/ }).click()
  await page.getByRole('button', { name: /翻开故事/ }).click()
  await page.getByRole('button', { name: '开启自动陪读' }).click()
  await page.waitForResponse((response) => response.url().endsWith('/api/tts') && response.status() === 200, { timeout: 30_000 })
  if (speechRequests[0]?.speaker !== 'child_narrator') throw new Error('首个陪读请求没有使用儿童旁白')
  await page.screenshot({ path: 'tmp/qa/latest/children-read-along-mobile.png', fullPage: true })
  console.log(JSON.stringify({ speechRequests: speechRequests.map(({ speaker, delivery }) => ({ speaker, delivery })), errors }, null, 2))
  if (errors.length) throw new Error(`浏览器控制台不干净：\n${errors.join('\n')}`)
} finally {
  await browser.close()
}
