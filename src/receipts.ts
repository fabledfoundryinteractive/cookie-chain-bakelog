import type { BakeReceipt, BakeStatus } from './types'

export const MEMO_PREFIX = 'BAKELOG:v1:'
export const MAX_MEMO_BYTES = 566
export const STATUSES: BakeStatus[] = ['idea', 'building', 'shipped', 'verified']

export function isHttpUrl(value: string): boolean {
  if (!value) return true
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

export function makeReceipt(input: {
  title: string
  status: BakeStatus
  proof?: string
  note?: string
  now?: Date
}): BakeReceipt {
  const title = input.title.trim()
  const proof = input.proof?.trim() || undefined
  const note = input.note?.trim() || undefined
  if (title.length < 3 || title.length > 80) throw new Error('Title must be 3–80 characters.')
  if (!STATUSES.includes(input.status)) throw new Error('Choose a valid milestone status.')
  if (proof && !isHttpUrl(proof)) throw new Error('Proof must be an http(s) URL.')
  if (note && note.length > 180) throw new Error('Note must be 180 characters or fewer.')

  const receipt: BakeReceipt = {
    v: 1,
    app: 'bakelog',
    title,
    status: input.status,
    proof,
    note,
    createdAt: (input.now ?? new Date()).toISOString(),
  }
  if (memoBytes(receipt) > MAX_MEMO_BYTES) throw new Error('Receipt is too large for an on-chain memo.')
  return receipt
}

export function encodeReceipt(receipt: BakeReceipt): string {
  return `${MEMO_PREFIX}${JSON.stringify(receipt)}`
}

export function memoBytes(receipt: BakeReceipt): number {
  return new TextEncoder().encode(encodeReceipt(receipt)).byteLength
}

export function parseReceipt(value: unknown): BakeReceipt | null {
  if (typeof value !== 'string' || !value.startsWith(MEMO_PREFIX)) return null
  try {
    const parsed = JSON.parse(value.slice(MEMO_PREFIX.length)) as Partial<BakeReceipt>
    if (
      parsed.v !== 1 || parsed.app !== 'bakelog' || typeof parsed.title !== 'string' ||
      !STATUSES.includes(parsed.status as BakeStatus) || typeof parsed.createdAt !== 'string'
    ) return null
    if (parsed.proof !== undefined && (typeof parsed.proof !== 'string' || !isHttpUrl(parsed.proof))) return null
    if (parsed.note !== undefined && typeof parsed.note !== 'string') return null
    return parsed as BakeReceipt
  } catch {
    return null
  }
}
