import { Buffer } from 'node:buffer'
import { PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js'

const rpcUrl = 'https://rpc.cookiescan.io'
const memoProgram = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')
// Documented Cookie Jar community vault. Used only as an existing account in a
// sigVerify=false simulation; the transaction is never signed or submitted.
const simulationPayer = new PublicKey('568tU9FMksJDxjkLBjWisSA4J4C5uPH87NCCkyREwrxe')
const memo = `BAKELOG:v1:${JSON.stringify({
  v: 1,
  app: 'bakelog',
  title: 'Live RPC simulation',
  status: 'verified',
  proof: 'https://github.com/fabledfoundryinteractive/cookie-chain-bakelog',
  note: 'This payload was simulated and was not written on-chain.',
  createdAt: new Date().toISOString(),
})}`

async function rpc(method, params) {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`)
  const body = await response.json()
  if (body.error) throw new Error(`RPC ${body.error.code}: ${body.error.message}`)
  return body.result
}

const latest = await rpc('getLatestBlockhash', [{ commitment: 'confirmed' }])
const transaction = new Transaction({
  feePayer: simulationPayer,
  recentBlockhash: latest.value.blockhash,
}).add(new TransactionInstruction({
  programId: memoProgram,
  keys: [{ pubkey: simulationPayer, isSigner: true, isWritable: false }],
  data: Buffer.from(memo, 'utf8'),
}))

const encoded = transaction.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64')
const simulation = await rpc('simulateTransaction', [encoded, {
  encoding: 'base64',
  sigVerify: false,
  replaceRecentBlockhash: true,
  commitment: 'confirmed',
}])

if (simulation.value.err) throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`)
const logs = simulation.value.logs ?? []
if (!logs.some((line) => line.includes('Memo'))) throw new Error('Memo program did not appear in simulation logs.')

console.log(JSON.stringify({
  rpc: rpcUrl,
  memoProgram: memoProgram.toBase58(),
  payloadBytes: Buffer.byteLength(memo),
  unitsConsumed: simulation.value.unitsConsumed,
  result: 'ok',
  mutation: 'none (simulateTransaction)',
}, null, 2))
