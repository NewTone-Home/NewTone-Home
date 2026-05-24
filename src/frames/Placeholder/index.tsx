import {
  placeholderContainerStyle,
  placeholderLabelStyle,
  placeholderHintStyle,
} from "./styles"

export type PlaceholderProps = {
  label: string
  hint?: string
}

// 通用占位 frame：用于 Frame 2 / Frame 3 未实装阶段
// 将来真正实装时，替换 AppShell 里的 import 即可
export function Placeholder({ label, hint }: PlaceholderProps) {
  return (
    <div style={placeholderContainerStyle}>
      <div style={placeholderLabelStyle}>{label}</div>
      {hint && <div style={placeholderHintStyle}>{hint}</div>}
    </div>
  )
}
