import { useMemo, useState } from 'react'
import streetFixture from '../../tests/fixtures/legacy-commercial-street.json'
import cafeFixture from '../../tests/fixtures/legacy-commercial-cafe.json'

const ACTIVE_KEY = 'newtone-legacy-save-acceptance-active'
const FIXTURES = {
  street: { title: 'Commercial Street', file: 'legacy-commercial-street.json', data: streetFixture },
  cafe: { title: 'Commercial Café', file: 'legacy-commercial-cafe.json', data: cafeFixture },
}
const panelStyle = {
  position: 'fixed',
  right: 16,
  bottom: 16,
  zIndex: 2147483647,
  width: 'min(390px, calc(100vw - 32px))',
  maxHeight: 'min(76vh, 680px)',
  overflow: 'auto',
  boxSizing: 'border-box',
  padding: 16,
  border: '1px solid #7c8ca8',
  borderRadius: 12,
  background: 'rgba(12, 18, 30, 0.96)',
  color: '#f6f7fb',
  font: '14px/1.45 system-ui, sans-serif',
  boxShadow: '0 12px 40px rgba(0,0,0,.4)',
}
const buttonStyle = {
  display: 'block',
  width: '100%',
  margin: '8px 0',
  padding: '10px 12px',
  border: '1px solid #8295b6',
  borderRadius: 8,
  background: '#26334b',
  color: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  font: 'inherit',
}
const codeStyle = {
  display: 'block',
  padding: 10,
  borderRadius: 8,
  background: '#080d16',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  font: '12px/1.4 ui-monospace, monospace',
}

function currentSave() {
  try {
    const raw = window.localStorage.getItem('newtone-player-save-v1')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function importFixture(id) {
  const fixture = FIXTURES[id]?.data
  if (!fixture) return
  // This panel only runs on the dedicated preview origin. It replaces this origin's app keys with synthetic values.
  for (const key of Object.keys(window.localStorage)) {
    if (key.startsWith('newtone-')) window.localStorage.removeItem(key)
  }
  for (const [key, value] of Object.entries(fixture.storage)) {
    window.localStorage.setItem(key, value)
  }
  window.localStorage.setItem(ACTIVE_KEY, id)
  window.location.replace('/')
}

function resetFixture() {
  for (const key of Object.keys(window.localStorage)) {
    if (key.startsWith('newtone-')) window.localStorage.removeItem(key)
  }
  window.location.replace('/')
}

export default function LegacySaveAcceptancePreview() {
  const [activeId, setActiveId] = useState(() => {
    try { return window.localStorage.getItem(ACTIVE_KEY) } catch { return null }
  })
  const [expanded, setExpanded] = useState(true)
  const [refreshId, setRefreshId] = useState(0)
  const fixture = activeId ? FIXTURES[activeId] : null
  const save = useMemo(() => currentSave(), [activeId, refreshId])
  const evidence = fixture ? {
    previewOnly: true,
    sourceMainCommit: 'a5860fc202e58a450d6d7ef6a1b665b6d6d1ac43',
    fixture: fixture.file,
    legacyVersion: save?._version ?? null,
    currentSceneId: save?.currentSceneId ?? null,
    currentPosition: save?.currentPosition ?? null,
    expectedSceneId: fixture.data.expected_scene,
    expectedPosition: fixture.data.expected_position,
    sceneState: save?.sceneState?.[fixture.data.expected_scene] ?? null,
    expectedRestoredState: fixture.data.expected_restored_state,
  } : null

  if (!expanded) {
    return (
      <button type="button" onClick={() => setExpanded(true)} style={{ ...buttonStyle, ...panelStyle, width: 'auto' }}>
        Legacy save test panel
      </button>
    )
  }

  return (
    <aside style={panelStyle} aria-label="Legacy save acceptance preview">
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <strong>Legacy save acceptance · preview only</strong>
        <button type="button" onClick={() => setExpanded(false)} aria-label="Hide test panel" style={{ ...buttonStyle, width: 'auto', margin: 0, padding: '5px 9px' }}>Hide</button>
      </header>
      <p style={{ margin: '8px 0' }}>
        Base: <code>a5860fc</code>. Analytics are disabled in this build; external connections are blocked by the preview CSP.
      </p>
      <p style={{ margin: '8px 0', color: '#c8d4e8' }}>
        Synthetic fixtures only. Import writes app keys to this preview hostname's localStorage and reloads the app.
      </p>
      {!fixture ? (
        <>
          <p>Select a generated v1 save to load through the normal app startup path:</p>
          <button type="button" style={buttonStyle} onClick={() => importFixture('street')}>Import Commercial Street legacy save</button>
          <button type="button" style={buttonStyle} onClick={() => importFixture('cafe')}>Import Commercial Café legacy save</button>
        </>
      ) : (
        <>
          <p style={{ margin: '10px 0' }}>Fixture: <strong>{fixture.title}</strong> · {fixture.file}</p>
          <p style={{ margin: '8px 0' }}>Expected resumed location: <strong>{fixture.data.expected_scene}</strong> at ({fixture.data.expected_position.x}, {fixture.data.expected_position.y}). Compare with the scene behind this panel.</p>
          <button type="button" style={buttonStyle} onClick={() => setRefreshId(value => value + 1)}>Refresh evidence from current save</button>
          <button type="button" style={buttonStyle} onClick={() => importFixture(activeId === 'street' ? 'cafe' : 'street')}>Switch to {activeId === 'street' ? 'Commercial Café' : 'Commercial Street'}</button>
          <button type="button" style={buttonStyle} onClick={resetFixture}>Clear preview save and restart</button>
          <strong>Observed save snapshot</strong>
          <pre style={codeStyle}>{JSON.stringify(evidence, null, 2)}</pre>
        </>
      )}
    </aside>
  )
}
