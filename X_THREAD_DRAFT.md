# BakeLog Launch Thread Draft

This is a draft. Post only after a real Nightly-signed Cookie Chain receipt succeeds and replace `[TX_LINK]` with the CookieScan transaction URL.

## Post 1

I built BakeLog on Cookie Chain: a tiny on-chain shipping journal that turns product milestones into signed, timestamped receipts. No backend custody, no private-key collection—just Nightly + Cookie Chain + Memo v1. 🍪

Live: https://fabledfoundryinteractive.github.io/cookie-chain-bakelog/

## Post 2

The workflow is simple:

1. Connect Nightly
2. Write what you shipped
3. Choose idea / building / shipped / verified
4. Attach an optional public proof link
5. Sign and wait for confirmation

Your receipt appears in a wallet-scoped on-chain ledger.

## Post 3

BakeLog uses Cookie Chain’s canonical Memo v1 program. Receipts use a compact, versioned `BAKELOG:v1` format, and the app reconstructs your history straight from RPC transactions—no private database or indexer required.

Verified receipt: [TX_LINK]

## Post 4

Why Cookie Chain? Standard Solana tooling, sub-second finality, and tiny fees make it a natural home for small but permanent proof-of-work records. The UI also shows live chain slots, COOK balance, confirmation status, errors, and direct CookieScan links.

## Post 5

Need COOK first? Use the official bridge linked from the Cookie Chain docs, connect a compatible wallet, verify the destination and amount carefully, then return to BakeLog to create your first receipt:

https://hyperlane.cookiescan.io/

Source: https://github.com/fabledfoundryinteractive/cookie-chain-bakelog

Built for the @TheCookieChain cApp bounty.
