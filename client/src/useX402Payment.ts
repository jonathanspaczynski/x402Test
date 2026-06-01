import { useState } from 'react'
import { useAccount, useSignTypedData } from 'wagmi'

type Status = 'idle' | 'requesting' | 'signing' | 'verifying' | 'success' | 'error'

interface PaymentRequirement {
  scheme: string
  network: string
  maxAmountRequired: string
  payTo: string
  asset: string
  maxTimeoutSeconds: number
  extra?: { name?: string; version?: string }
}

interface SecretContent {
  message: string
  secret: string
  timestamp: string
}

function randomNonce(): `0x${string}` {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return ('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`
}

export function useX402Payment() {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SecretContent | null>(null)

  const { address } = useAccount()
  const { signTypedDataAsync } = useSignTypedData()

  async function buy() {
    if (!address) return
    setError(null)
    setResult(null)

    try {
      // Step 1: probe the endpoint — expect a 402
      setStatus('requesting')
      const probe = await fetch('/api/secret')

      if (probe.status !== 402) {
        // No payment required (already cached, or server changed)
        const data = await probe.json()
        setResult(data)
        setStatus('success')
        return
      }

      const body: { accepts: PaymentRequirement[] } = await probe.json()
      const req = body.accepts[0]
      if (!req) throw new Error('No payment requirements returned by server')

      // Step 2: build the EIP-712 TransferWithAuthorization message
      setStatus('signing')
      const now = BigInt(Math.floor(Date.now() / 1000))
      const validAfter = now - 600n                                   // 10 min in the past
      const validBefore = now + BigInt(req.maxTimeoutSeconds ?? 60)   // validity window
      const nonce = randomNonce()

      const domainName = req.extra?.name ?? 'USD Coin'
      const domainVersion = req.extra?.version ?? '2'

      const signature = await signTypedDataAsync({
        domain: {
          name: domainName,
          version: domainVersion,
          chainId: 8453,
          verifyingContract: req.asset as `0x${string}`,
        },
        types: {
          TransferWithAuthorization: [
            { name: 'from', type: 'address' },
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'validAfter', type: 'uint256' },
            { name: 'validBefore', type: 'uint256' },
            { name: 'nonce', type: 'bytes32' },
          ],
        },
        primaryType: 'TransferWithAuthorization',
        message: {
          from: address,
          to: req.payTo as `0x${string}`,
          value: BigInt(req.maxAmountRequired),
          validAfter,
          validBefore,
          nonce,
        },
      })

      // Step 3: assemble the x402 payment payload and base64-encode it
      const paymentPayload = {
        x402Version: 1,
        scheme: req.scheme,
        network: req.network,
        payload: {
          signature,
          authorization: {
            from: address,
            to: req.payTo,
            value: req.maxAmountRequired,
            validAfter: validAfter.toString(),
            validBefore: validBefore.toString(),
            nonce,
          },
        },
      }
      const xPaymentHeader = btoa(JSON.stringify(paymentPayload))

      // Step 4: retry with the payment header
      setStatus('verifying')
      const paid = await fetch('/api/secret', {
        headers: { 'X-PAYMENT': xPaymentHeader },
      })

      if (!paid.ok) {
        const errBody = await paid.json().catch(() => ({}))
        throw new Error(errBody?.error ?? `Server returned ${paid.status}`)
      }

      const data: SecretContent = await paid.json()
      setResult(data)
      setStatus('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setStatus('error')
    }
  }

  function reset() {
    setStatus('idle')
    setError(null)
    setResult(null)
  }

  return { buy, reset, status, error, result }
}
