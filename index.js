const fs = require('fs')
const puppeteer = require('puppeteer-extra')
const cheerio = require('cheerio')
const { Client, GatewayIntentBits } = require('discord.js')
require('dotenv').config()

const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

const interval = parseInt(process.env.INTERVAL, 10)
const url = process.env.URL
const discordToken = process.env.DISCORD_TOKEN
const discordChannelId = process.env.DISCORD_CHANNEL_ID
const filePath = 'page_content.txt'

if (!discordToken || !discordChannelId || !url || isNaN(interval)) {
	console.error(
		'Please ensure all required environment variables are set correctly.'
	)
	process.exit(1)
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] })

client.once('ready', () => {
	console.log('Discord bot ready!')
	startMonitoring()
})

client.login(discordToken).catch((error) => {
	console.error('Failed to login to Discord:', error)
	process.exit(1)
})

// Function to generate a random MAC address
function generateRandomMAC() {
	const hexDigits = '0123456789ABCDEF'
	let macAddress = ''
	for (let i = 0; i < 6; i++) {
		macAddress += hexDigits.charAt(Math.floor(Math.random() * 16))
		macAddress += hexDigits.charAt(Math.floor(Math.random() * 16))
		if (i != 5) macAddress += ':'
	}
	return macAddress
}

async function fetchAndNormalizeContent() {
	try {
		errorNotificationSentFlag = false
		const browser = await puppeteer.launch({
			headless: true,
			args: [
				'--no-sandbox',
				'--disable-setuid-sandbox',
				'--disable-dev-shm-usage',
				'--disable-accelerated-2d-canvas',
				'--no-first-run',
				'--no-zygote',
				'--single-process',
				'--disable-gpu',
				'--window-size=1920,1080', // Set window size to standard
			],
			defaultViewport: {
				width: 1920,
				height: 1080,
			},
		})

		const page = await browser.newPage()

		// Generate and set a random MAC address
		const randomMAC = generateRandomMAC()
		await page.evaluateOnNewDocument((randomMAC) => {
			Object.defineProperty(navigator, 'hardwareConcurrency', {
				get: () => 4,
			})
			Object.defineProperty(navigator, 'platform', {
				get: () => 'Win32',
			})
			Object.defineProperty(navigator, 'userAgent', {
				get: () =>
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
			})
			Object.defineProperty(navigator, 'plugins', {
				get: () => [randomMAC],
			})
			Object.defineProperty(navigator, 'language', {
				get: () => 'en-US',
			})
			Object.defineProperty(navigator, 'languages', {
				get: () => ['en-US', 'en'],
			})
			Object.defineProperty(navigator, 'getBattery', {
				value: () =>
					Promise.resolve({
						charging: true,
						chargingTime: 0,
						dischargingTime: Infinity,
						level: 1,
					}),
			})
		}, randomMAC)

		await page.setUserAgent(
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'
		)
		await page.setExtraHTTPHeaders({
			Accept:
				'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
			'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
			Connection: 'keep-alive',
		})

		await page.goto(url, { waitUntil: 'networkidle2', timeout: 50000 })

		const content = await page.content()
		// await browser.close()

		const $ = cheerio.load(content)

		$('script, link, style').remove()

		$('*').each((i, el) => {
			const sortedAttrs = Object.keys(el.attribs)
				.sort()
				.reduce((acc, key) => ({ ...acc, [key]: el.attribs[key] }), {})
			el.attribs = sortedAttrs
		})

		const normalizedContent = $.html()

		return normalizedContent
	} catch (error) {
		if (
			error?.message?.includes('net::ERR_CONNECTION_REFUSED') ||
			error?.message?.includes('net::ERR_CONNECTION_TIMED_OUT')
		) {
			console.warn('Connection refused, skipping this iteration.')
			return null
		}
		if (JSON.stringify(error).includes('Time')) {
			console.warn('Connection Timeout, skipping this iteration.')
			return null
		}

		console.error('Error fetching the page or network issue:', error?.message)
		return null
	} finally {
		if (browser) {
			await browser.close()
		}
	}
}

async function checkForChanges() {
	const newContent = await fetchAndNormalizeContent()
	if (!newContent) return

	let oldContent = ''
	if (fs.existsSync(filePath)) {
		oldContent = fs.readFileSync(filePath, 'utf-8')
	}

	if (newContent !== oldContent) {
		fs.writeFileSync(filePath, newContent, 'utf-8')
		console.log('Content has changed, notifying Discord channel...')

		const channel = await client.channels.fetch(discordChannelId)
		if (channel) {
			channel.send(`Content at ${url} has changed!`)
		}
	} else {
		console.log('No changes detected.')
	}
}

function startMonitoring() {
	setInterval(checkForChanges, interval)
}
