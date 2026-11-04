import React from 'react'
export default function RuntimeRecoveryPanel({ language, text, phase, evidence, onBack, onRecheck, style, warnings = [] }) {
  const busy = phase === 'probing' || phase === 'committing' || phase === 'entering'
  return <main className="save-runtime-recovery" style={style} lang={language} data-runtime-recovery
    data-recovery-first-reason={evidence?.first?.message ?? ''} data-recovery-event-count={evidence?.events?.length ?? 0}>
    <section>
      <h1>NewTone</h1>
      <p role="alert">{phase === 'uncertain' ? text.uncertain : busy ? text.probing : text.runtimeStopped}</p>
      {warnings.map(message => <p key={message} role="status">{message}</p>)}
      <nav aria-label={text.recoveryActions}>
        {phase !== 'uncertain' && <button type="button" disabled={busy} onClick={onBack}>{text.back}</button>}
        <button type="button" disabled={busy} onClick={onRecheck}>{phase === 'uncertain' ? text.resolve : text.reinspect}</button>
      </nav>
    </section>
  </main>
}
