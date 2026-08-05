import { useEffect, useRef } from 'react'
import { advanceAdminSequence, createAdminSequenceState, isTextEditingTarget } from './adminAccessSequence'

function AdminSequenceGate() {
  const sequence = useRef(createAdminSequenceState())
  useEffect(() => {
    const onKeyDown = event => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || isTextEditingTarget(event.target)) return
      const result = advanceAdminSequence(sequence.current, event.key, Date.now())
      sequence.current = result.state
      if (result.matched) window.location.assign('/admin')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
  return null
}

export default AdminSequenceGate
