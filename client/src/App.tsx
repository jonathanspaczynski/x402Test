import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { useX402Payment } from './useX402Payment'

const STATUS_LABEL: Record<string, string> = {
  idle: '',
  requesting: 'Contacting server...',
  signing: 'Waiting for MetaMask signature...',
  verifying: 'Facilitator verifying payment on Base Sepolia...',
  success: 'Payment settled on-chain',
  error: '',
}

export default function App() {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()

  const { buy, reset, status, error, result } = useX402Payment()

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <h1 style={styles.title}>x402 dApp</h1>
          <span style={styles.badge}>Base Sepolia</span>
        </div>
        <p style={styles.subtitle}>
          Pay <strong>0.001 USDC</strong> to unlock exclusive content. One signature — no gas, no approve.
        </p>

        {/* Wallet */}
        <div style={styles.section}>
          {!isConnected ? (
            <button
              style={styles.btnPrimary}
              onClick={() => connect({ connector: connectors[0] })}
            >
              Connect MetaMask
            </button>
          ) : (
            <div style={styles.walletRow}>
              <div>
                <div style={styles.label}>Connected</div>
                <div style={styles.address}>
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </div>
              </div>
              <button style={styles.btnGhost} onClick={() => disconnect()}>
                Disconnect
              </button>
            </div>
          )}
        </div>

        {/* Buy */}
        {isConnected && (
          <div style={styles.section}>
            <button
              style={{
                ...styles.btnPrimary,
                opacity: status !== 'idle' && status !== 'error' && status !== 'success' ? 0.6 : 1,
                cursor: status !== 'idle' && status !== 'error' && status !== 'success' ? 'not-allowed' : 'pointer',
              }}
              disabled={status !== 'idle' && status !== 'error' && status !== 'success'}
              onClick={status === 'success' || status === 'error' ? reset : buy}
            >
              {status === 'success'
                ? 'Buy Again'
                : status === 'error'
                ? 'Retry'
                : 'Buy Secret Content — 0.001 USDC'}
            </button>

            {STATUS_LABEL[status] && (
              <div style={styles.statusLine}>
                <span style={styles.spinner}>⟳</span> {STATUS_LABEL[status]}
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={styles.errorBox}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div style={styles.resultBox}>
            <div style={styles.resultHeader}>
              ✓ {result.message}
            </div>
            <div style={styles.resultSecret}>{result.secret}</div>
            <div style={styles.resultMeta}>Settled at {new Date(result.timestamp).toLocaleTimeString()}</div>
          </div>
        )}

        {/* How it works */}
        <details style={styles.details}>
          <summary style={styles.summary}>How does this work?</summary>
          <ol style={styles.steps}>
            <li>Your browser requests <code>/api/secret</code></li>
            <li>Server responds <strong>402 Payment Required</strong> with USDC payment details</li>
            <li>MetaMask shows a <strong>Sign</strong> prompt (EIP-712 typed data — no gas)</li>
            <li>The signed authorization is sent back to the server as <code>X-PAYMENT</code> header</li>
            <li>The x402 facilitator verifies the signature and calls USDC's <code>transferWithAuthorization</code></li>
            <li>Server returns the unlocked content once settlement confirms</li>
          </ol>
        </details>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    background: 'linear-gradient(135deg, #0a0a0f 0%, #0d1117 100%)',
  },
  card: {
    width: '100%',
    maxWidth: '520px',
    background: '#111827',
    border: '1px solid #1f2937',
    borderRadius: '16px',
    padding: '32px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#f1f5f9',
  },
  badge: {
    background: '#1e3a5f',
    color: '#60a5fa',
    border: '1px solid #2563eb',
    borderRadius: '20px',
    padding: '2px 10px',
    fontSize: '12px',
    fontWeight: 600,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: '14px',
    lineHeight: 1.6,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  btnPrimary: {
    background: 'linear-gradient(90deg, #2563eb, #7c3aed)',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    padding: '14px 20px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  btnGhost: {
    background: 'transparent',
    color: '#94a3b8',
    border: '1px solid #374151',
    borderRadius: '8px',
    padding: '6px 12px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  btnSmall: {
    background: '#92400e',
    color: '#fde68a',
    border: 'none',
    borderRadius: '6px',
    padding: '4px 10px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  walletRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#1f2937',
    borderRadius: '10px',
    padding: '12px 16px',
  },
  label: {
    fontSize: '11px',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  address: {
    fontSize: '14px',
    fontFamily: 'monospace',
    color: '#e2e8f0',
  },
  warning: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#1c1007',
    border: '1px solid #78350f',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '13px',
    color: '#fde68a',
    gap: '10px',
  },
  statusLine: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#60a5fa',
  },
  spinner: {
    display: 'inline-block',
    animation: 'spin 1s linear infinite',
    fontSize: '16px',
  },
  errorBox: {
    background: '#1a0f0f',
    border: '1px solid #7f1d1d',
    borderRadius: '8px',
    padding: '12px 16px',
    fontSize: '13px',
    color: '#fca5a5',
  },
  resultBox: {
    background: '#0d1f0f',
    border: '1px solid #166534',
    borderRadius: '10px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  resultHeader: {
    color: '#4ade80',
    fontWeight: 600,
    fontSize: '14px',
  },
  resultSecret: {
    color: '#d1fae5',
    fontSize: '14px',
    lineHeight: 1.7,
    borderLeft: '3px solid #166534',
    paddingLeft: '12px',
  },
  resultMeta: {
    fontSize: '11px',
    color: '#6b7280',
  },
  details: {
    borderTop: '1px solid #1f2937',
    paddingTop: '16px',
  },
  summary: {
    color: '#6b7280',
    fontSize: '13px',
    cursor: 'pointer',
    userSelect: 'none',
  },
  steps: {
    marginTop: '12px',
    paddingLeft: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    color: '#94a3b8',
    fontSize: '13px',
    lineHeight: 1.6,
  },
}
