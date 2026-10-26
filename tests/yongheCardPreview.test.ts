import { describe, expect, it } from 'vitest'
import { isYongheCardPreviewHost } from '../src/center/runtime/yongheCardPreview'

describe('Yonghe card preview host allowlist', () => {
  it('allows only local preview hosts and the exact acceptance hostname', () => {
    expect(isYongheCardPreviewHost('localhost')).toBe(true)
    expect(isYongheCardPreviewHost('127.0.0.1')).toBe(true)
    expect(isYongheCardPreviewHost('duck-feel-rpm-barbara.trycloudflare.com')).toBe(true)
  })

  it('rejects arbitrary Cloudflare, Vercel, production, and unknown hosts', () => {
    expect(isYongheCardPreviewHost('another.trycloudflare.com')).toBe(false)
    expect(isYongheCardPreviewHost('duck-feel-rpm-barbara.trycloudflare.com.evil.test')).toBe(false)
    expect(isYongheCardPreviewHost('newtone-homes-projects.vercel.app')).toBe(false)
    expect(isYongheCardPreviewHost('preview-newtone-homes-projects.vercel.app')).toBe(false)
    expect(isYongheCardPreviewHost('newtone.example.com')).toBe(false)
    expect(isYongheCardPreviewHost('unknown.invalid')).toBe(false)
  })
})
