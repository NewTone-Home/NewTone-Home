import { useEntryStore } from "../store/useEntryStore"

export function PlaceholderWorldHall({ worldId }: { worldId: string }) {
  const reset = useEntryStore((s) => s.resetStorage)
  return (
    <div style={containerStyle}>
      <div style={titleStyle}>世界门厅</div>
      <div style={subtitleStyle}>worldId: {worldId}</div>
      <div style={pendingStyle}>🅿️ 此页面待 Frame 2+ 实装</div>
      <button
        onClick={() => { reset(); window.location.reload() }}
        style={resetButtonStyle}
      >
        🔧 重置（回到 Frame 1）
      </button>
    </div>
  )
}

export function PlaceholderMultiverse() {
  const reset = useEntryStore((s) => s.resetStorage)
  return (
    <div style={containerStyle}>
      <div style={titleStyle}>多元宇宙大地图</div>
      <div style={pendingStyle}>🅿️ 此页面待后续实装</div>
      <button
        onClick={() => { reset(); window.location.reload() }}
        style={resetButtonStyle}
      >
        🔧 重置（回到 Frame 1）
      </button>
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  width: "100vw",
  height: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  background: "#fff",
  color: "#111",
  fontFamily: '"Noto Serif SC", serif',
  gap: 16,
}

const titleStyle: React.CSSProperties = {
  fontFamily: '"Cormorant Garamond", serif',
  fontSize: 40,
  fontWeight: 300,
  letterSpacing: "0.05em",
}

const subtitleStyle: React.CSSProperties = {
  fontSize: 14,
  color: "#666",
  fontFamily: "monospace",
}

const pendingStyle: React.CSSProperties = {
  fontSize: 14,
  color: "#999",
  marginTop: 8,
}

const resetButtonStyle: React.CSSProperties = {
  marginTop: 24,
  background: "transparent",
  border: "1px solid #ccc",
  padding: "8px 20px",
  fontSize: 13,
  color: "#666",
  cursor: "pointer",
  fontFamily: "monospace",
}
