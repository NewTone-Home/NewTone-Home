import { describe, expect, it, vi } from 'vitest'
import { adminRedirectUrl, requestAdminMagicLink, signInAdminWithGitHub } from '../src/admin/adminAuth'

describe('owner authentication methods', () => {
  it('keeps both methods on the same protected admin return route', () => {
    expect(adminRedirectUrl('https://preview.example')).toBe('https://preview.example/admin')
  })

  it('prevents email sign-in from creating an unapproved account', async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null })
    await requestAdminMagicLink({ auth: { signInWithOtp } }, 'owner@example.com', 'https://preview.example')
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'owner@example.com',
      options: { shouldCreateUser: false, emailRedirectTo: 'https://preview.example/admin' },
    })
  })

  it('starts GitHub OAuth without granting application authorization', async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({ error: null })
    await signInAdminWithGitHub({ auth: { signInWithOAuth } }, 'https://preview.example')
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'github',
      options: { redirectTo: 'https://preview.example/admin' },
    })
  })
})
