import Phaser from 'phaser'
import type {
  CenterCameraSnapshot,
  CenterDefinition,
  CenterViewSnapshot,
  CenterWorldSnapshot,
} from '../domain/contracts'
import { clampCenterExpansion, normalizeCenterViewSnapshot } from '../domain/invariants'
import type { CenterBridge } from './CenterBridge'
import { clampCameraScroll, fitCameraSnapshot, projectWorldPoint } from './cameraMath'
import { LandmarkRenderer } from './LandmarkRenderer'
import { LayerRenderer } from './LayerRenderer'

interface SceneData {
  bridge: CenterBridge
  definition: CenterDefinition
  initialWorld: CenterWorldSnapshot
  initialView: CenterViewSnapshot
  assetUrls: Record<string, string>
}

export class CenterScene extends Phaser.Scene {
  private bridge!: CenterBridge
  private definition!: CenterDefinition
  private world!: CenterWorldSnapshot
  private view!: CenterViewSnapshot
  private assetUrls: Record<string, string> = {}
  private layers!: LayerRenderer
  private landmarks!: LandmarkRenderer
  private cleanup: Array<() => void> = []
  private pointerDown: { x: number; y: number; scrollX: number; scrollY: number } | null = null
  private dragging = false
  private hoveredLandmarkId: string | null = null
  private cameraCommitTimer: number | null = null

  constructor() {
    super('newtone-center-world')
  }

  init(data: SceneData): void {
    this.bridge = data.bridge
    this.definition = data.definition
    this.world = data.initialWorld
    this.view = normalizeCenterViewSnapshot(data.initialView)
    this.assetUrls = data.assetUrls
  }

  preload(): void {
    for (const [assetId, url] of Object.entries(this.assetUrls)) {
      this.load.image(`center-asset:${assetId}`, url)
    }
  }

  create(): void {
    try {
      const { width, height } = this.definition.worldSize
      this.cameras.main.setBounds(0, 0, width, height)
      this.cameras.main.setBackgroundColor('#151b19')
      this.layers = new LayerRenderer(this, this.definition)
      this.landmarks = new LandmarkRenderer(this, this.definition, {
        surface: this.layers.surfaceContainer,
        inner: this.layers.innerContainer,
      })
      this.restoreCamera()
      this.applySnapshots()
      this.bindInput()
      this.cleanup.push(this.bridge.subscribeWorld(snapshot => {
        this.world = snapshot
        this.applySnapshots()
      }))
      this.cleanup.push(this.bridge.subscribeView(snapshot => {
        const previousCamera = this.view.camera
        this.view = normalizeCenterViewSnapshot(snapshot)
        if (this.view.camera && this.view.camera !== previousCamera) this.applyCameraSnapshot(this.view.camera)
        this.applySnapshots()
      }))
      this.scale.on('resize', this.handleResize, this)
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.dispose, this)
      this.bridge.emit({ type: 'runtime/ready' })
      this.emitProjection()
    } catch (error) {
      this.bridge.emit({
        type: 'runtime/error',
        message: error instanceof Error ? error.message : 'Center runtime failed to start',
      })
    }
  }

  private applySnapshots(): void {
    this.layers.apply(this.world, this.view.expansion, this.view.activeLayer)
    this.landmarks.setHovered(this.hoveredLandmarkId)
    this.landmarks.apply(this.world, this.view)
    this.emitProjection()
  }

  private restoreCamera(): void {
    if (this.view.camera) {
      this.applyCameraSnapshot(this.view.camera)
      return
    }
    const camera = this.cameras.main
    this.applyCameraSnapshot(fitCameraSnapshot(
      { width: camera.width, height: camera.height },
      this.definition.worldSize,
    ))
  }

  private applyCameraSnapshot(snapshot: CenterCameraSnapshot): void {
    const camera = this.cameras.main
    camera.setZoom(snapshot.zoom)
    const clamped = clampCameraScroll(snapshot.scrollX, snapshot.scrollY, {
      scrollX: camera.scrollX,
      scrollY: camera.scrollY,
      zoom: camera.zoom,
      width: camera.width,
      height: camera.height,
    }, this.definition.worldSize)
    camera.setScroll(clamped.scrollX, clamped.scrollY)
  }

  private currentCameraSnapshot(): CenterCameraSnapshot {
    const camera = this.cameras.main
    return { scrollX: camera.scrollX, scrollY: camera.scrollY, zoom: camera.zoom }
  }

  private bindInput(): void {
    this.input.mouse?.disableContextMenu()

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown()) return
      const camera = this.cameras.main
      this.pointerDown = {
        x: pointer.x,
        y: pointer.y,
        scrollX: camera.scrollX,
        scrollY: camera.scrollY,
      }
      this.dragging = false
    })

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.pointerDown && pointer.isDown) {
        const dx = pointer.x - this.pointerDown.x
        const dy = pointer.y - this.pointerDown.y
        if (Math.hypot(dx, dy) > 5) this.dragging = true
        if (this.dragging) {
          const camera = this.cameras.main
          this.setCameraScroll(
            this.pointerDown.scrollX - dx / camera.zoom,
            this.pointerDown.scrollY - dy / camera.zoom,
          )
          this.setHovered(null)
          return
        }
      }

      const landmark = this.landmarks.findAt(
        this.cameras.main.getWorldPoint(pointer.x, pointer.y),
        this.world,
        this.view,
      )
      this.setHovered(landmark?.id ?? null)
    })

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.pointerDown) return
      const wasDragging = this.dragging
      this.pointerDown = null
      this.dragging = false
      if (wasDragging) {
        this.commitCamera()
        return
      }
      const landmark = this.landmarks.findAt(
        this.cameras.main.getWorldPoint(pointer.x, pointer.y),
        this.world,
        this.view,
      )
      if (landmark) this.bridge.emit({ type: 'landmark/open', landmarkId: landmark.id })
    })

    this.input.on('pointerout', () => this.setHovered(null))

    this.input.on('wheel', (
      pointer: Phaser.Input.Pointer,
      _objects: Phaser.GameObjects.GameObject[],
      _deltaX: number,
      deltaY: number,
    ) => {
      const camera = this.cameras.main
      const before = camera.getWorldPoint(pointer.x, pointer.y)
      camera.setZoom(Phaser.Math.Clamp(camera.zoom * Math.exp(-deltaY * 0.0014), 0.35, 3.5))
      const after = camera.getWorldPoint(pointer.x, pointer.y)
      this.setCameraScroll(
        camera.scrollX + before.x - after.x,
        camera.scrollY + before.y - after.y,
      )
      if (this.cameraCommitTimer) window.clearTimeout(this.cameraCommitTimer)
      this.cameraCommitTimer = window.setTimeout(() => this.commitCamera(), 180)
    })
  }

  private setHovered(landmarkId: string | null): void {
    if (landmarkId === this.hoveredLandmarkId) return
    this.hoveredLandmarkId = landmarkId
    this.landmarks.setHovered(landmarkId)
    this.landmarks.apply(this.world, this.view)
    this.bridge.emit({ type: 'landmark/hover', landmarkId })
  }

  private setCameraScroll(scrollX: number, scrollY: number): void {
    const camera = this.cameras.main
    const clamped = clampCameraScroll(scrollX, scrollY, {
      scrollX: camera.scrollX,
      scrollY: camera.scrollY,
      zoom: camera.zoom,
      width: camera.width,
      height: camera.height,
    }, this.definition.worldSize)
    camera.setScroll(clamped.scrollX, clamped.scrollY)
    this.emitProjection()
  }

  private commitCamera(): void {
    this.bridge.emit({ type: 'camera/commit', camera: this.currentCameraSnapshot() })
  }

  private emitProjection(): void {
    if (!this.landmarks || !this.cameras?.main) return
    const camera = this.currentCameraSnapshot()
    const anchors = Object.fromEntries(this.definition.landmarks.map(landmark => [
      landmark.id,
      projectWorldPoint(
        this.landmarks.transformedAnchor(landmark, clampCenterExpansion(this.view.expansion)),
        camera,
      ),
    ]))
    this.bridge.emit({ type: 'projection/update', anchors })
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.cameras.main.setSize(gameSize.width, gameSize.height)
    const snapshot = this.view.camera ?? fitCameraSnapshot(
      { width: gameSize.width, height: gameSize.height },
      this.definition.worldSize,
    )
    this.applyCameraSnapshot(snapshot)
    this.emitProjection()
  }

  private dispose(): void {
    if (this.cameraCommitTimer) window.clearTimeout(this.cameraCommitTimer)
    this.scale.off('resize', this.handleResize, this)
    this.cleanup.forEach(cleanup => cleanup())
    this.cleanup = []
  }
}
