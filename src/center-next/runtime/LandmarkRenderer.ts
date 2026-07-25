import Phaser from 'phaser'
import type {
  CenterDefinition,
  CenterViewSnapshot,
  CenterWorldSnapshot,
  LandmarkDefinition,
  WorldLayer,
  WorldPoint,
} from '../domain/contracts'
import { getLayerTransform, transformLayerPoint } from './LayerRenderer'

interface LandmarkView {
  shape: Phaser.GameObjects.Polygon
  glow: Phaser.GameObjects.Graphics
}

export class LandmarkRenderer {
  private readonly views = new Map<string, LandmarkView>()
  private hoveredLandmarkId: string | null = null

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly definition: CenterDefinition,
    containers: Record<WorldLayer, Phaser.GameObjects.Container>,
  ) {
    for (const landmark of definition.landmarks) {
      const points = landmark.polygon.map(point => new Phaser.Geom.Point(point.x, point.y))
      const glow = scene.add.graphics()
      const accent = landmark.layer === 'surface' ? 0xf1c67e : 0x8ce0d2
      glow.fillStyle(accent, 0.16)
      glow.fillPoints(points, true)
      glow.lineStyle(2, accent, 0.72)
      glow.strokePoints(points, true)
      glow.setAlpha(0.12)

      const shape = scene.add.polygon(
        0,
        0,
        landmark.polygon.flatMap(point => [point.x, point.y]),
        0xffffff,
        0.001,
      ).setOrigin(0, 0)

      containers[landmark.layer].add([glow, shape])
      this.views.set(landmark.id, { glow, shape })
    }
  }

  setHovered(landmarkId: string | null): void {
    if (landmarkId === this.hoveredLandmarkId) return
    this.hoveredLandmarkId = landmarkId
  }

  apply(world: CenterWorldSnapshot, view: CenterViewSnapshot): void {
    for (const landmark of this.definition.landmarks) {
      const landmarkView = this.views.get(landmark.id)
      if (!landmarkView) continue
      const unlocked = world.unlockedLandmarkIds.includes(landmark.id)
      landmarkView.shape.setVisible(unlocked)
      landmarkView.glow.setVisible(unlocked)
      if (!unlocked) continue

      const selected = view.selectedLandmarkId === landmark.id
      const contextual = world.contextualLandmarkIds.includes(landmark.id)
      const hovered = this.hoveredLandmarkId === landmark.id
      const targetAlpha = selected ? 1 : hovered ? 0.82 : contextual ? 0.34 : 0.12
      this.scene.tweens.killTweensOf(landmarkView.glow)
      this.scene.tweens.add({
        targets: landmarkView.glow,
        alpha: targetAlpha,
        duration: hovered || selected ? 360 : 220,
        ease: 'Sine.Out',
      })
    }
  }

  findAt(
    worldPoint: WorldPoint,
    world: CenterWorldSnapshot,
    view: CenterViewSnapshot,
  ): LandmarkDefinition | null {
    const candidates = [...this.definition.landmarks].reverse()
    for (const landmark of candidates) {
      if (!world.unlockedLandmarkIds.includes(landmark.id)) continue
      if (view.activeLayer && landmark.layer !== view.activeLayer) continue
      const transform = getLayerTransform(this.definition, view.expansion, landmark.layer)
      const localY = (worldPoint.y - transform.offsetY) / transform.scaleY
      const polygon = new Phaser.Geom.Polygon(landmark.polygon)
      if (Phaser.Geom.Polygon.Contains(polygon, worldPoint.x, localY)) return landmark
    }
    return null
  }

  transformedAnchor(landmark: LandmarkDefinition, expansion: number): WorldPoint {
    return transformLayerPoint(this.definition, expansion, landmark.layer, landmark.anchor)
  }
}
