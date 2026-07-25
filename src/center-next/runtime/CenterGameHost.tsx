import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import type {
  CenterDefinition,
  CenterViewSnapshot,
  CenterWorldSnapshot,
} from '../domain/contracts'
import type { CenterBridge } from './CenterBridge'
import { CenterScene } from './CenterScene'

interface CenterGameHostProps {
  bridge: CenterBridge
  definition: CenterDefinition
  world: CenterWorldSnapshot
  view: CenterViewSnapshot
  assetUrls: Record<string, string>
}

export function CenterGameHost({
  bridge,
  definition,
  world,
  view,
  assetUrls,
}: CenterGameHostProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const initialWorldRef = useRef(world)
  const initialViewRef = useRef(view)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    host.replaceChildren()
    bridge.start({ definition, world: initialWorldRef.current, view: initialViewRef.current, assetUrls })

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      width: Math.max(1, host.clientWidth),
      height: Math.max(1, host.clientHeight),
      transparent: true,
      render: { antialias: true, roundPixels: false },
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [],
      callbacks: {
        postBoot: instance => {
          instance.scene.add('newtone-center-world', CenterScene, true, {
            bridge,
            definition,
            initialWorld: initialWorldRef.current,
            initialView: initialViewRef.current,
            assetUrls,
          })
        },
      },
    })

    return () => {
      game.destroy(true)
      host.replaceChildren()
    }
  }, [assetUrls, bridge, definition])

  useEffect(() => bridge.pushWorld(world), [bridge, world])
  useEffect(() => bridge.pushView(view), [bridge, view])

  return <div ref={hostRef} className="center-next-canvas" data-testid="center-next-canvas" />
}
