import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import surfaceWorldMapArt from '../../../assets/center/surface/surface-world-map-v2.png'

const WORLD = {
  width: 3072,
  height: 1728,
}

const LANDMARKS = {
  'surface-estate': { x: 0.145, y: 0.13, width: 0.12, height: 0.09 },
  'surface-council': { x: 0.555, y: 0.45, width: 0.12, height: 0.09 },
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

function SurfaceWorldPhaser({ nodes, onHoverStart, onHoverEnd, onOpenDetail }) {
  const hostRef = useRef(null)
  const callbacksRef = useRef({ onHoverStart, onHoverEnd, onOpenDetail })

  useEffect(() => {
    callbacksRef.current = { onHoverStart, onHoverEnd, onOpenDetail }
  }, [onHoverStart, onHoverEnd, onOpenDetail])

  useEffect(() => {
    const parent = hostRef.current
    if (!parent) return undefined

    let game

    class SurfaceWorldScene extends Phaser.Scene {
      constructor() {
        super('surface-world')
        this.targetZoom = 1
        this.minZoom = 1
        this.maxZoom = 2
        this.zoomAnchor = null
        this.drag = null
      }

      preload() {
        this.load.image('surface-world-map', surfaceWorldMapArt)
      }

      create() {
        this.add
          .image(0, 0, 'surface-world-map')
          .setOrigin(0)
          .setDisplaySize(WORLD.width, WORLD.height)

        const camera = this.cameras.main
        camera.setBounds(0, 0, WORLD.width, WORLD.height)
        this.resetZoomRange(true)

        nodes.forEach(node => {
          const landmark = LANDMARKS[node.id]
          if (!landmark) return

          const x = landmark.x * WORLD.width
          const y = landmark.y * WORLD.height
          const width = landmark.width * WORLD.width
          const height = landmark.height * WORLD.height

          const outline = this.add.graphics()
          outline.lineStyle(5, 0xd9a441, 0.82)
          outline.strokeRoundedRect(x, y, width, height, 22)
          outline.setAlpha(0)

          const zone = this.add
            .zone(x + width / 2, y + height / 2, width, height)
            .setInteractive({ useHandCursor: true })

          zone.on('pointerover', pointer => {
            outline.setAlpha(1)
            callbacksRef.current.onHoverStart?.(node.id, {
              clientX: pointer.event?.clientX ?? pointer.x,
              clientY: pointer.event?.clientY ?? pointer.y,
            })
          })

          zone.on('pointerout', () => {
            outline.setAlpha(0)
            callbacksRef.current.onHoverEnd?.(node.id)
          })

          zone.on('pointerup', pointer => {
            if (pointer.leftButtonReleased()) {
              callbacksRef.current.onOpenDetail?.(node.id)
            }
          })
        })

        this.input.on('wheel', (pointer, _objects, _deltaX, deltaY) => {
          const cameraNow = this.cameras.main
          const worldPoint = cameraNow.getWorldPoint(pointer.x, pointer.y)
          const zoomFactor = Math.exp(-deltaY * 0.0015)

          this.targetZoom = clamp(
            this.targetZoom * zoomFactor,
            this.minZoom,
            this.maxZoom,
          )
          this.zoomAnchor = {
            screenX: pointer.x,
            screenY: pointer.y,
            worldX: worldPoint.x,
            worldY: worldPoint.y,
          }
        })

        this.input.on('pointerdown', pointer => {
          if (!pointer.rightButtonDown()) return
          this.drag = {
            pointerX: pointer.x,
            pointerY: pointer.y,
            scrollX: camera.scrollX,
            scrollY: camera.scrollY,
          }
        })

        this.input.on('pointermove', pointer => {
          if (!this.drag || !pointer.rightButtonDown()) return
          camera.scrollX = this.drag.scrollX - (pointer.x - this.drag.pointerX) / camera.zoom
          camera.scrollY = this.drag.scrollY - (pointer.y - this.drag.pointerY) / camera.zoom
          this.clampCamera()
          this.zoomAnchor = null
        })

        this.input.on('pointerup', () => {
          this.drag = null
        })

        this.scale.on('resize', gameSize => {
          const center = camera.getWorldPoint(camera.width / 2, camera.height / 2)
          camera.setSize(gameSize.width, gameSize.height)
          this.resetZoomRange(false)
          camera.scrollX = center.x - camera.width / (2 * camera.zoom)
          camera.scrollY = center.y - camera.height / (2 * camera.zoom)
          this.clampCamera()
        })
      }

      resetZoomRange(resetCamera) {
        const camera = this.cameras.main
        const coverZoom = Math.max(
          camera.width / WORLD.width,
          camera.height / WORLD.height,
        )

        this.minZoom = coverZoom * 1.18
        this.maxZoom = this.minZoom * 2.15
        this.targetZoom = clamp(
          resetCamera ? this.minZoom : this.targetZoom,
          this.minZoom,
          this.maxZoom,
        )

        if (resetCamera) {
          camera.setZoom(this.targetZoom)
          camera.centerOn(WORLD.width / 2, WORLD.height / 2)
          this.clampCamera()
        }
      }

      clampCamera() {
        const camera = this.cameras.main
        const visibleWidth = camera.width / camera.zoom
        const visibleHeight = camera.height / camera.zoom
        camera.scrollX = clamp(camera.scrollX, 0, Math.max(0, WORLD.width - visibleWidth))
        camera.scrollY = clamp(camera.scrollY, 0, Math.max(0, WORLD.height - visibleHeight))
      }

      update(_time, delta) {
        const camera = this.cameras.main
        const smoothing = 1 - Math.exp(-delta * 0.018)
        const nextZoom = Phaser.Math.Linear(camera.zoom, this.targetZoom, smoothing)

        if (Math.abs(nextZoom - camera.zoom) < 0.00005) {
          camera.setZoom(this.targetZoom)
          return
        }

        camera.setZoom(nextZoom)

        if (this.zoomAnchor) {
          camera.scrollX = this.zoomAnchor.worldX - this.zoomAnchor.screenX / nextZoom
          camera.scrollY = this.zoomAnchor.worldY - this.zoomAnchor.screenY / nextZoom
        }

        this.clampCamera()
      }
    }

    game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      backgroundColor: 'rgba(0,0,0,0)',
      transparent: true,
      width: Math.max(1, parent.clientWidth),
      height: Math.max(1, parent.clientHeight),
      scene: SurfaceWorldScene,
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.NO_CENTER,
        width: '100%',
        height: '100%',
      },
      render: {
        antialias: true,
        pixelArt: false,
        roundPixels: false,
      },
      input: {
        mouse: {
          preventDefaultWheel: true,
        },
      },
    })

    return () => {
      game?.destroy(true)
    }
  }, [nodes])

  return (
    <div
      ref={hostRef}
      className="surface-world-phaser"
      aria-label="表世界固定坐标地图"
      style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
    />
  )
}

export default SurfaceWorldPhaser
