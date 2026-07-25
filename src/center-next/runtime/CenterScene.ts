import Phaser from 'phaser'
import type {
  CenterCameraSnapshot,
  CenterDefinition,
  CenterViewSnapshot,
  CenterWorldSnapshot,
} from '../domain/contracts'
import {
  clampCenterExpansion,
  clampCenterZoom,
  normalizeCenterViewSnapshot,
} from '../domain/invariants'
import {
  clampCameraScroll,
  fitCameraSnapshot,
  projectWorldPoint,
  shouldAdoptCamera,
  shouldCommitCamera,
} from './cameraMath'
import { LandmarkRenderer } from './LandmarkRenderer'
import { LayerRenderer } from './LayerRenderer'
import type {
  CenterRuntimeEvent,
  CenterSceneHandle,
  CenterSceneOwner,
  CenterSceneStatus,
} from './types'

export const CENTER_SCENE_KEY = 'newtone-center-world'

export interface CenterSceneData {
  owner: CenterSceneOwner
  generation: number
  definition: CenterDefinition
  assetUrls: Record<string, string>
}

/**
 * Scene 是被动的：它不订阅 Bridge，也不持有 React 的任何东西。
 * 快照只能由 CenterRuntimeSession 通过 applyWorld / applyView 交付，
 * 出站事件全部经过 owner 并带上 generation。
 */
export class CenterScene extends Phaser.Scene implements CenterSceneHandle {
  private owner!: CenterSceneOwner
  private generation = -1
  private lifecycle: CenterSceneStatus = 'booting'
  private definition!: CenterDefinition
  private world!: CenterWorldSnapshot
  private view!: CenterViewSnapshot
  private assetUrls: Record<string, string> = {}
  private layers!: LayerRenderer
  private landmarks!: LandmarkRenderer
  private pointerDown: { x: number; y: number; scrollX: number; scrollY: number } | null = null
  private dragging = false
  private hoveredLandmarkId: string | null = null
  private cameraCommitTimer: number | null = null
  private requestedCamera: CenterCameraSnapshot | null = null
  private committedCamera: CenterCameraSnapshot | null = null

  constructor() {
    super(CENTER_SCENE_KEY)
  }

  get status(): CenterSceneStatus {
    return this.lifecycle
  }

  init(data: CenterSceneData): void {
    this.owner = data.owner
    this.generation = data.generation
    this.definition = data.definition
    this.assetUrls = data.assetUrls
  }

  preload(): void {
    for (const [assetId, url] of Object.entries(this.assetUrls)) {
      this.load.image(`center-asset:${assetId}`, url)
    }
  }

  create(): void {
    try {
      // 资源加载是异步的，快照要在这里向 Session 现取，不能用挂载时捕获的旧值。
      this.world = this.owner.currentWorld()
      this.view = normalizeCenterViewSnapshot(this.owner.currentView())

      const { width, height } = this.definition.worldSize
      const camera = this.cameras.main
      camera.setBounds(0, 0, width, height)
      camera.setBackgroundColor('#151b19')

      this.layers = new LayerRenderer(this, this.definition)
      this.landmarks = new LandmarkRenderer(this, this.definition, {
        surface: this.layers.surfaceContainer,
        inner: this.layers.innerContainer,
      })

      this.restoreCamera()
      this.bindInput()
      this.scale.on('resize', this.handleResize, this)

      // game.destroy() 只 emit DESTROY，scene.remove() 只 emit SHUTDOWN：两条路都要接。
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleTeardown, this)
      this.events.once(Phaser.Scenes.Events.DESTROY, this.handleTeardown, this)

      this.lifecycle = 'live'
      this.owner.attachScene(this.generation, this)
      this.renderSnapshots()
      this.publish({ type: 'runtime/ready' })
    } catch (error) {
      this.lifecycle = 'dead'
      this.owner.reportSceneFailure(this.generation, error)
    }
  }

  applyWorld(snapshot: CenterWorldSnapshot): void {
    this.world = snapshot
    this.renderSnapshots()
  }

  applyView(snapshot: CenterViewSnapshot): void {
    this.view = normalizeCenterViewSnapshot(snapshot)
    if (this.view.camera) this.adoptCamera(this.view.camera)
    this.renderSnapshots()
  }

  private renderSnapshots(): void {
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

  private adoptCamera(incoming: CenterCameraSnapshot): void {
    const adopt = shouldAdoptCamera(incoming, {
      current: this.currentCameraSnapshot(),
      requested: this.requestedCamera,
      committed: this.committedCamera,
    })
    if (!adopt) return
    this.applyCameraSnapshot(incoming)
  }

  private applyCameraSnapshot(snapshot: CenterCameraSnapshot): void {
    // 记录 clamp 之前的原始请求：store 里存的就是这一份，下一次推回来时要能识别出是同一份。
    this.requestedCamera = snapshot
    const camera = this.cameras.main
    camera.setZoom(clampCenterZoom(snapshot.zoom))
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
      if (landmark) this.publish({ type: 'landmark/open', landmarkId: landmark.id })
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
      camera.setZoom(clampCenterZoom(camera.zoom * Math.exp(-deltaY * 0.0014)))
      const after = camera.getWorldPoint(pointer.x, pointer.y)
      this.setCameraScroll(
        camera.scrollX + before.x - after.x,
        camera.scrollY + before.y - after.y,
      )
      this.scheduleCameraCommit()
    })
  }

  private scheduleCameraCommit(): void {
    if (this.cameraCommitTimer !== null) window.clearTimeout(this.cameraCommitTimer)
    this.cameraCommitTimer = window.setTimeout(() => {
      this.cameraCommitTimer = null
      this.commitCamera()
    }, 180)
  }

  private setHovered(landmarkId: string | null): void {
    if (landmarkId === this.hoveredLandmarkId) return
    this.hoveredLandmarkId = landmarkId
    this.landmarks.setHovered(landmarkId)
    this.landmarks.apply(this.world, this.view)
    this.publish({ type: 'landmark/hover', landmarkId })
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
    const snapshot = this.currentCameraSnapshot()
    if (!shouldCommitCamera(snapshot, this.committedCamera)) return
    this.committedCamera = snapshot
    this.requestedCamera = snapshot
    this.publish({ type: 'camera/commit', camera: snapshot })
  }

  private emitProjection(): void {
    const camera = this.currentCameraSnapshot()
    const anchors = Object.fromEntries(this.definition.landmarks.map(landmark => [
      landmark.id,
      projectWorldPoint(
        this.landmarks.transformedAnchor(landmark, clampCenterExpansion(this.view.expansion)),
        camera,
      ),
    ]))
    this.publish({ type: 'projection/update', anchors })
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    if (this.lifecycle !== 'live') return
    // 销毁那一帧画布已经脱离 DOM，会收到一次 0×0，不能让它写坏相机。
    if (gameSize.width <= 0 || gameSize.height <= 0) return
    this.cameras.main.setSize(gameSize.width, gameSize.height)
    this.applyCameraSnapshot(this.requestedCamera ?? this.view.camera ?? fitCameraSnapshot(
      { width: gameSize.width, height: gameSize.height },
      this.definition.worldSize,
    ))
    this.emitProjection()
  }

  private publish(event: CenterRuntimeEvent): void {
    if (this.lifecycle === 'dead') return
    this.owner.emitFromScene(this.generation, event)
  }

  /**
   * SHUTDOWN 与 DESTROY 都会走到这里，重复调用无副作用。
   * 注意：CameraManager 的 DESTROY 处理器注册得更早，此刻 cameras.main 可能已经消失，
   * 所以这里绝对不能触碰相机。
   */
  private handleTeardown(): void {
    if (this.lifecycle === 'dead') return
    this.lifecycle = 'dead'
    if (this.cameraCommitTimer !== null) {
      window.clearTimeout(this.cameraCommitTimer)
      this.cameraCommitTimer = null
    }
    this.scale.off('resize', this.handleResize, this)
    this.owner.releaseScene(this)
  }
}
