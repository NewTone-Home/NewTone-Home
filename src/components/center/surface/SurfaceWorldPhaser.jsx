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
  const nodesRef = useRef(nodes)
  const callbacksRef = useRef({ onHoverStart, onHoverEnd, onOpenDetail })

  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  useEffect(() => {
    callbacksRef.current = { onHoverStart, onHoverEnd, onOpenDetail }
  }, [onHoverStart, onHoverEnd, onOpenDetail])

  useEffect(() => {
    const parent = hostRef.current
    if (!parent) return undefined

    let game
    let sceneRef = null

    class SurfaceWorldScene extends Phaser.Scene {
      constructor() {
        super('surface-world')
        this.targetZoom = 1
        this.minZoom = 1
        this.maxZoom = 2
        this.zoomAnchor = null
        this.drag = null
        this.hoveredNodeId = null
        this.landmarkViews = new Map()
      }

      preload() {
        this.load.image('surface-world-map', surfaceWorldMapArt)
      }

      create() {
        sceneRef = this

        this.add
          .image(0, 0, 'surface-world-map')
          .setOrigin(0)
          .setDisplaySize(WORLD.width, WORLD.height)

        const camera = this.cameras.main
        camera.setBounds(0, 0, WORLD.width, WORLD.height)
        this.resetZoomRange(true)

        Object.entries(LANDMARKS).forEach(([nodeId, landmark]) => {
          const x = landmark.x * WORLD.width
          const y = landmark.y * WORLD.height
          const width = landmark.width * WORLD.width
          const height = landmark.height * WORLD.height

          const outline = this.add.graphics()
          outline.lineStyle(5, 0xd9a441, 0.88)
          outline.strokeRoundedRect(x, y, width, height, 22)
          outline.setAlpha(0)
          outline.setDepth(10)

          this.landmarkViews.set(nodeId, { x, y, width, height, outline })
        })
      }

      getLocalPointer(event) {
        const rect = parent.getBoundingClientRect()
        return {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        }
      }

      findLandmarkAt(worldX, worldY) {
        for (const [nodeId, view] of this.landmarkViews.entries()) {
          if (
            worldX >= view.x
            && worldX <= view.x + view.width
            && worldY >= view.y
            && worldY <= view.y + view.height
          ) {
            return nodeId
          }
        }
        return null
      }

      setHoveredNode(nodeId, event) {
        if (nodeId === this.hoveredNodeId) return

        if (this.hoveredNodeId) {
          this.landmarkViews.get(this.hoveredNodeId)?.outline.setAlpha(0)
          callbacksRef.current.onHoverEnd?.(this.hoveredNodeId)
        }

        this.hoveredNodeId = nodeId

        if (nodeId) {
          this.landmarkViews.get(nodeId)?.outline.setAlpha(1)
          callbacksRef.current.onHoverStart?.(nodeId, {
            clientX: event.clientX,
            clientY: event.clientY,
            pointerType: event.pointerType || 'mouse',
          })
        }
      }

      handleWheel(event) {
        event.preventDefault()
        const pointer = this.getLocalPointer(event)
        const camera = this.cameras.main
        const worldPoint = camera.getWorldPoint(pointer.x, pointer.y)
        const zoomFactor = Math.exp(-event.deltaY * 0.0015)

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
      }

      handlePointerMove(event) {
        const pointer = this.getLocalPointer(event)
        const camera = this.cameras.main

        if (this.drag && (event.buttons & 2) !== 0) {
          camera.scrollX = this.drag.scrollX - (pointer.x - this.drag.pointerX) / camera.zoom
          camera.scrollY = this.drag.scrollY - (pointer.y - this.drag.pointerY) / camera.zoom
          this.clampCamera()
          this.zoomAnchor = null
          this.setHoveredNode(null, event)
          return
        }

        const worldPoint = camera.getWorldPoint(pointer.x, pointer.y)
        this.setHoveredNode(this.findLandmarkAt(worldPoint.x, worldPoint.y), event)
      }

      handlePointerDown(event) {
        if (event.button !== 2) return
        event.preventDefault()
        const pointer = this.getLocalPointer(event)
        const camera = this.cameras.main
        this.drag = {
          pointerX: pointer.x,
          pointerY: pointer.y,
          scrollX: camera.scrollX,
          scrollY: camera.scrollY,
        }
      }

      handlePointerUp(event) {
        const wasDragging = this.drag
        this.drag = null

        if (event.button !== 0 || wasDragging) return
        const pointer = this.getLocalPointer(event)
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y)
        const nodeId = this.findLandmarkAt(worldPoint.x, worldPoint.y)
        if (nodeId) callbacksRef.current.onOpenDetail?.(nodeId)
      }

      handlePointerLeave(event) {
        this.drag = null
        this.setHoveredNode(null, event)
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
    })

    const forward = method => event => sceneRef?.[method]?.(event)
    const handleWheel = forward('handleWheel')
    const handlePointerMove = forward('handlePointerMove')
    const handlePointerDown = forward('handlePointerDown')
    const handlePointerUp = forward('handlePointerUp')
    const handlePointerLeave = forward('handlePointerLeave')
    const handleContextMenu = event => event.preventDefault()

    parent.addEventListener('wheel', handleWheel, { passive: false })
    parent.addEventListener('pointermove', handlePointerMove)
    parent.addEventListener('pointerdown', handlePointerDown)
    parent.addEventListener('pointerup', handlePointerUp)
    parent.addEventListener('pointerleave', handlePointerLeave)
    parent.addEventListener('contextmenu', handleContextMenu)

    return () => {
      parent.removeEventListener('wheel', handleWheel)
      parent.removeEventListener('pointermove', handlePointerMove)
      parent.removeEventListener('pointerdown', handlePointerDown)
      parent.removeEventListener('pointerup', handlePointerUp)
      parent.removeEventListener('pointerleave', handlePointerLeave)
      parent.removeEventListener('contextmenu', handleContextMenu)
      sceneRef = null
      game?.destroy(true)
    }
  }, [])

  return (
    <div
      ref={hostRef}
      className="surface-world-phaser"
      aria-label="表世界固定坐标地图"
      onClick={event => event.stopPropagation()}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 4,
        overflow: 'hidden',
        pointerEvents: 'auto',
        touchAction: 'none',
      }}
    />
  )
}

export default SurfaceWorldPhaser
