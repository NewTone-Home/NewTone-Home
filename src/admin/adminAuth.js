export function adminRedirectUrl(origin = window.location.origin) {
  return `${origin}/admin`
}

export function requestAdminMagicLink(supabase, email, origin) {
  return supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: adminRedirectUrl(origin),
    },
  })
}

export function signInAdminWithGitHub(supabase, origin) {
  return supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: adminRedirectUrl(origin),
    },
  })
}
