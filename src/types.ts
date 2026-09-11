export type BakeStatus = 'idea' | 'building' | 'shipped' | 'verified'

export interface BakeReceipt {
  v: 1
  app: 'bakelog'
  title: string
  status: BakeStatus
  proof?: string
  note?: string
  createdAt: string
}

export interface ChainReceipt extends BakeReceipt {
  signature: string
  blockTime: number | null
  confirmed: boolean
}

export interface WalletAccount {
  address: string
  publicKey: Uint8Array
  chains: readonly string[]
  features: readonly string[]
}

export interface NightlySolana {
  genesisHash?: string
  standardWallet?: unknown
  changeNetwork(input: { genesisHash: string; url: string }): Promise<void>
  features: {
    'standard:connect': {
      connect(input?: { silent?: boolean }): Promise<{ accounts: readonly WalletAccount[] }>
    }
    'standard:disconnect'?: { disconnect(): Promise<void> }
    'solana:signTransaction': {
      signTransaction(...inputs: readonly {
        account: WalletAccount
        transaction: Uint8Array
        chain?: `${string}:${string}`
        options?: { preflightCommitment?: 'processed' | 'confirmed' | 'finalized' }
      }[]): Promise<readonly { signedTransaction: Uint8Array }[]>
    }
  }
}

declare global {
  interface Window {
    nightly?: { solana?: NightlySolana }
  }
}
