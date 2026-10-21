import { describe, expect, it } from 'vitest'
import { mainlineAreaProjectionScale, resolveMainlineViewportProjection, type MainlineViewportSample } from '../src/center/runtime/mainlineViewportProjection'
import { mainlineVisibleWorldSpan, mainlineWorldPointFromClient, mainlineWorldScale, mainlineCameraOffset, mainlineViewportPointFromWorld } from '../src/center/runtime/mainlineViewport'
import { commercialStreetCameraPages } from '../src/center/runtime/commercialStreetCamera'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { mainlineGeometryCellWithinViewport } from '../src/center/runtime/mainlineSceneVisibility'

const sample = (width: number, height: number, more: Partial<MainlineViewportSample> = {}): MainlineViewportSample => ({
  width, height, stableHeight: height, devicePixelRatio: 1, visualViewportScale: 1, ...more,
})
const sizes = [[390,844,.75],[412,915,.75],[844,390,.75],[768,1024,.75],[1280,800,.75],[1920,1080,1],[3440,1440,1.125]] as const

describe('shared area projection and actual visible span', () => {
  it.each(sizes)('%sx%s applies %s once to all world units and inverse', (width,height,expected) => {
    const viewport = resolveMainlineViewportProjection(undefined, sample(width,height))
    expect(mainlineWorldScale(viewport)).toBe(expected)
    expect(16*expected).toBeGreaterThanOrEqual(12)
    expect(16*expected).toBeLessThanOrEqual(18)
    const span = mainlineVisibleWorldSpan(viewport)
    expect(span.x*19.2).toBeCloseTo(width/expected,8)
    expect(span.y*10.8).toBeCloseTo(height/expected,8)
    const world = {x:71,y:34}, camera={x:-30,y:12}, stage={left:7,top:13,width,height}
    const client={x:stage.left+width/2+(world.x+camera.x-50)*19.2*expected,y:stage.top+height/2+(world.y+camera.y-50)*10.8*expected}
    expect(mainlineWorldPointFromClient(client,stage,viewport,camera).x).toBeCloseTo(world.x,8)
    expect(mainlineWorldPointFromClient(client,stage,viewport,camera).y).toBeCloseTo(world.y,8)
    const overlay=mainlineViewportPointFromWorld(world,viewport,camera)
    expect(stage.left+overlay.x/100*width).toBeCloseTo(client.x,8)
    expect(stage.top+overlay.y/100*height).toBeCloseTo(client.y,8)
    expect(mainlineGeometryCellWithinViewport(world,camera,0,'commercial-street',undefined,viewport)).toBe(Math.abs(world.x+camera.x-50)<=span.x/2&&Math.abs(world.y+camera.y-50)<=span.y/2)
  })
  it('uses width and height symmetrically away from limits',()=>{
    expect(mainlineAreaProjectionScale({width:1600,height:1000})).toBeCloseTo(Math.sqrt(1600000/2073600),8)
    expect(mainlineAreaProjectionScale({width:1000,height:1600})).toBe(mainlineAreaProjectionScale({width:1600,height:1000}))
  })
  it('browser-chrome expansion changes visible height but not stable scale',()=>{
    const small=resolveMainlineViewportProjection(undefined,sample(1200,1000,{stableHeight:900}))
    const expanded=resolveMainlineViewportProjection(small,sample(1200,1100,{stableHeight:900}))
    expect(expanded.projectionScale).toBe(small.projectionScale)
    expect(mainlineVisibleWorldSpan(expanded).y).toBeGreaterThan(mainlineVisibleWorldSpan(small).y)
  })
  it('does not multiply absolute DPR into a fresh device basis',()=>{
    expect(resolveMainlineViewportProjection(undefined,sample(1280,800,{devicePixelRatio:3})).projectionScale).toBe(.75)
  })
  it('preserves auto scale across ambiguous DPI/page zoom, scene remount and resize',()=>{
    const before=resolveMainlineViewportProjection(undefined,sample(1920,1080))
    const zoom=resolveMainlineViewportProjection(before,sample(960,540,{devicePixelRatio:2}))
    expect(zoom.projectionScale).toBe(1)
    expect(zoom.projectionPolicy).toBe('preserved')
    const remount=resolveMainlineViewportProjection(zoom,sample(960,540,{devicePixelRatio:2}))
    const resize=resolveMainlineViewportProjection(remount,sample(800,600,{devicePixelRatio:2}))
    expect(resize.projectionScale).toBe(1)
    expect(mainlineVisibleWorldSpan(resize).x).toBeCloseTo(800/1920*100)
  })
  it('does not compensate pinch zoom, including its return to one',()=>{
    const before=resolveMainlineViewportProjection(undefined,sample(1600,1000))
    const zoom=resolveMainlineViewportProjection(before,sample(1600,1000,{visualViewportScale:2}))
    const restored=resolveMainlineViewportProjection(zoom,sample(1600,1000))
    expect(zoom.projectionScale).toBe(before.projectionScale)
    expect(restored.projectionPolicy).toBe('preserved')
  })
  it.each(sizes)('%sx%s pages and independent boundaries use this same visible span', (width,height)=>{
    const viewport=resolveMainlineViewportProjection(undefined,sample(width,height))
    const pages=commercialStreetCameraPages(mainlineScenes['commercial-street'],viewport)
    expect(pages.span).toBe(mainlineVisibleWorldSpan(viewport).x)
    for(let i=1;i<pages.centers.length;i++)expect(pages.centers[i]-pages.centers[i-1]).toBeLessThanOrEqual(pages.span*.8+.00001)
    for(const id of ['jijia-ancestral-home','zhongshuyuan-office'] as const){
      const scene=mainlineScenes[id],span=mainlineVisibleWorldSpan(viewport)
      for(const [point,side] of [[{x:-1000,y:-1000},-1],[{x:1000,y:1000},1]] as const){
        const camera=mainlineCameraOffset(scene,point,false,viewport)
        if(scene.walkBounds.width+2< span.x)expect(camera.x).toBeCloseTo(50-scene.walkBounds.x-scene.walkBounds.width/2)
        else if(side<0)expect(50-camera.x-span.x/2).toBeLessThan(scene.walkBounds.x)
        else expect(50-camera.x+span.x/2).toBeGreaterThan(scene.walkBounds.x+scene.walkBounds.width)
      }
    }
  })
})
