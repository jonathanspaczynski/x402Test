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
Then open http://localhost:5173. MetaMask must be on **Base Sepolia** (chain ID 84532).

## Current State (as of 2026-06-02) — WORKING on Base Sepolia
The payment flow is fully working end-to-end on Base Sepolia using `x402.org/facilitator`.

## How We Got It Working — Full Journey

### Problem 1: Facilitator doesn't support Base Mainnet
The project was originally built for Base Mainnet (chain ID 8453). `x402.org/facilitator` only supports testnets.

Confirmed via: `GET https://x402.org/facilitator/supported`
The facilitator returned: `"No facilitator registered for scheme: exact and network: base"`

**Fix:** Switch everything from Base Mainnet → Base Sepolia.

**Files changed:**

`server/src/index.ts`:
- `network: 'base'` → `network: 'base-sepolia'` (in paymentMiddleware config)
- `network: 'base'` → `network: 'base-sepolia'` (in /api/health response)

`client/src/useX402Payment.ts`:
- `chainId: 8453` → `chainId: 84532` (in the EIP-712 domain for signTypedDataAsync)

`client/src/wagmi.ts`:
- `import { base }` → `import { baseSepolia }` from `wagmi/chains`
- `chains: [base]` → `chains: [baseSepolia]`
- Transport key updated to `baseSepolia.id`

`client/src/App.tsx`:
- Badge text: `"Base Mainnet"` → `"Base Sepolia"`
- Removed the wrong-network check entirely (it was misfiring because wagmi couldn't identify the chain name)
- Removed `useSwitchChain`, `chain` from useAccount, and `baseSepolia` import (no longer needed after removing the check)

### Problem 2: MetaMask was on Ethereum Sepolia, not Base Sepolia
MetaMask showed chain ID 11155111 (Ethereum Sepolia) — a different network from Base Sepolia (84532).
viem threw: `"Provided chainId '84532' must match the active chainId '11155111'"`

**Fix:** Manually switch MetaMask to Base Sepolia. If the network isn't listed, add it:
- **Network name:** Base Sepolia
- **RPC URL:** `https://sepolia.base.org`
- **Chain ID:** `84532`
- **Currency:** ETH
- **Block explorer:** `https://sepolia.basescan.org`

### Problem 3: Need test USDC on Base Sepolia
Native ETH cannot be used with x402 — the protocol requires ERC-20 tokens that implement EIP-3009 `TransferWithAuthorization`. USDC supports this; ETH does not.

**Fix:** Get free test USDC from https://faucet.circle.com — select Base Sepolia, paste your wallet address.

After all three fixes, the full payment flow worked.

## Why ETH Doesn't Work with x402
The x402 `exact` scheme relies on EIP-3009 `TransferWithAuthorization` — a gasless pre-authorization mechanism specific to certain ERC-20 tokens (USDC being the main one). Native ETH has no equivalent. The entire client signing flow is USDC-specific. To use ETH you'd need a completely different payment protocol.

## For Production (Base Mainnet)
- `x402.org/facilitator` does NOT support Base Mainnet
- Use a facilitator that does, e.g. Coinbase CDP
- Update `FACILITATOR_URL` in `server/.env`
- Switch chain IDs back to 8453 / `base` everywhere

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
  "network": "base-sepolia",
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
- USDC on Base Sepolia: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- USDC on Base Mainnet: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
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
- viem chainId mismatch error = MetaMask is on the wrong network (check chain ID in MetaMask)
- "Connected to —" (blank chain name) in the UI = wagmi doesn't recognize the chain; just ignore it and make sure MetaMask is correct
- To test facilitator directly: `curl -L -X POST https://x402.org/facilitator/verify -H "Content-Type: application/json" -d '{...}'`
- To check supported networks: `curl https://x402.org/facilitator/supported`
