import { Component } from 'react'
import { runtimeFailureRecord } from '../services/runtimeRecovery.mjs'

export function boundaryRecoveryPresentation(current, captured) {
  if (!['entering', 'failed', 'uncertain', 'probing'].includes(current.phase)) return null
  return {
    phase: current.phase === 'entering' ? 'failed' : current.phase,
    evidence: current.runtimeEvidence ?? captured,
  }
}
export function runBoundaryRecoveryAction(controller, captured, action) {
  if (controller.getState().phase === 'entering') controller.runtimeFailed(captured)
  return action === 'back' ? controller.back() : controller.recheck()
}

// This boundary stays mounted while its runtime child is removed. In particular,
// a revoked child's unmount effect must not tear down the recovery controls.
export default class RuntimeRecoveryBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null, evidence: null, resetKey: props.resetKey } }
  static getDerivedStateFromProps(props, state) {
    return props.resetKey !== state.resetKey ? { error: null, evidence: null, resetKey: props.resetKey } : null
  }
  static getDerivedStateFromError(error) { return { error, evidence: runtimeFailureRecord(error, { stage: 'runtime-boundary' }) } }
  componentDidCatch(error, info) { this.props.onError(error, { stage: 'runtime-boundary', componentStack: info.componentStack }) }
  render() { return this.state.error ? this.props.renderFallback?.(this.state.evidence) ?? this.props.fallback ?? null : this.props.children }
}
