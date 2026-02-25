import { describe, it, expect, vi, beforeEach } from 'vitest'

/*
 * The ipfsService uses FileReader (browser API) which is not available in
 * vitest's default Node environment. We stub it before importing the module.
 */

class MockFileReader {
  result: string | ArrayBuffer | null = null
  onload: ((ev: any) => void) | null = null
  onerror: ((ev: any) => void) | null = null

  readAsDataURL(blob: Blob) {
    // Simulate async read by resolving via microtask
    blob.text().then(text => {
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${btoa(text)}`
      if (this.onload) {
        this.onload({ target: { result: this.result } } as any)
      }
    })
  }
}

vi.stubGlobal('FileReader', MockFileReader)

/* ─── Reset modules before each test so import.meta.env changes take effect ─── */

beforeEach(() => {
  vi.resetModules()
  // Re-stub FileReader after resetModules
  vi.stubGlobal('FileReader', MockFileReader)
})

/* ════════════════════════════════════════════ */

describe('ipfsService', () => {
  /* ─── encryptFile ─── */

  describe('encryptFile', () => {
    it('produces a Blob from a file and secret key', async () => {
      const { encryptFile } = await import('./ipfsService')
      const file = new File(['hello world'], 'test.txt', { type: 'text/plain' })

      const result = await encryptFile(file, 'my-secret-key')

      expect(result).toBeInstanceOf(Blob)
      expect(result.type).toBe('application/octet-stream')
      expect(result.size).toBeGreaterThan(0)
    })

    it('produces different output for different keys', async () => {
      const { encryptFile } = await import('./ipfsService')
      const file1 = new File(['same content'], 'a.txt', { type: 'text/plain' })
      const file2 = new File(['same content'], 'b.txt', { type: 'text/plain' })

      const blob1 = await encryptFile(file1, 'key-alpha')
      const blob2 = await encryptFile(file2, 'key-beta')

      const text1 = await blob1.text()
      const text2 = await blob2.text()

      // Different keys should produce different ciphertext
      expect(text1).not.toBe(text2)
    })

    it('produces output larger than zero bytes', async () => {
      const { encryptFile } = await import('./ipfsService')
      const file = new File(['data'], 'f.txt', { type: 'text/plain' })

      const result = await encryptFile(file, 'k')
      expect(result.size).toBeGreaterThan(0)
    })
  })

  /* ─── pinToIPFS (mock mode — no PINATA_JWT) ─── */

  describe('pinToIPFS (mock mode)', () => {
    beforeEach(() => {
      // Replace setTimeout with immediate resolution to avoid 2.5s delay per call
      vi.useFakeTimers()
    })

    it('returns success with a pseudo-CID when no JWT is set', async () => {
      const { pinToIPFS } = await import('./ipfsService')
      const blob = new Blob(['test data'], { type: 'application/octet-stream' })

      const promise = pinToIPFS(blob, 'test-file.bin')
      // Advance past the 2500ms simulated delay
      await vi.advanceTimersByTimeAsync(3000)
      const result = await promise

      expect(result.success).toBe(true)
      expect(result.cid).toBeDefined()
      expect(result.cid!.startsWith('bafybei')).toBe(true)
      expect(result.size).toBe(blob.size)

      vi.useRealTimers()
    })

    it('generated mock CIDs are unique across calls', async () => {
      const { pinToIPFS } = await import('./ipfsService')
      const blob = new Blob(['data'], { type: 'text/plain' })

      const p1 = pinToIPFS(blob, 'a.bin')
      await vi.advanceTimersByTimeAsync(3000)
      const r1 = await p1

      const p2 = pinToIPFS(blob, 'b.bin')
      await vi.advanceTimersByTimeAsync(3000)
      const r2 = await p2

      expect(r1.cid).not.toBe(r2.cid)

      vi.useRealTimers()
    })
  })

  /* ─── getGatewayUrl ─── */

  describe('getGatewayUrl', () => {
    it('formats a gateway URL with the default Pinata gateway', async () => {
      const { getGatewayUrl } = await import('./ipfsService')
      const cid = 'bafybeiexample1234567890'

      const url = getGatewayUrl(cid)

      expect(url).toBe(`https://gateway.pinata.cloud/ipfs/${cid}`)
    })

    it('includes the full CID in the URL', async () => {
      const { getGatewayUrl } = await import('./ipfsService')
      const cid = 'QmSomeOldStyleCIDv0Hash'

      const url = getGatewayUrl(cid)

      expect(url).toContain(cid)
      expect(url.endsWith(cid)).toBe(true)
    })
  })
})
