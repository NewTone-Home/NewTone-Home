import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { mainlineEntityFontSizePx } from '../src/center/runtime/sceneLayout'
import { boundaryGridStepsFromReferenceSpacing, sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'
import { mainlineCameraVisualOutset } from '../src/center/runtime/mainlineViewport'
import { sceneVisualRectInLocalSpace, sceneFrameBoundsInLocalSpace } from '../src/center/runtime/sceneVisualBounds'
import { sceneFocusFrameGeometry } from '../src/center/runtime/SceneFocusFrames'

describe('fixed world typography and focus units',()=>{
  it.each([{width:1920,height:1080},{width:1280,height:800},{width:390,height:844},{width:844,height:390}])('keeps ordinary type and authoring pitches independent of viewport %o',metrics=>{
    expect(mainlineEntityFontSizePx(null,metrics)).toBe(16)
    const wall=boundaryGridStepsFromReferenceSpacing(),furniture=boundaryGridStepsFromReferenceSpacing(16)
    expect(wall.horizontal*sceneDesignReferenceMetrics.width/100).toBeCloseTo(28,2)
    expect(wall.vertical*sceneDesignReferenceMetrics.height/100).toBeCloseTo(28,2)
    expect(furniture.horizontal*sceneDesignReferenceMetrics.width/100).toBeCloseTo(16,2)
    expect(mainlineCameraVisualOutset(metrics)).toEqual(mainlineCameraVisualOutset(sceneDesignReferenceMetrics))
  })
  it.each([2/3,1,1.5])('scales the entire closed frame, gap and stroke together at %s',scale=>{
    const rect=sceneVisualRectInLocalSpace({left:100+10*scale,top:200+20*scale,right:100+24*scale,bottom:200+34*scale},{left:100,top:200},{x:scale,y:scale})
    const bounds=sceneFrameBoundsInLocalSpace(rect,{left:0,top:0},{left:3,top:3,right:3,bottom:3},{x:1,y:1})
    expect(Number(bounds.left)).toBeCloseTo(7)
    expect(Number(bounds.top)).toBeCloseTo(17)
    expect(Number(bounds.width)).toBeCloseTo(20)
    expect(Number(bounds.height)).toBeCloseTo(20)
    const geometry=sceneFocusFrameGeometry(Number(bounds.width),Number(bounds.height))
    expect(geometry.viewBox).toBe('0 0 20 20')
    expect(geometry.paths['top-left']).toBe('M1 1 H19 V19 H1 V1 Z')
  })
  it('keeps world rules fixed while retaining the special question marker',()=>{
    const css=readFileSync('src/center/runtime/scene.css','utf8')
    expect(css).not.toMatch(/--scene-mainline-object-font-size,\s*clamp/)
    expect(css).not.toMatch(/font-size:\s*min\(1em, calc\(\(100cq/)
    expect(css).toMatch(/\.scene-commercial-question-mark\s*\{[^}]*font-size: 38px/s)
    expect(css).not.toContain('vector-effect: non-scaling-stroke')
    expect(css).toMatch(/\.scene-mainline-world \.scene-mainline-object--seat \.scene-mainline-object__label\s*\{\s*letter-spacing: 0;/)
  })
})
