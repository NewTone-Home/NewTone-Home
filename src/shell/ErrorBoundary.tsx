import { Component, type ErrorInfo, type ReactNode } from "react"

type Props = { children: ReactNode }
type State = { hasError: boolean; error?: Error }

const errorContainerStyle = {
  padding: 32,
  fontFamily: "monospace",
  color: "#c00",
  background: "#fff5f5",
  minHeight: "100vh",
} as const

const errorTitleStyle = {
  marginBottom: 16,
  fontSize: 18,
} as const

const errorPreStyle = {
  whiteSpace: "pre-wrap" as const,
  fontSize: 13,
}

// 顶层错误边界：捕获子树渲染异常，显示 fallback
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={errorContainerStyle}>
          <h2 style={errorTitleStyle}>出错了</h2>
          <pre style={errorPreStyle}>{this.state.error?.message}</pre>
        </div>
      )
    }
    return this.props.children
  }
}
