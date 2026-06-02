import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { paymentMiddleware } from 'x402-express'
import type { Address } from 'viem'

const app = express()
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001
const SELLER_ADDRESS = process.env.SELLER_ADDRESS as Address
const FACILITATOR_URL = (process.env.FACILITATOR_URL || 'https://x402.org/facilitator') as `${string}://${string}`

if (!SELLER_ADDRESS) {
  console.error('ERROR: SELLER_ADDRESS env var is required')
  process.exit(1)
}

app.use(
  cors({
    origin: 'http://localhost:5173',
    exposedHeaders: ['X-PAYMENT-RESPONSE'],
  })
)
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', seller: SELLER_ADDRESS, network: 'base-sepolia' })
})

app.use(
  paymentMiddleware(
    SELLER_ADDRESS,
    {
      '/api/secret': {
        price: '$0.001',
        network: 'base-sepolia',
        config: {
          description: 'Unlock exclusive content for 0.001 USDC on Base Sepolia',
        },
      },
    },
    { url: FACILITATOR_URL }
  )
)

app.get('/api/secret', (_req, res) => {
  res.json({
    message: 'Payment successful! You unlocked the secret.',
    secret:
      'The x402 protocol uses EIP-3009 transferWithAuthorization — a gasless signed approval that lets the facilitator pull USDC directly from your wallet without a prior approve() call.',
    timestamp: new Date().toISOString(),
  })
})

app.listen(PORT, () => {
  console.log(`x402 seller server running on http://localhost:${PORT}`)
  console.log(`  Payments go to: ${SELLER_ADDRESS}`)
  console.log(`  Facilitator:    ${FACILITATOR_URL}`)
})
