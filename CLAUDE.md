# x402 Payment dApp — Project Notes

## What This Is
A minimal HTTP 402 payment-gated API using the x402 protocol.
- `server/` — Express + TypeScript seller on port 3001. Protects `GET /api/secret` for $0.001 USDC.
- `client/` — Vite + React + wagmi v2 on port 5173. MetaMask buyer signs EIP-712 payments.

## How to Run
```bash
# Terminal 1
cd server && npm install && npm run dev

# Terminal 2
cd client && npm install && npm run dev
```
Then open http://localhost:5173. MetaMask must be on Base Sepolia (for dev) or Base Mainnet (production).

## Current State (as of 2026-06-01)
The payment flow is implemented and structurally correct but **not yet working end-to-end** due to a facilitator mismatch.

### Root Cause of Current Blocker
`x402.org/facilitator` (the default) **only supports Base Sepolia and testnets** — it does NOT support Base Mainnet.

Confirmed via: `GET https://x402.org/facilitator/supported`
Supported networks: `base-sepolia`, `solana-devnet`, and various other testnets.

The facilitator returns:
```
"No facilitator registered for scheme: exact and network: base"
```

### Next Steps to Fix
**Option A — Switch to Base Sepolia (easiest, for dev/testing):**
- Change `network: 'base'` → `'base-sepolia'` in `server/src/index.ts`
- Change `chainId: 8453` → `84532` in `client/src/useX402Payment.ts`
- Switch MetaMask to Base Sepolia
- Get test USDC from a Base Sepolia faucet

**Option B — Production Base Mainnet:**
- Find/use a facilitator that supports Base Mainnet (e.g. Coinbase CDP)
- Update `FACILITATOR_URL` in `server/.env`

## Architecture
### Payment Flow
1. Client sends `GET /api/secret` → server returns 402 with JSON body:
   `{ x402Version, error, accepts: [PaymentRequirements] }`
2. Client signs EIP-712 `TransferWithAuthorization` via MetaMask (gasless, no `approve()` needed)
3. Client base64-encodes payment JSON and retries with `X-PAYMENT` header
4. Server forwards to facilitator (`POST /verify`), facilitator submits on-chain, returns receipt
5. Server serves protected content

### Payment Payload Format
```json
{
  "x402Version": 1,
  "scheme": "exact",
  "network": "base",
  "payload": {
    "signature": "0x...",
    "authorization": {
      "from": "<buyer address>",
      "to": "<seller address>",
      "value": "1000",
      "validAfter": "<unix timestamp string>",
      "validBefore": "<unix timestamp string>",
      "nonce": "0x<32 bytes hex>"
    }
  }
}
```
- All numeric fields (`value`, `validAfter`, `validBefore`) are **decimal strings** (not hex)
- `value` 1000 = 0.001 USDC (6 decimals)
- `validAfter` = now - 600s, `validBefore` = now + maxTimeoutSeconds (60s)

### Key Constants
- USDC on Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- EIP-712 domain: name `"USD Coin"`, version `"2"` (from `paymentRequirements.extra`)
- Vite proxy: `/api/*` → `localhost:3001` (so client fetches `/api/secret`, not `:3001/api/secret`)

## Config Files
- `server/.env` — `SELLER_ADDRESS`, `FACILITATOR_URL`, `PORT`
- `server/.env.example` — template (committed)
- `server/.env` — not committed (gitignored)

## Key Files
- `server/src/index.ts` — paymentMiddleware setup, route config
- `client/src/useX402Payment.ts` — full payment hook (probe → sign → retry)
- `client/src/wagmi.ts` — wagmi config
- `client/vite.config.ts` — Vite proxy config

## Debugging Notes
- The facilitator's real error message is in `invalidMessage` field, not just `invalidReason`
- `payer: undefined` in VerifyError = facilitator couldn't even parse the payload (or network mismatch)
- The 402 in browser console is expected — it's the probe request. The second 402 is the failure.
- To test facilitator directly: `curl -L -X POST https://x402.org/facilitator/verify -H "Content-Type: application/json" -d '{...}'`
