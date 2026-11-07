import { useId } from 'react'
import './PlayerAccount.css'

const copy = {
  zh: { title: '玩家账号', email: '邮箱', code: '邮箱验证码', send: '发送验证码', verify: '验证并登录', resend: '重新发送', change: '更换邮箱', google: '使用 Google 登录', guest: '继续以游客游玩', logout: '退出账号', pending: '正在处理，请稍候…', checking: '正在确认登录状态…', unavailable: '邮箱登录暂未开放，你仍可继续游玩。', retained: '注册后将自动保留当前存档，无需额外绑定。', sent: '验证码已发送至', signedIn: '已登录', error: '暂时无法完成，请重试。' },
  en: { title: 'Player account', email: 'Email', code: 'Email verification code', send: 'Send code', verify: 'Verify and sign in', resend: 'Resend code', change: 'Change email', google: 'Continue with Google', guest: 'Continue as guest', logout: 'Sign out', pending: 'Working, please wait…', checking: 'Checking sign-in status…', unavailable: 'Email sign-in is not available yet. You can still play as a guest.', retained: 'Registration will automatically keep your current save. No extra binding step.', sent: 'Code sent to', signedIn: 'Signed in', error: 'Unable to complete this action. Please try again.' },
}

/** Presentation only. Parent owns form values, auth controller and pending/error handling. */
export default function PlayerAuthPanel({
  snapshot = { status: 'unknown' }, language = 'zh', otpReady = false, googleReady = false,
  emailInput = '', codeInput = '', onEmailChange, onCodeChange,
  onRequestOtp, onVerifyOtp, onGoogle, onLogout, onCancel, onGuest,
  pending = false, error = null,
}) {
  const text = copy[language === 'en' ? 'en' : 'zh']
  const id = useId()
  const busy = Boolean(snapshot.pending || pending)
  const signedIn = snapshot.status === 'authenticated' && Boolean(snapshot.user?.id)
  const checking = snapshot.status === 'unknown'
  const email = snapshot.email || ''
  const enabled = otpReady === true && !busy && snapshot.status === 'signed_out'
  const shownError = error || snapshot.error
  const request = () => { if (enabled && onRequestOtp) onRequestOtp(email || emailInput.trim()) }
  return <section className="player-account" aria-labelledby={`${id}-title`} aria-busy={busy}>
    <h2 id={`${id}-title`}>{text.title}</h2>
    {checking && <p role="status">{text.checking}</p>}
    {signedIn ? <>
      <p>{text.signedIn}{snapshot.user.email ? ` · ${snapshot.user.email}` : ''}</p>
      <button type="button" disabled={busy || !onLogout} onClick={() => { if (!busy) onLogout?.() }}>{text.logout}</button>
    </> : <>
      <p className="player-account-note">{text.retained}</p>
      {otpReady !== true && <p role="status">{text.unavailable}</p>}
      {email ? <form onSubmit={event => {
        event.preventDefault()
        if (enabled && /^\d{6,10}$/.test(codeInput.trim())) onVerifyOtp?.(email, codeInput.trim())
      }}>
        <p>{text.sent} <strong>{email}</strong></p>
        <label htmlFor={`${id}-code`}>{text.code}</label>
        <input id={`${id}-code`} name="otp" type="text" inputMode="numeric" autoComplete="one-time-code"
          pattern="[0-9]{6,10}" minLength={6} maxLength={10} required value={codeInput}
          disabled={!enabled || !onCodeChange} onChange={event => onCodeChange?.(event.target.value)} />
        <button type="submit" disabled={!enabled || !onVerifyOtp || !/^\d{6,10}$/.test(codeInput.trim())}>{text.verify}</button>
        <div className="player-account-actions">
          <button type="button" disabled={!enabled || !onRequestOtp} onClick={request}>{text.resend}</button>
          <button type="button" disabled={busy || !onCancel} onClick={() => { if (!busy) onCancel?.() }}>{text.change}</button>
        </div>
      </form> : <form onSubmit={event => { event.preventDefault(); request() }}>
        <label htmlFor={`${id}-email`}>{text.email}</label>
        <input id={`${id}-email`} name="email" type="email" autoComplete="email" autoCapitalize="none"
          spellCheck={false} maxLength={254} required value={emailInput}
          disabled={!enabled || !onEmailChange} onChange={event => onEmailChange?.(event.target.value)} />
        <button type="submit" disabled={!enabled || !onRequestOtp || !emailInput.trim()}>{text.send}</button>
      </form>}
      {googleReady === true && <button type="button" disabled={busy || snapshot.status !== 'signed_out' || !onGoogle} onClick={() => { if (!busy && snapshot.status === 'signed_out') onGoogle?.() }}>{text.google}</button>}
      <button type="button" className="player-account-guest" disabled={!onGuest} onClick={() => onGuest?.()}>{text.guest}</button>
    </>}
    {busy && <p role="status" aria-live="polite">{text.pending}</p>}
    {shownError && <p role="alert">{typeof shownError.message === 'string' ? shownError.message : text.error}</p>}
  </section>
}
