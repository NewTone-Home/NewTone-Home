import {describe,it,expect,vi} from 'vitest'
import {createSceneCharacterRectBatch} from '../src/center/runtime/sceneVisualBounds'
describe('one synchronous frame measurement batch',()=>{
 it('measures a shared root once across target and neighbor groups',()=>{
  const a={} as HTMLElement,b={} as HTMLElement
  const measure=vi.fn((nodes:readonly HTMLElement[])=>nodes.map(root=>({left:root===a?1:20,top:0,right:root===a?11:30,bottom:10})))
  const batch=createSceneCharacterRectBatch(measure)
  expect(batch([a,b])).toHaveLength(2)
  expect(batch([a])).toEqual([{left:1,top:0,right:11,bottom:10}])
  batch([b,a]);expect(measure).toHaveBeenCalledTimes(2)
 })
 it('does not retain stale text/font/position/projection results into the next pass',()=>{
  const root={} as HTMLElement;let left=10
  const measure=vi.fn(()=>[{left,top:0,right:left+14,bottom:14}])
  const first=createSceneCharacterRectBatch(measure);expect(first([root])[0]!.left).toBe(10)
  left=40;const second=createSceneCharacterRectBatch(measure);expect(second([root])[0]!.left).toBe(40)
  expect(measure).toHaveBeenCalledTimes(2)
 })
 it('also caches an empty or clipped-out character only for the current pass',()=>{
  const root={} as HTMLElement,measure=vi.fn(()=>[])
  const batch=createSceneCharacterRectBatch(measure);batch([root]);batch([root]);expect(measure).toHaveBeenCalledTimes(1)
  createSceneCharacterRectBatch(measure)([root]);expect(measure).toHaveBeenCalledTimes(2)
 })
})
