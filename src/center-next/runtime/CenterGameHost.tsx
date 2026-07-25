import { useEffect, useRef } from 'react'
import type {
  CenterDefinition,
  CenterViewSnapshot,
  CenterWorldSnapshot,
} from '../domain/contracts'
import type { CenterBridge } from './CenterBridge'
import { CenterRuntimeSession } from './CenterRuntimeSession'
import { phaserCenterLauncher } from './PhaserCenterLauncher'
import type { CenterRuntimeLauncher } from './types'

interface CenterGameHostProps {
  bridge: CenterBridge
  definition: CenterDefinition
  world: CenterWorldSnapshot
  view: CenterViewSnapshot
  assetUrls: Record<string, string>
  launcher?: CenterRuntimeLauncher
}

/**
 * React 侧只做三件事：开启 session、关闭 session、把 props 推进消息通道。
 * 它不接触 Phaser，也不直接把快照交给 Scene。
 */
export function CenterGameHost({
  bridge,
  definition,
  world,
  view,
  assetUrls,
  launcher = phaserCenterLauncher,
}: CenterGameHostProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  // session 启动时必须用当前最新快照，而不是首次挂载时捕获的旧值。
  const latestRef = useRef({ world, view })
  latestRef.current = { world, view }

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    host.replaceChildren()

    const session = new CenterRuntimeSession({
      bridge,
      definition,
      assetUrls,
      world: latestRef.current.world,
      view: latestRef.current.view,
      launcher,
    })
    session.start(host)

    return () => session.stop()
  }, [assetUrls, bridge, definition, launcher])

  useEffect(() => {
    bridge.pushWorld(world)
  }, [bridge, world])

  useEffect(() => {
    bridge.pushView(view)
  }, [bridge, view])

  return <div ref={hostRef} className="center-next-canvas" data-testid="center-next-canvas" />
}
