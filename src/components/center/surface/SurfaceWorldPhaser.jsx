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

function SurfaceWorldPhaser({
  nodes,
  heldNodeId,
  onHoverStart,
  onHoverEnd,
  onOpenDetail,
  onBlankClick,
  onAnchorsChange,
}) {
  const hostRef = useRef(null)
  const callbacksRef = useRef({
    heldNodeId,
    onHoverStart,
    onHoverEnd,
    onOpenDetail,
    onBlankClick,
    onAnchorsChange,
  })

  useEffect(() => {
    callbacksRef.current = {
      heldNodeId,
      onHoverStart,
      onHoverEnd,
      onOpenDetail,
      onBlankClick,
      onAnchorsChange,
    }
  }, [heldNodeId, onHoverStart, onHoverEnd, onOpenDetail, onBlankClick, onAnchorsChange])

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
        this.drag = null
        this.hoveredNodeId = null
        this.hoverExitTimer = null
        this.zoomTween = null
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

        const enabledNodeIds = new Set(nodes.map(node => node.id))

        Object.entries(LANDMARKS).forEach(([nodeId, landmark]) => {
          if (!enabledNodeIds.has(nodeId)) return

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

        this.resizeCamera(parent.clientWidth, parent.clientHeight, true)
        this.emitAnchors()
      }

      getCanvasPoint(event) {
        const rect = game?.canvas?.getBoundingClientRect()
        const camera = this.cameras.main
        if (!rect || rect.width <= 0 || rect.height <= 0) return null

        return {
          x: (event.clientX - rect.left) * camera.width / rect.width,
          y: (event.clientY - rect.top) * camera.height / rect.height,
        }
      }

      getCameraBounds(zoom = this.cameras.main.zoom) {
        const camera = this.cameras.main
        return {
          maxX: Math.max(0, WORLD.width - camera.width / zoom),
          maxY: Math.max(0, WORLD.height - camera.height / zoom),
        }
      }

      clampCamera() {
        const camera = this.cameras.main
        const bounds = this.getCameraBounds()
        camera.scrollX = clamp(camera.scrollX, 0, bounds.maxX)
        camera.scrollY = clamp(camera.scrollY, 0, bounds.maxY)
      }

      resizeCamera(width, height, reset = false) {
        if (width <= 0 || height <= 0) return

        const camera = this.cameras.main
        const center = reset
          ? { x: WORLD.width / 2, y: WORLD.height / 2 }
          : { x: camera.midPoint.x, y: camera.midPoint.y }

        camera.setSize(width, height)

        const coverZoom = Math.max(width / WORLD.width, height / WORLD.height)
        this.minZoom = coverZoom * 1.02
        this.maxZoom = this.minZoom * 2.2
        camera.setZoom(reset ? this.minZoom : clamp(camera.zoom, this.minZoom, this.maxZoom))
        camera.centerOn(center.x, center.y)
        this.clampCamera()
        this.emitAnchors()
      }

      findLandmarkAt(worldPoint) {
        for (const [nodeId, view] of this.landmarkViews.entries()) {
          if (Phaser.Geom.Polygon.Contains(view.polygon, worldPoint.x, worldPoint.y)) return nodeId
        }
        return null
      }

      setOutlineVisible(nodeId, visible) {
        const outline = this.landmarkViews.get(nodeId)?.outline
        if (!outline) return
        this.tweens.killTweensOf(outline)
        this.tweens.add({
          targets: outline,
          alpha: visible ? 1 : 0,
          duration: visible ? 160 : 420,
          ease: 'Sine.easeOut',
        })
      }

      clearHoverExitTimer() {
        if (!this.hoverExitTimer) return
        window.clearTimeout(this.hoverExitTimer)
        this.hoverExitTimer = null
      }

      commitHoveredNode(nodeId, event) {
        this.clearHoverExitTimer()
        if (nodeId === this.hoveredNodeId) return

        if (this.hoveredNodeId) {
          this.setOutlineVisible(this.hoveredNodeId, false)
          callbacksRef.current.onHoverEnd?.(this.hoveredNodeId)
        }

        this.hoveredNodeId = nodeId

        if (nodeId) {
          this.setOutlineVisible(nodeId, true)
          callbacksRef.current.onHoverStart?.(nodeId, {
            clientX: event.clientX,
            clientY: event.clientY,
            pointerType: event.pointerType || 'mouse',
          })
        }
      }

      requestHoveredNode(nodeId, event) {
        if (nodeId) {
          this.commitHoveredNode(nodeId, event)
          return
        }

        if (!this.hoveredNodeId) return
        if (callbacksRef.current.heldNodeId === this.hoveredNodeId) return

        this.clearHoverExitTimer()
        this.hoverExitTimer = window.setTimeout(() => {
          this.commitHoveredNode(null, event)
        }, 260)
      }

      emitAnchors() {
        const camera = this.cameras.main
        const rect = game?.canvas?.getBoundingClientRect()
        if (!rect || camera.width <= 0 || camera.height <= 0) return

        const scaleX = rect.width / camera.width
        const scaleY = rect.height / camera.height
        const anchors = {}

        this.landmarkViews.forEach((view, nodeId) => {
          anchors[nodeId] = {
            x: (view.centroid.x - camera.scrollX) * camera.zoom * scaleX,
            y: (view.centroid.y - camera.scrollY) * camera.zoom * scaleY,
          }
        })

        callbacksRef.current.onAnchorsChange?.(anchors)
      }

      handleWheel(event) {
        event.preventDefault()
        const point = this.getCanvasPoint(event)
        if (!point) return

        const camera = this.cameras.main
        const anchor = camera.getWorldPoint(point.x, point.y)
        const normalizedDelta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
        const nextZoom = clamp(
          camera.zoom * Math.exp(-normalizedDelta * 0.00135),
          this.minZoom,
          this.maxZoom,
        )

        if (Math.abs(nextZoom - camera.zoom) < 0.000001) return

        this.zoomTween?.stop()
        const proxy = { zoom: camera.zoom }
        const startZoom = camera.zoom

        this.zoomTween = this.tweens.add({
          targets: proxy,
          zoom: nextZoom,
          duration: 90,
          ease: 'Sine.easeOut',
          onUpdate: () => {
            const currentPoint = camera.getWorldPoint(point.x, point.y)
            camera.setZoom(proxy.zoom)
            const movedPoint = camera.getWorldPoint(point.x, point.y)
            camera.scrollX += currentPoint.x - movedPoint.x
            camera.scrollY += currentPoint.y - movedPoint.y

            if (Math.abs(proxy.zoom - startZoom) > 0.000001) {
              const correctionPoint = camera.getWorldPoint(point.x, point.y)
              camera.scrollX += anchor.x - correctionPoint.x
              camera.scrollY += anchor.y - correctionPoint.y
            }

            this.clampCamera()
            this.emitAnchors()
          },
          onComplete: () => {
            this.zoomTween = null
            this.emitAnchors()
          },
        })
      }

      handlePointerMove(event) {
        const point = this.getCanvasPoint(event)
        if (!point) return

        const camera = this.cameras.main

        if (this.drag && (event.buttons & 2) !== 0) {
          camera.scrollX = this.drag.scrollX - (point.x - this.drag.pointerX) / camera.zoom
          camera.scrollY = this.drag.scrollY - (point.y - this.drag.pointerY) / camera.zoom
          this.clampCamera()
          this.requestHoveredNode(null, event)
          this.emitAnchors()
          return
        }

        const worldPoint = camera.getWorldPoint(point.x, point.y)
        this.requestHoveredNode(this.findLandmarkAt(worldPoint), event)
      }

      handlePointerDown(event) {
        if (event.button !== 2) return
        event.preventDefault()
        const point = this.getCanvasPoint(event)
        if (!point) return

        const camera = this.cameras.main
        this.zoomTween?.stop()
        this.zoomTween = null
        this.drag = {
          pointerX: point.x,
          pointerY: point.y,
          scrollX: camera.scrollX,
          scrollY: camera.scrollY,
        }
      }

      handlePointerUp(event) {
        const wasDragging = Boolean(this.drag)
        this.drag = null

        if (event.button !== 0 || wasDragging) return
        const point = this.getCanvasPoint(event)
        if (!point) return

        const worldPoint = this.cameras.main.getWorldPoint(point.x, point.y)
        const nodeId = this.findLandmarkAt(worldPoint)

        if (nodeId) callbacksRef.current.onOpenDetail?.(nodeId)
        else callbacksRef.current.onBlankClick?.()
      }

      handlePointerLeave(event) {
        this.drag = null
        this.requestHoveredNode(null, event)
      }

      shutdown() {
        this.clearHoverExitTimer()
        this.zoomTween?.stop()
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
      sceneRef?.resizeCamera(width, height, false)
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
      sceneRef?.shutdown()
      sceneRef = null
      game?.destroy(true)
    }
  }, [nodes])

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
