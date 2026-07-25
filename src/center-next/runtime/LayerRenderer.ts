import Phaser from 'phaser'
import type {
  CenterDefinition,
  CenterLayerVariantDefinition,
  CenterWorldSnapshot,
  WorldLayer,
  WorldPoint,
} from '../domain/contracts'

type LayerObject = Phaser.GameObjects.Image | Phaser.GameObjects.Graphics

export function getLayerTransform(
  definition: CenterDefinition,
  expansion: number,
  layer: WorldLayer,
): { scaleY: number; offsetY: number } {
  const scaleY = 1 - expansion * 0.45
  const offsetY = layer === 'inner' ? expansion * definition.worldSize.height * 0.48 : 0
  return { scaleY, offsetY }
}

export function transformLayerPoint(
  definition: CenterDefinition,
  expansion: number,
  layer: WorldLayer,
  point: WorldPoint,
): WorldPoint {
  const transform = getLayerTransform(definition, expansion, layer)
  return { x: point.x, y: point.y * transform.scaleY + transform.offsetY }
}

export class LayerRenderer {
  readonly surfaceContainer: Phaser.GameObjects.Container
  readonly innerContainer: Phaser.GameObjects.Container

  private variants = new Map<string, LayerObject>()

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly definition: CenterDefinition,
  ) {
    this.innerContainer = scene.add.container(0, 0)
    this.surfaceContainer = scene.add.container(0, 0)
    this.createLayer('inner')
    this.createLayer('surface')
  }

  private createLayer(layer: WorldLayer): void {
    const definition = this.definition.layers[layer]
    const container = layer === 'surface' ? this.surfaceContainer : this.innerContainer
    for (const variant of definition.variants) {
      const object = this.createVariant(layer, variant)
      object.setVisible(false)
      container.add(object)
      this.variants.set(`${layer}:${variant.id}`, object)
    }
  }

  private createVariant(
    layer: WorldLayer,
    variant: CenterLayerVariantDefinition,
  ): LayerObject {
    const assetKey = variant.assetId ? `center-asset:${variant.assetId}` : null
    if (assetKey && this.scene.textures.exists(assetKey)) {
      return this.scene.add.image(0, 0, assetKey)
        .setOrigin(0, 0)
        .setDisplaySize(this.definition.worldSize.width, this.definition.worldSize.height)
    }

    const graphics = this.scene.add.graphics()
    const { width, height } = this.definition.worldSize
    const { background, line, accent } = variant.fallbackPalette
    graphics.fillStyle(background, 1)
    graphics.fillRect(0, 0, width, height)
    graphics.lineStyle(layer === 'surface' ? 2 : 1.5, line, 0.52)

    const phase = layer === 'surface' ? 0.8 : 2.15
    for (let row = 0; row < 17; row += 1) {
      const baseline = 45 + row * 42
      graphics.beginPath()
      graphics.moveTo(0, baseline)
      for (let x = 0; x <= width; x += 50) {
        const wave = Math.sin(x / 105 + row * phase) * (layer === 'surface' ? 15 : 25)
        graphics.lineTo(x, baseline + wave)
      }
      graphics.strokePath()
    }

    graphics.lineStyle(layer === 'surface' ? 8 : 5, accent, 0.44)
    graphics.beginPath()
    for (let x = -20; x <= width + 20; x += 30) {
      const ratio = x / width
      const baseline = layer === 'surface' ? height * 0.68 : height * 0.26
      const y = baseline + Math.sin(ratio * Math.PI * 2.35) * 72 + ratio * (layer === 'surface' ? -35 : 95)
      if (x === -20) graphics.moveTo(x, y)
      else graphics.lineTo(x, y)
    }
    graphics.strokePath()

    graphics.lineStyle(1, accent, 0.5)
    for (let index = 0; index < 52; index += 1) {
      const x = (index * 97 + (layer === 'surface' ? 31 : 59)) % width
      const y = (index * 67 + (layer === 'surface' ? 47 : 83)) % height
      graphics.strokeCircle(x, y, 2 + (index % 4))
    }
    return graphics
  }

  apply(world: CenterWorldSnapshot, expansion: number, activeLayer: WorldLayer | null): void {
    for (const [key, object] of this.variants) {
      const separator = key.indexOf(':')
      const layer = key.slice(0, separator) as WorldLayer
      const variantId = key.slice(separator + 1)
      const activeVariant = layer === 'surface' ? world.surfaceVariant : world.innerVariant
      object.setVisible(variantId === activeVariant)
    }

    const surface = getLayerTransform(this.definition, expansion, 'surface')
    const inner = getLayerTransform(this.definition, expansion, 'inner')
    this.surfaceContainer.setPosition(0, surface.offsetY).setScale(1, surface.scaleY)
    this.innerContainer.setPosition(0, inner.offsetY).setScale(1, inner.scaleY)

    this.surfaceContainer.setAlpha(activeLayer === 'inner' ? 0.12 : 1)
    this.innerContainer.setAlpha(activeLayer === 'surface' ? 0.1 : 0.16 + expansion * 0.84)
  }
}
