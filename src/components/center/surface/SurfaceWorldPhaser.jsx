import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import surfaceWorldMapArt from '../../../assets/center/surface/surface-world-map-v2.png'

const WORLD = {
  width: 3072,
  height: 1728,
}

const LANDMARKS = {
  'surface-estate': {
    x: 0.134,
    y: 0.156,
    width: 0.175,
    height: 0.172,
    points: [
      { x: 0, y: 31.498 },
      { x: 55.657, y: 16.514 },
      { x: 87.87, y: 77.905 },
      { x: 27.625, y: 98.089 },
    ],
    glow: { outerWidth: 12, middleWidth: 5.5, coreWidth: 1.4, intensity: 1.35 },
  },
  'surface-council': {
    x: 0.575,
    y: 0.425,
    width: 0.16,
    height: 0.176,
    points: [
      { x: 6.63, y: 30.065 },
      { x: 53.141, y: 11.386 },
      { x: 89.776, y: 68.292 },
      { x: 38.532, y: 90.596 },
    ],
    glow: { outerWidth: 14, middleWidth: 6.5, coreWidth: 1.4, intensity: 2.2 },
  },
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

function SurfaceWorldPhaser({ nodes, onHoverStart, onHoverEnd, onOpenDetail, onBlankClick }) {
  const hostRef = useRef(null)
  const nodesRef = useRef(nodes)
  const callbacksRef = useRef({ onHoverStart, onHoverEnd, onOpenDetail, onBlankClick })

  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  useEffect(() => {
    callbacksRef.current = { onHoverStart, onHoverEnd, onOpenDetail, onBlankClick }
  }, [onHoverStart, onHoverEnd, onOpenDetail, onBlankClick])

  useEffect(() => {
    const parent = hostRef.current
    if (!parent) return undefined

    let game
    let sceneRef = null

    class SurfaceWorldScene extends Phaser.Scene {
      constructor() {
        super('surface-world')
        this.minZoom = 1
        this.maxZoom = 2
        this.targetZoom = 1
        this.targetCenterX = WORLD.width / 2
        this.targetCenterY = WORLD.height / 2
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

        Object.entries(LANDMARKS).forEach(([nodeId, landmark]) => {
          const x = landmark.x * WORLD.width
          const y = landmark.y * WORLD.height
          const width = landmark.width * WORLD.width
          const height = landmark.height * WORLD.height
          const polygonPoints = landmark.points.map(point => new Phaser.Math.Vector2(
            x + width * point.x / 100,
            y + height * point.y / 100,
          ))
          const polygon = new Phaser.Geom.Polygon(polygonPoints)
          const centroid = polygonPoints.reduce(
            (total, point) => ({ x: total.x + point.x, y: total.y + point.y }),
            { x: 0, y: 0 },
          )
          centroid.x /= polygonPoints.length
          centroid.y /= polygonPoints.length

          const outline = this.add.graphics().setAlpha(0).setDepth(10)
          const glowColor = 0xffbf47
          const coreColor = 0xfffced
          const { outerWidth, middleWidth, coreWidth, intensity } = landmark.glow

          outline.lineStyle(outerWidth, glowColor, Math.min(0.55, 0.18 * intensity))
          outline.strokePoints(polygonPoints, true, true)
          outline.lineStyle(middleWidth, glowColor, Math.min(0.95, 0.48 * intensity))
          outline.strokePoints(polygonPoints, true, true)
          outline.lineStyle(coreWidth, coreColor, 0.98)
          outline.strokePoints(polygonPoints, true, true)

          this.landmarkViews.set(nodeId, { polygon, centroid, outline })
        })

        this.handleResize(parent.clientWidth, parent.clientHeight, true)
      }

      getLocalPointer(event) {
        const rect = game?.canvas?.getBoundingClientRect()
        if (!rect || rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 }

        return {
          x: (event.clientX - rect.left) * this.cameras.main.width / rect.width,
          y: (event.clientY - rect.top) * this.cameras.main.height / rect.height,
        }
      }

      worldPointForTarget(screenX, screenY) {
        const camera = this.cameras.main
        return {
          x: this.targetCenterX + (screenX - camera.width / 2) / this.targetZoom,
          y: this.targetCenterY + (screenY - camera.height / 2) / this.targetZoom,
        }
      }

      renderedWorldPoint(screenX, screenY) {
        return this.cameras.main.getWorldPoint(screenX, screenY)
      }

      clampTargetCenter() {
        const camera = this.cameras.main
        const halfWidth = camera.width / (2 * this.targetZoom)
        const halfHeight = camera.height / (2 * this.targetZoom)
        this.targetCenterX = clamp(this.targetCenterX, halfWidth, WORLD.width - halfWidth)
        this.targetCenterY = clamp(this.targetCenterY, halfHeight, WORLD.height - halfHeight)
      }

      findLandmarkAt(worldX, worldY) {
        for (const [nodeId, view] of this.landmarkViews.entries()) {
          if (Phaser.Geom.Polygon.Contains(view.polygon, worldX, worldY)) return nodeId
        }
        return null
      }

      getLandmarkClientAnchor(nodeId) {
        const view = this.landmarkViews.get(nodeId)
        const camera = this.cameras.main
        const rect = game?.canvas?.getBoundingClientRect()
        if (!view || !rect || camera.width <= 0 || camera.height <= 0) return null

        const screenX = (view.centroid.x - camera.midPoint.x) * camera.zoom + camera.width / 2
        const screenY = (view.centroid.y - camera.midPoint.y) * camera.zoom + camera.height / 2

        return {
          clientX: rect.left + screenX * rect.width / camera.width,
          clientY: rect.top + screenY * rect.height / camera.height,
        }
      }

      setOutlineVisible(nodeId, visible) {
        const outline = this.landmarkViews.get(nodeId)?.outline
        if (!outline) return
        this.tweens.killTweensOf(outline)
        this.tweens.add({
          targets: outline,
          alpha: visible ? 1 : 0,
          duration: visible ? 160 : 520,
          ease: 'Sine.easeOut',
        })
      }

      setHoveredNode(nodeId, event) {
        if (nodeId === this.hoveredNodeId) return

        if (this.hoveredNodeId) {
          this.setOutlineVisible(this.hoveredNodeId, false)
          callbacksRef.current.onHoverEnd?.(this.hoveredNodeId)
        }

        this.hoveredNodeId = nodeId

        if (nodeId) {
          this.setOutlineVisible(nodeId, true)
          const anchor = this.getLandmarkClientAnchor(nodeId)
          callbacksRef.current.onHoverStart?.(nodeId, {
            clientX: anchor?.clientX ?? event.clientX,
            clientY: anchor?.clientY ?? event.clientY,
            pointerType: event.pointerType || 'mouse',
          })
        }
      }

      handleResize(width, height, resetCamera = false) {
        if (width <= 0 || height <= 0) return

        const camera = this.cameras.main
        camera.setSize(width, height)

        const coverZoom = Math.max(width / WORLD.width, height / WORLD.height)
        this.minZoom = coverZoom * 1.04
        this.maxZoom = this.minZoom * 2.15
        this.targetZoom = resetCamera
          ? this.minZoom
          : clamp(this.targetZoom, this.minZoom, this.maxZoom)

        if (resetCamera) {
          this.targetCenterX = WORLD.width / 2
          this.targetCenterY = WORLD.height / 2
        }

        this.clampTargetCenter()
        camera.setZoom(this.targetZoom)
        camera.centerOn(this.targetCenterX, this.targetCenterY)
      }

      handleWheel(event) {
        event.preventDefault()
        const pointer = this.getLocalPointer(event)
        const anchor = this.worldPointForTarget(pointer.x, pointer.y)
        const zoomFactor = Math.exp(-event.deltaY * 0.0012)
        const nextZoom = clamp(this.targetZoom * zoomFactor, this.minZoom, this.maxZoom)
        const camera = this.cameras.main

        this.targetZoom = nextZoom
        this.targetCenterX = anchor.x - (pointer.x - camera.width / 2) / nextZoom
        this.targetCenterY = anchor.y - (pointer.y - camera.height / 2) / nextZoom
        this.clampTargetCenter()
      }

      handlePointerMove(event) {
        const pointer = this.getLocalPointer(event)

        if (this.drag && (event.buttons & 2) !== 0) {
          this.targetCenterX = this.drag.centerX - (pointer.x - this.drag.pointerX) / this.targetZoom
          this.targetCenterY = this.drag.centerY - (pointer.y - this.drag.pointerY) / this.targetZoom
          this.clampTargetCenter()
          this.cameras.main.centerOn(this.targetCenterX, this.targetCenterY)
          this.setHoveredNode(null, event)
          return
        }

        const worldPoint = this.renderedWorldPoint(pointer.x, pointer.y)
        this.setHoveredNode(this.findLandmarkAt(worldPoint.x, worldPoint.y), event)
      }

      handlePointerDown(event) {
        if (event.button !== 2) return
        event.preventDefault()
        const pointer = this.getLocalPointer(event)
        this.drag = {
          pointerX: pointer.x,
          pointerY: pointer.y,
          centerX: this.targetCenterX,
          centerY: this.targetCenterY,
        }
      }

      handlePointerUp(event) {
        const wasDragging = this.drag
        this.drag = null

        if (event.button !== 0 || wasDragging) return
        const pointer = this.getLocalPointer(event)
        const worldPoint = this.renderedWorldPoint(pointer.x, pointer.y)
        const nodeId = this.findLandmarkAt(worldPoint.x, worldPoint.y)

        if (nodeId) callbacksRef.current.onOpenDetail?.(nodeId)
        else callbacksRef.current.onBlankClick?.()
      }

      handlePointerLeave(event) {
        this.drag = null
        this.setHoveredNode(null, event)
      }

      update(_time, delta) {
        const camera = this.cameras.main
        const smoothing = 1 - Math.exp(-delta * 0.024)
        const renderedCenter = camera.midPoint
        const nextZoom = Phaser.Math.Linear(camera.zoom, this.targetZoom, smoothing)
        const nextCenterX = Phaser.Math.Linear(renderedCenter.x, this.targetCenterX, smoothing)
        const nextCenterY = Phaser.Math.Linear(renderedCenter.y, this.targetCenterY, smoothing)

        camera.setZoom(Math.abs(nextZoom - this.targetZoom) < 0.00002 ? this.targetZoom : nextZoom)
        camera.centerOn(
          Math.abs(nextCenterX - this.targetCenterX) < 0.02 ? this.targetCenterX : nextCenterX,
          Math.abs(nextCenterY - this.targetCenterY) < 0.02 ? this.targetCenterY : nextCenterY,
        )
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
        mode: Phaser.Scale.NONE,
        autoCenter: Phaser.Scale.NO_CENTER,
      },
      render: {
        antialias: true,
        pixelArt: false,
        roundPixels: false,
      },
    })

    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0]
      if (!entry || !game) return
      const width = Math.max(1, Math.round(entry.contentRect.width))
      const height = Math.max(1, Math.round(entry.contentRect.height))
      game.scale.resize(width, height)
      sceneRef?.handleResize(width, height, false)
    })
    resizeObserver.observe(parent)

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
      resizeObserver.disconnect()
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
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 2,
        overflow: 'hidden',
        pointerEvents: 'auto',
        touchAction: 'none',
      }}
    />
  )
}

export default SurfaceWorldPhaser
