import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowUpRight, Check, ChefHat, CircleDot, Clock3, ExternalLink,
  Flame, Link2, LoaderCircle, RefreshCw, ShieldCheck, Sparkles, Wallet,
} from 'lucide-react'
import {
  Connection, PublicKey, Transaction, TransactionInstruction,
  type ParsedInstruction, type PartiallyDecodedInstruction,
} from '@solana/web3.js'
import bs58 from 'bs58'
import { encodeReceipt, makeReceipt, parseReceipt, STATUSES } from './receipts'
import type { BakeStatus, ChainReceipt, WalletAccount } from './types'

const RPC_URL = 'https://rpc.cookiescan.io'
const WS_URL = 'https://wss.cookiescan.io'
const EXPLORER_URL = 'https://cookiescan.io'
const MEMO_PROGRAM = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')
const connection = new Connection(RPC_URL, { commitment: 'confirmed', wsEndpoint: WS_URL })

type Toast = { kind: 'success' | 'error' | 'info'; message: string }

function short(value: string, left = 4, right = 4) {
  return `${value.slice(0, left)}…${value.slice(-right)}`
}

function timeAgo(timestamp: number | null) {
  if (!timestamp) return 'Awaiting time'
  const seconds = Math.max(1, Math.floor(Date.now() / 1000 - timestamp))
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function extractMemo(instruction: ParsedInstruction | PartiallyDecodedInstruction): string | null {
  if (!instruction.programId.equals(MEMO_PROGRAM)) return null
  if ('parsed' in instruction) return typeof instruction.parsed === 'string' ? instruction.parsed : null
  try { return new TextDecoder().decode(bs58.decode(instruction.data)) } catch { return null }
}

export default function App() {
  const [account, setAccount] = useState<WalletAccount | null>(null)
  const [genesisHash, setGenesisHash] = useState('')
  const [slot, setSlot] = useState<number | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [receipts, setReceipts] = useState<ChainReceipt[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<BakeStatus>('shipped')
  const [proof, setProof] = useState('')
  const [note, setNote] = useState('')

  const publicKey = useMemo(() => account ? new PublicKey(account.address) : null, [account])

  const refreshNetwork = useCallback(async () => {
    try {
      const [nextSlot, nextGenesis] = await Promise.all([connection.getSlot('confirmed'), connection.getGenesisHash()])
      setSlot(nextSlot)
      setGenesisHash(nextGenesis)
      if (publicKey) setBalance((await connection.getBalance(publicKey, 'confirmed')) / 1_000_000_000)
    } catch {
      setToast({ kind: 'error', message: 'Cookie Chain RPC is not responding. Try again shortly.' })
    }
  }, [publicKey])

  const loadReceipts = useCallback(async () => {
    if (!publicKey) return
    setLoadingHistory(true)
    try {
      const signatures = await connection.getSignaturesForAddress(publicKey, { limit: 25 }, 'confirmed')
      if (!signatures.length) { setReceipts([]); return }
      const transactions = await connection.getParsedTransactions(signatures.map((item) => item.signature), {
        commitment: 'confirmed', maxSupportedTransactionVersion: 0,
      })
      const next: ChainReceipt[] = []
      transactions.forEach((transaction, index) => {
        const instructions = transaction?.transaction.message.instructions ?? []
        for (const instruction of instructions) {
          const memo = extractMemo(instruction)
          const receipt = parseReceipt(memo)
          if (receipt) {
            next.push({ ...receipt, signature: signatures[index].signature, blockTime: transaction?.blockTime ?? null, confirmed: signatures[index].confirmationStatus !== 'processed' })
          }
        }
      })
      setReceipts(next)
    } catch (error) {
      setToast({ kind: 'error', message: error instanceof Error ? error.message : 'Could not load BakeLog history.' })
    } finally { setLoadingHistory(false) }
  }, [publicKey])

  useEffect(() => { void refreshNetwork() }, [refreshNetwork])
  useEffect(() => { void loadReceipts() }, [loadReceipts])
  useEffect(() => {
    const timer = window.setInterval(() => void refreshNetwork(), 15_000)
    return () => window.clearInterval(timer)
  }, [refreshNetwork])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 5000)
    return () => window.clearTimeout(timer)
  }, [toast])

  async function connectNightly() {
    const nightly = window.nightly?.solana
    if (!nightly) {
      window.open('https://nightly.app/', '_blank', 'noopener,noreferrer')
      setToast({ kind: 'info', message: 'Install Nightly, then refresh BakeLog to connect.' })
      return
    }
    try {
      const chainGenesis = genesisHash || await connection.getGenesisHash()
      if (nightly.genesisHash !== chainGenesis) await nightly.changeNetwork({ genesisHash: chainGenesis, url: RPC_URL })
      const result = await nightly.features['standard:connect'].connect()
      const nextAccount = result.accounts[0]
      if (!nextAccount) throw new Error('Nightly returned no approved account.')
      setAccount(nextAccount)
      setToast({ kind: 'success', message: 'Nightly connected to Cookie Chain.' })
    } catch (error) {
      setToast({ kind: 'error', message: error instanceof Error ? error.message : 'Wallet connection was declined.' })
    }
  }

  async function disconnect() {
    await window.nightly?.solana?.features['standard:disconnect']?.disconnect().catch(() => undefined)
    setAccount(null); setBalance(null); setReceipts([])
  }

  async function bakeReceipt() {
    const nightly = window.nightly?.solana
    if (!nightly || !account || !publicKey) return
    setSubmitting(true)
    try {
      const receipt = makeReceipt({ title, status, proof, note })
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
      const transaction = new Transaction({ feePayer: publicKey, recentBlockhash: blockhash }).add(
        new TransactionInstruction({
          programId: MEMO_PROGRAM,
          keys: [{ pubkey: publicKey, isSigner: true, isWritable: false }],
          data: new TextEncoder().encode(encodeReceipt(receipt)),
        }),
      )
      const unsigned = transaction.serialize({ requireAllSignatures: false, verifySignatures: false })
      const [signed] = await nightly.features['solana:signTransaction'].signTransaction({
        account, transaction: unsigned, options: { preflightCommitment: 'confirmed' },
      })
      if (!signed) throw new Error('Nightly did not return a signed transaction.')
      const signature = await connection.sendRawTransaction(signed.signedTransaction, { skipPreflight: false, maxRetries: 3 })
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')
      setTitle(''); setProof(''); setNote(''); setStatus('shipped')
      setToast({ kind: 'success', message: `Receipt baked: ${short(signature, 6, 6)}` })
      await Promise.all([loadReceipts(), refreshNetwork()])
    } catch (error) {
      setToast({ kind: 'error', message: error instanceof Error ? error.message : 'Transaction could not be completed.' })
    } finally { setSubmitting(false) }
  }

  const shippedCount = receipts.filter((receipt) => receipt.status === 'shipped' || receipt.status === 'verified').length
  const proofCount = receipts.filter((receipt) => receipt.proof).length

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <header className="topbar">
        <a className="brand" href="#top" aria-label="BakeLog home"><span className="brand-mark"><ChefHat size={22} /></span><span>BakeLog</span></a>
        <div className="network-pill"><span className="live-dot" /> Cookie Chain <span className="muted">•</span> {slot ? `slot ${slot.toLocaleString()}` : 'connecting'}</div>
        {account ? <button className="wallet-connected" onClick={disconnect}><span>{short(account.address)}</span><span className="balance">{balance === null ? '—' : balance.toFixed(3)} COOK</span></button>
          : <button className="button button-primary compact" onClick={connectNightly}><Wallet size={17} /> Connect Nightly</button>}
      </header>

      <main id="top">
        <section className="hero">
          <div className="eyebrow"><Sparkles size={15} /> Proof that you shipped</div>
          <h1>Turn every milestone into an <em>immutable receipt.</em></h1>
          <p>Bake a permanent, signed shipping log on Cookie Chain. Attach proof, track momentum, and let the chain remember what your team delivered.</p>
          <div className="hero-actions">
            <button className="button button-primary" onClick={() => account ? document.getElementById('oven')?.scrollIntoView({ behavior: 'smooth' }) : void connectNightly()}><Flame size={18} /> {account ? 'Bake a receipt' : 'Connect & start baking'}</button>
            <a className="button button-ghost" href={EXPLORER_URL} target="_blank" rel="noreferrer">Explore the chain <ArrowUpRight size={17} /></a>
          </div>
          <div className="trust-row"><span><ShieldCheck size={16} /> Non-custodial</span><span><Clock3 size={16} /> ~1s finality</span><span><CircleDot size={16} /> Memo v1 receipts</span></div>
        </section>

        <section className="stats-grid">
          <article className="stat-card"><span className="stat-icon violet"><Activity size={20} /></span><div><span>Network slot</span><strong>{slot?.toLocaleString() ?? '—'}</strong></div></article>
          <article className="stat-card"><span className="stat-icon amber"><Flame size={20} /></span><div><span>Your receipts</span><strong>{account ? receipts.length : '—'}</strong></div></article>
          <article className="stat-card"><span className="stat-icon green"><Check size={20} /></span><div><span>Shipped</span><strong>{account ? shippedCount : '—'}</strong></div></article>
          <article className="stat-card"><span className="stat-icon blue"><Link2 size={20} /></span><div><span>With proof</span><strong>{account ? proofCount : '—'}</strong></div></article>
        </section>

        <section className="workspace-grid">
          <article className="panel oven" id="oven">
            <div className="panel-heading"><div><span className="kicker">THE OVEN</span><h2>Bake a shipping receipt</h2></div><span className="fee-chip">≈ 0.000005 COOK</span></div>
            {!account && <div className="connect-curtain"><div className="curtain-icon"><Wallet size={24} /></div><h3>Connect Nightly to use the oven</h3><p>Your wallet signs locally. BakeLog never sees or stores your keys.</p><button className="button button-primary" onClick={connectNightly}>Connect Nightly</button></div>}
            <form onSubmit={(event) => { event.preventDefault(); void bakeReceipt() }} aria-disabled={!account}>
              <label>What did you ship?<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} placeholder="e.g. Public beta with wallet support" disabled={!account || submitting} /></label>
              <fieldset><legend>Milestone status</legend><div className="status-picker">{STATUSES.map((item) => <button key={item} type="button" className={status === item ? 'selected' : ''} onClick={() => setStatus(item)} disabled={!account || submitting}>{item}</button>)}</div></fieldset>
              <label>Proof link <span>optional</span><input value={proof} onChange={(event) => setProof(event.target.value)} placeholder="https://github.com/…" inputMode="url" disabled={!account || submitting} /></label>
              <label>Short note <span>{note.length}/180</span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={180} placeholder="What changed, and why does it matter?" disabled={!account || submitting} /></label>
              <div className="receipt-preview"><span>ON-CHAIN PREVIEW</span><code>{title.trim() || 'Your milestone'} · {status} · {proof ? 'proof attached' : 'no proof'}</code></div>
              <button className="button button-primary submit" type="submit" disabled={!account || submitting || title.trim().length < 3}>{submitting ? <><LoaderCircle className="spin" size={18} /> Baking & confirming…</> : <><Flame size={18} /> Bake on Cookie Chain</>}</button>
            </form>
          </article>

          <article className="panel log-panel">
            <div className="panel-heading"><div><span className="kicker">YOUR LEDGER</span><h2>Recent bakes</h2></div><button className="icon-button" aria-label="Refresh history" onClick={() => void loadReceipts()} disabled={!account || loadingHistory}><RefreshCw className={loadingHistory ? 'spin' : ''} size={18} /></button></div>
            {!account ? <div className="empty-state"><div className="stacked-cookies"><span /><span /><span /></div><h3>Your proof trail starts here</h3><p>Connect a wallet to load receipts signed by that address.</p></div>
              : loadingHistory && !receipts.length ? <div className="empty-state"><LoaderCircle className="spin" /><p>Reading the chain…</p></div>
              : !receipts.length ? <div className="empty-state"><div className="stacked-cookies"><span /><span /><span /></div><h3>No receipts yet</h3><p>Bake your first milestone and it will appear here after confirmation.</p></div>
              : <div className="receipt-list">{receipts.map((receipt) => <div className="receipt-item" key={receipt.signature}><span className={`status-dot ${receipt.status}`} /><div className="receipt-copy"><div className="receipt-title"><strong>{receipt.title}</strong><span>{receipt.status}</span></div><p>{receipt.note || 'Signed milestone receipt'}</p><div className="receipt-meta"><span>{timeAgo(receipt.blockTime)}</span>{receipt.proof && <a href={receipt.proof} target="_blank" rel="noreferrer">Proof <ExternalLink size={12} /></a>}<a href={`${EXPLORER_URL}/tx/${receipt.signature}`} target="_blank" rel="noreferrer">{short(receipt.signature, 5, 5)} <ExternalLink size={12} /></a></div></div></div>)}</div>}
          </article>
        </section>

        <section className="how-it-works"><span className="kicker">BUILT FOR BUILDERS</span><h2>A public shipping habit, in three steps.</h2><div className="steps"><div><b>01</b><h3>Connect</h3><p>Nightly switches to Cookie Chain and keeps signing in your wallet.</p></div><div><b>02</b><h3>Bake</h3><p>Your structured milestone becomes a tiny Memo v1 transaction.</p></div><div><b>03</b><h3>Verify</h3><p>BakeLog waits for confirmation, then links permanent explorer proof.</p></div></div></section>
      </main>
      <footer><span><ChefHat size={17} /> BakeLog</span><span>Built on Cookie Chain · RPC {short(RPC_URL, 18, 10)}</span><a href="https://docs.cookiechain.wtf/" target="_blank" rel="noreferrer">Developer docs <ArrowUpRight size={14} /></a></footer>
      {toast && <div className={`toast ${toast.kind}`}>{toast.kind === 'success' ? <Check size={17} /> : toast.kind === 'error' ? <CircleDot size={17} /> : <Sparkles size={17} />}{toast.message}</div>}
    </div>
  )
}
