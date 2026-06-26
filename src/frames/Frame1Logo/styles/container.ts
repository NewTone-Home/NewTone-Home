import type { CSSProperties } from "react"

export const containerStyle: CSSProperties = {
  width: "100vw",
  height: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  background:
    "radial-gradient(circle at 50% 42%, rgba(43, 72, 86, 0.28), transparent 34%), linear-gradient(145deg, #070a0f 0%, #0b1118 52%, #07070a 100%)",
  color: "#eef8f8",
  position: "relative",
}

export const slotStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 48,
}
