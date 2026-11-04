import { Component } from 'react'

// This boundary stays mounted while its runtime child is removed. In particular,
// a revoked child's unmount effect must not tear down the recovery controls.
export default class RuntimeRecoveryBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null, resetKey: props.resetKey } }
  static getDerivedStateFromProps(props, state) {
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null
  }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { this.props.onError(error, { stage: 'runtime-boundary', componentStack: info.componentStack }) }
  render() { return this.state.error ? this.props.fallback ?? null : this.props.children }
}
