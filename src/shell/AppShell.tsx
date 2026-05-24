import { useEffect } from "react"
import { useEntryStore } from "../store"
import { Frame1Logo } from "../frames/Frame1Logo"
import { Placeholder } from "../frames/Placeholder"
import { ErrorBoundary } from "./ErrorBoundary"
import { HeartbeatDot } from "./HeartbeatDot"
import { DevResetButton } from "./DevResetButton"

// AppShell：根据 destination.kind 路由到对应 frame
// + 全局配饰（HeartbeatDot, DevResetButton）
// + 错误边界
export function AppShell() {
  const init = useEntryStore((s) => s.init)
  const destination = useEntryStore((s) => s.destination)

  useEffect(() => {
    init()
  }, [init])

  // destination 在 init() 完成后才有值
  if (!destination) return null

  return (
    <ErrorBoundary>
      {destination.kind === "full_logo" && <Frame1Logo variant="full" />}
      {destination.kind === "transient_logo" && (
        <Frame1Logo variant="transient" transientNext={destination.next} />
      )}
      {destination.kind === "world_hall" && (
        <Placeholder
          label="世界大厅"
          hint={`世界 ID：${destination.worldId}（Frame 2 待实装）`}
        />
      )}
      {destination.kind === "multiverse" && (
        <Placeholder label="多元宇宙" hint="（Frame 3 待实装）" />
      )}
      <HeartbeatDot />
      <DevResetButton />
    </ErrorBoundary>
  )
}
