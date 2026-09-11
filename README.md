# BakeLog

BakeLog is an open-source shipping journal for Cookie Chain. Builders connect a Nightly wallet, write a compact structured milestone to the genesis Memo v1 program, wait for on-chain confirmation, and see a wallet-scoped proof ledger with links to CookieScan.

## Why it exists

Shipping updates are usually scattered across chats, issue trackers, and social posts. BakeLog turns them into cheap, signed, timestamped receipts without introducing a custodial backend or custom indexer.

## Features

- Nightly-first wallet connection and Cookie Chain network switching.
- Real Cookie Chain transactions using the genesis Memo v1 program.
- Confirmed transaction feedback with CookieScan explorer links.
- Structured `BAKELOG:v1` receipt format with status, proof URL, note, and timestamp.
- Wallet-specific history reconstructed directly from RPC transaction data.
- Live network slot and COOK balance.
- Responsive, accessible interface and no server-side custody.

## Run locally

Requirements: Node.js 22+ and the Nightly wallet extension.

```bash
npm install
npm run dev
```

In Nightly, approve the switch to Cookie Chain when prompted. The app uses:

- HTTP RPC: `https://rpc.cookiescan.io`
- WebSocket: `https://wss.cookiescan.io`
- Memo program: `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`

## Verification

```bash
npm test
npm run build
```

Tests cover receipt encoding/decoding, malformed memo rejection, proof URL safety, and on-chain size constraints. A complete runtime verification also requires Nightly on Cookie Chain and enough COOK for one network fee (approximately 0.000005 COOK).

## Receipt format

Each memo starts with `BAKELOG:v1:` and contains compact JSON:

```json
{
  "v": 1,
  "app": "bakelog",
  "title": "Ship the public beta",
  "status": "shipped",
  "proof": "https://github.com/example/release",
  "note": "All release gates passed.",
  "createdAt": "2026-09-11T12:00:00.000Z"
}
```

## Security

- BakeLog never requests, reads, or stores seed phrases or private keys.
- Nightly signs locally and shows the transaction to the user.
- Proof links are limited to `http` and `https` schemes.
- Receipts are public and permanent; users should not include secrets or personal data.

## License

MIT
