npm run dev

  ▎ Note: the app uses real USDC on Base Mainnet (0.001 USDC per request), so you'll need a tiny amount in the buyer wallet to test it.

Last conversation:
The x402.org/facilitator only supports Base Sepolia (testnet), not Base mainnet. That's the root cause.

  Your options:

  1. Switch to Base Sepolia (easiest for development) — free test USDC, no real money
  2. Use a production facilitator — Coinbase has one for Base mainnet via their CDP platform

  For now, switching to Base Sepolia is the simplest path. You'd need to:
  - Change network: 'base' → 'base-sepolia' and chainId: 8453 → 84532 in the code
  - Switch MetaMask to Base Sepolia
  - Get test USDC from a Base Sepolia faucet