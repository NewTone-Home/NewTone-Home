import { describe, expect, it } from 'vitest'
import {
  IMAGE_PROBE_LAYER,
  INNER_PLACES,
  SURFACE_PLACES,
  isPlaceStageLabEnabled,
  withImageProbe,
} from './placeStageLabModel'
import type { PlaceStageDefinition } from './placeStageTypes'

describe('isPlaceStageLabEnabled', () => {
  it('?place-stage=1 是正式入口', () => {
    expect(isPlaceStageLabEnabled('?place-stage=1')).toBe(true)
    expect(isPlaceStageLabEnabled('?place-stage=0')).toBe(false)
  })

  it('?horizon-lab=1 作为兼容别名进入同一个 Lab', () => {
    expect(isPlaceStageLabEnabled('?horizon-lab=1')).toBe(true)
    expect(isPlaceStageLabEnabled('?horizon-lab=0')).toBe(false)
  })

  it('两者都没有则不开启', () => {
    expect(isPlaceStageLabEnabled('')).toBe(false)
    expect(isPlaceStageLabEnabled('?theme-lab=1')).toBe(false)
  })
})

describe('地点定义', () => {
  const all = [...SURFACE_PLACES, ...INNER_PLACES]

  it('第一层世界的两条地点链都可连续运行（表 ≥ 2，里 ≥ 3）', () => {
    expect(SURFACE_PLACES.length).toBeGreaterThanOrEqual(2)
    expect(INNER_PLACES.length).toBeGreaterThanOrEqual(3)
  })

  it('地点 id 唯一', () => {
    const ids = all.map(place => place.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('每个地点至少有主体组，且主体地点支持任意数量的内部图层', () => {
    for (const place of all) {
      expect(place.layers.subject.length).toBeGreaterThan(0)
    }
    const manor = SURFACE_PLACES[0]
    const groups = (['rear', 'inner', 'subject', 'foreground'] as const)
      .filter(slot => manor.layers[slot]?.length)
    expect(groups).toEqual(['rear', 'inner', 'subject', 'foreground'])
  })

  it('每层自带 depth 与视差幅度，不写死在组件里', () => {
    for (const place of all) {
      for (const asset of Object.values(place.layers).flat()) {
        expect(asset.depth).toBeGreaterThanOrEqual(0)
        expect(asset.depth).toBeLessThanOrEqual(1)
        expect(Number.isFinite(asset.parallaxX)).toBe(true)
        expect(Number.isFinite(asset.parallaxY)).toBe(true)
      }
    }
  })

  it('内院层的视差方向与前景相反 —— 价值在遮挡关系变化', () => {
    const manor = SURFACE_PLACES[0]
    const inner = manor.layers.inner?.[0]
    const foreground = manor.layers.foreground?.[0]
    expect(inner).toBeDefined()
    expect(foreground).toBeDefined()
    expect(Math.sign(inner!.parallaxX)).toBe(-Math.sign(foreground!.parallaxX))
  })

  it('邻居剪影从第一天就是数组：单层升级为多层不需要改签名', () => {
    for (const place of all) {
      expect(Array.isArray(place.neighborSilhouette)).toBe(true)
    }
  })

  it('天空、天气与星体不烘焙进地点：定义里没有 backdrop 变体也能上舞台', () => {
    for (const place of all) {
      expect(place.backdrop).toBeUndefined()
    }
  })

  it('没有地点把整幅矩形地图当成图层 —— 那会重新制造卡片与贴图语义', () => {
    const legacyFullFrame = ['center-city-map-lineart', 'center-city-ambient-test']
    for (const place of all) {
      for (const asset of [...Object.values(place.layers).flat(), ...(place.neighborSilhouette ?? [])]) {
        for (const banned of legacyFullFrame) {
          expect(asset.src ?? '').not.toContain(banned)
        }
      }
    }
  })

  it('资产未到位的地点仍然只用抽象纸片，不借用别处的图像充数', () => {
    const imageBacked = [
      'jijia-compound',
      'central-institute',
      'inner-central-institute',
      'commerce-street',
      'mining-district',
    ]
    for (const place of all.filter(p => !imageBacked.includes(p.id))) {
      for (const asset of [...Object.values(place.layers).flat(), ...(place.neighborSilhouette ?? [])]) {
        expect(asset.kind).toBe('shape')
        expect(asset.src).toBeUndefined()
      }
    }
  })

  it('姬家大院走分层透明资产：四组各自独立，不是一张烘焙好的完整图', () => {
    const jijia = SURFACE_PLACES.find(place => place.id === 'jijia-compound')
    expect(jijia).toBeDefined()

    const groups = (['rear', 'inner', 'subject', 'foreground'] as const)
    for (const slot of groups) {
      const assets = jijia!.layers[slot]
      expect(assets?.length).toBeGreaterThan(0)
      for (const asset of assets!) {
        expect(asset.kind).toBe('image')
        expect(asset.src).toContain('jijia-stage-layers')
      }
    }

    // 四张导出图共用一张母画布，四组图层才能同 scale、同 origin
    expect(jijia!.canvasAspectRatio).toBeCloseTo(1536 / 1024, 6)
  })

  it('中枢院按母图顺序接入四层真实资产，20% 位保留中央入口与两翼', () => {
    const institute = SURFACE_PLACES.find(place => place.id === 'central-institute')
    expect(institute).toBeDefined()
    expect(institute).toMatchObject({
      title: '中枢院',
      subtitle: '世界级联合行政中枢',
      worldLayer: 'surface',
      stageEnabled: true,
      visualScale: 0.82,
      visualOffsetXPct: 0,
      visualOffsetYPct: 3.25,
    })
    expect(institute!.canvasAspectRatio).toBeCloseTo(1536 / 1024, 6)

    const expected = {
      rear: ['04_rear_hall.png', -2, -1],
      inner: ['03_inner_courtyard.png', -6, -3],
      subject: ['02_gate.png', 3, 2],
      foreground: ['01_foreground.png', 11, 5],
    } as const

    for (const [slot, [fileName, parallaxX, parallaxY]] of Object.entries(expected)) {
      const asset = institute!.layers[slot as keyof typeof expected]?.[0]
      expect(asset).toMatchObject({
        kind: 'image',
        parallaxX,
        parallaxY,
      })
      expect(asset!.src).toContain(`central-institute-stage-v13-object-layered/${fileName}`)
    }

    expect(institute!.neighborSilhouette).toHaveLength(1)
    expect(institute!.neighborSilhouette![0]).toMatchObject({
      kind: 'image',
      parallaxX: 2,
      parallaxY: 1,
    })
    expect(institute!.neighborSilhouette![0].src).toContain('02_gate.png')
  })

  it('里世界中枢院直接复用表世界四层资产，只切换环境所属世界层', () => {
    const surface = SURFACE_PLACES.find(place => place.id === 'central-institute')
    const inner = INNER_PLACES.find(place => place.id === 'inner-central-institute')
    expect(surface).toBeDefined()
    expect(inner).toBeDefined()
    expect(inner).toMatchObject({
      title: '中枢院',
      worldLayer: 'inner',
      stageEnabled: true,
      canvasAspectRatio: 1536 / 1024,
      visualScale: surface!.visualScale,
      visualOffsetXPct: surface!.visualOffsetXPct,
      visualOffsetYPct: surface!.visualOffsetYPct,
    })
    expect(inner!.layers).toBe(surface!.layers)
    expect(inner!.neighborSilhouette).toBe(surface!.neighborSilhouette)
  })

  it('商业街与矿区接入各自四层 RGBA 资产，不再借用结构占位', () => {
    const expected = {
      'commerce-street': 'commercial-street-stage-layered',
      'mining-district': 'mining-area-stage-layered',
    }

    for (const [id, directory] of Object.entries(expected)) {
      const place = INNER_PLACES.find(candidate => candidate.id === id)
      expect(place).toBeDefined()
      expect(place).toMatchObject({
        title: id === 'commerce-street' ? '商业街' : '矿区',
        worldLayer: 'inner',
        stageEnabled: true,
        canvasAspectRatio: 1536 / 1024,
      })

      const files = {
        rear: '04_rear_hall.png',
        inner: '03_inner_courtyard.png',
        subject: '02_gate.png',
        foreground: '01_foreground.png',
      } as const
      for (const [slot, fileName] of Object.entries(files)) {
        const asset = place!.layers[slot as keyof typeof files]?.[0]
        expect(asset).toMatchObject({ kind: 'image' })
        expect(asset!.src).toContain(`${directory}/${fileName}`)
      }
    }
  })

  it('表世界第一层地点链：姬家大院 → 中枢院，非循环、全部启用', () => {
    expect(SURFACE_PLACES.map(place => place.id)).toEqual(['jijia-compound', 'central-institute'])
    for (const place of SURFACE_PLACES) {
      expect(place.stageEnabled).toBe(true)
    }
  })

  it('里世界第一层地点链：商业街 → 中枢院 → 矿区，非循环', () => {
    expect(INNER_PLACES.map(place => place.id)).toEqual([
      'commerce-street',
      'inner-central-institute',
      'mining-district',
    ])
  })
})

describe('image 资产接入探针', () => {
  it('探针是 image 图层，与 shape 图层共用同一套字段', () => {
    expect(IMAGE_PROBE_LAYER.kind).toBe('image')
    expect(IMAGE_PROBE_LAYER.src).toBeTruthy()
    expect(IMAGE_PROBE_LAYER.depth).toBeGreaterThan(0)
    expect(Number.isFinite(IMAGE_PROBE_LAYER.parallaxX)).toBe(true)
  })

  it('接入真实透明资产不需要结构改动：只是主体组多一层', () => {
    // 刻意用一个纯纸片定义，「原定义不被改动」才有意义
    const base: PlaceStageDefinition = {
      id: 'probe-target',
      title: '探针占位',
      worldLayer: 'surface',
      stageEnabled: false,
      layers: {
        rear: [],
        subject: [
          {
            id: 'probe-shape',
            kind: 'shape',
            shape: { form: 'block', xPct: 30, yPct: 40, widthPct: 40, heightPct: 30, tone: 0.5 },
            depth: 0.6,
            parallaxX: 3,
            parallaxY: 1,
          },
        ],
      },
    }
    const probed = withImageProbe(base)

    expect(probed.layers.subject).toHaveLength(base.layers.subject.length + 1)
    expect(probed.layers.subject.at(-1)?.kind).toBe('image')
    // 原定义不被改动
    expect(base.layers.subject.some(asset => asset.kind === 'image')).toBe(false)
    expect(probed.id).toBe(base.id)
    expect(probed.layers.rear).toBe(base.layers.rear)
  })
})
