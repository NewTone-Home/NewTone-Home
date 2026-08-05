# Owner authentication and recovery

The private `/admin` surface supports two Supabase Auth entry methods:

- Email magic link, with account creation disabled.
- GitHub OAuth, as a fallback when the default email provider is delayed or rate-limited.

Authentication alone never grants admin access. After either method returns to `/admin`, the application loads the owner draft using the authenticated Supabase user ID. Database RLS and `private.owner_allowlist` remain the authorization gate; an authenticated identity that is not allow-listed cannot read, edit, or publish a draft.

Supabase automatically links an OAuth identity to an existing user when the provider returns the same verified email. The owner must therefore authorize the GitHub account whose verified email matches the existing owner account. If the provider returns another email or creates another user ID, access remains denied until that exact user ID is deliberately reviewed and allow-listed.

## GitHub OAuth configuration

Create one GitHub OAuth App under the NewTone publishing account:

- Application name: `NewTone Owner Studio`
- Homepage URL: the protected Vercel Preview origin (later update to the canonical production origin)
- Authorization callback URL: `https://bxowbscoffhmavrccxnm.supabase.co/auth/v1/callback`
- Device Flow: disabled

Then open Supabase **Authentication → Sign In / Providers → GitHub**, enable the provider, and enter the OAuth App Client ID and Client Secret. Secrets belong only in the GitHub and Supabase dashboards; they must never be placed in Vite environment variables, source control, screenshots, or documentation.

The Preview and Production `/admin` URLs must also remain in Supabase Auth's redirect allow-list. After configuration, test with the sole owner account and confirm the existing owner user ID is retained before relying on GitHub as the recovery method.
