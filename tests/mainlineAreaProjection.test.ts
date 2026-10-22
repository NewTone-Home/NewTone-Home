import { describe, expect, it } from 'vitest'
import { mainlineDeviceProjectionScale, resolveMainlineViewportProjection, type MainlineViewportSample } from '../src/center/runtime/mainlineViewportProjection'
import { mainlineVisibleWorldSpan, mainlineWorldPointFromClient, mainlineWorldScale, mainlineCameraOffset, mainlineViewportPointFromWorld } from '../src/center/runtime/mainlineViewport'
import { commercialStreetCameraPages } from '../src/center/runtime/commercialStreetCamera'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { mainlineGeometryCellWithinViewport } from '../src/center/runtime/mainlineSceneVisibility'

const sample = (width: number, height: number, more: Partial<MainlineViewportSample> = {}): MainlineViewportSample => ({
  width, height, stableHeight: height, devicePixelRatio: 1, visualViewportScale: 1, ...more,
})
const sizes = [[390,844,.65],[412,915,.65],[844,390,.65],[768,1024,.7257142857142858],[1280,800,1],[1920,1080,1],[3440,1440,1]] as const

describe('shared device viewport projection and actual visible span', () => {
  it.each(sizes)('%sx%s applies %s once to all world units and inverse', (width,height,expected) => {
    const viewport = resolveMainlineViewportProjection(undefined, sample(width,height))
    expect(mainlineWorldScale(viewport)).toBeCloseTo(expected, 8)
    expect(16*expected).toBeCloseTo(mainlineWorldScale(viewport) * 16, 8)
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
  it('uses width as the scale basis and height only as an upper viewport constraint',()=>{
    expect(mainlineDeviceProjectionScale({width:1600,height:1000})).toBe(1)
    expect(mainlineDeviceProjectionScale({width:1000,height:1600})).toBeCloseTo(.85,8)
  })
  it('caps wide desktop viewports at 1.0 while retaining the phone floor',()=>{
    expect(mainlineDeviceProjectionScale({width:1920,height:1080})).toBe(1)
    expect(mainlineDeviceProjectionScale({width:3440,height:1440})).toBe(1)
    expect(mainlineDeviceProjectionScale({width:1600,height:500})).toBeCloseTo(.6944444444,8)
  })
  it('browser-chrome expansion changes visible height but not stable scale',()=>{
    const small=resolveMainlineViewportProjection(undefined,sample(1200,1000,{stableHeight:900}))
    const expanded=resolveMainlineViewportProjection(small,sample(1200,1100,{stableHeight:900}))
    expect(expanded.projectionScale).toBe(small.projectionScale)
    expect(mainlineVisibleWorldSpan(expanded).y).toBeGreaterThan(mainlineVisibleWorldSpan(small).y)
  })
  it('does not multiply absolute DPR into a fresh device basis',()=>{
    expect(resolveMainlineViewportProjection(undefined,sample(1280,800,{devicePixelRatio:3})).projectionScale).toBe(1)
  })
  it('protects ambiguous page zoom but recovers after a distinct resize and baseline DPR reset',()=>{
    const before=resolveMainlineViewportProjection(undefined,sample(1920,1080))
    const zoom=resolveMainlineViewportProjection(before,sample(960,540,{devicePixelRatio:2}))
    expect(zoom.projectionScale).toBe(1)
    expect(zoom.projectionPolicy).toBe('preserved')
    const remount=resolveMainlineViewportProjection(zoom,sample(960,540,{devicePixelRatio:2}))
    const resize=resolveMainlineViewportProjection(remount,sample(800,600,{devicePixelRatio:2}))
    expect(resize.projectionScale).toBeCloseTo(.7428571428571429,8)
    expect(resize.projectionPolicy).toBe('device')
    const reset=resolveMainlineViewportProjection(zoom,sample(3440,1440))
    expect(reset.projectionScale).toBe(1)
    expect(reset.projectionDpiGuard).toBeUndefined()
  })
  it('protects active pinch across resize, then resumes normal adaptation when it returns to one',()=>{
    const before=resolveMainlineViewportProjection(undefined,sample(1600,1000))
    const zoom=resolveMainlineViewportProjection(before,sample(1600,1000,{visualViewportScale:2}))
    const rotated=resolveMainlineViewportProjection(zoom,sample(390,844,{visualViewportScale:2}))
    expect(rotated.projectionScale).toBe(before.projectionScale)
    const restored=resolveMainlineViewportProjection(rotated,sample(390,844))
    expect(zoom.projectionScale).toBe(before.projectionScale)
    expect(restored.projectionPolicy).toBe('device')
    expect(restored.projectionScale).toBe(.65)
    expect(resolveMainlineViewportProjection(restored,sample(3440,1440)).projectionScale).toBe(1)
  })
  it('does not mistake delayed reciprocal CSS resizing for a real resize during active page zoom',()=>{
    const before=resolveMainlineViewportProjection(undefined,sample(1920,1080,{outerWidth:1920,outerHeight:1160}))
    const dpiFirst=resolveMainlineViewportProjection(before,sample(1920,1080,{devicePixelRatio:1.25,outerWidth:1920,outerHeight:1160}))
    const layoutLater=resolveMainlineViewportProjection(dpiFirst,sample(1536,864,{devicePixelRatio:1.25,outerWidth:1920,outerHeight:1160}))
    expect(layoutLater.projectionScale).toBe(1)
    expect(layoutLater.projectionPolicy).toBe('preserved')
    const sameAspectWindow=resolveMainlineViewportProjection(layoutLater,sample(1280,720,{devicePixelRatio:1.25,outerWidth:1600,outerHeight:980}))
    expect(sameAspectWindow.projectionScale).toBe(1)
    expect(sameAspectWindow.projectionPolicy).toBe('device')
  })
  it('releases the guard after cumulative one-pixel window drags',()=>{
    let next=resolveMainlineViewportProjection(undefined,sample(1920,1080,{outerWidth:1920,outerHeight:1160}))
    next=resolveMainlineViewportProjection(next,sample(1536,864,{devicePixelRatio:1.25,outerWidth:1920,outerHeight:1160}))
    for(let i=1;i<=12;i++) next=resolveMainlineViewportProjection(next,sample(1536-i,864,{devicePixelRatio:1.25,outerWidth:1920-i,outerHeight:1160}))
    expect(next.projectionPolicy).toBe('device')
    expect(next.projectionScale).toBe(mainlineDeviceProjectionScale(next))
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
