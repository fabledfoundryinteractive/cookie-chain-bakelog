import { describe, expect, it } from 'vitest'
import { encodeReceipt, makeReceipt, parseReceipt } from './receipts'

describe('BakeLog receipt format', () => {
  it('round-trips a valid receipt', () => {
    const receipt = makeReceipt({
      title: 'Ship the public beta',
      status: 'shipped',
      proof: 'https://example.com/release',
      note: 'All release gates passed.',
      now: new Date('2026-09-11T12:00:00Z'),
    })
    expect(parseReceipt(encodeReceipt(receipt))).toEqual(receipt)
  })

  it('rejects unrelated and malformed memos', () => {
    expect(parseReceipt('hello chain')).toBeNull()
    expect(parseReceipt('BAKELOG:v1:{broken')).toBeNull()
  })

  it('rejects unsafe proof protocols', () => {
    expect(() => makeReceipt({ title: 'Unsafe proof', status: 'idea', proof: 'javascript:alert(1)' })).toThrow()
  })

  it('enforces concise on-chain content', () => {
    expect(() => makeReceipt({ title: 'x'.repeat(81), status: 'building' })).toThrow()
    expect(() => makeReceipt({ title: 'Valid title', status: 'building', note: 'x'.repeat(181) })).toThrow()
  })
})
