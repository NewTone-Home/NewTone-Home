import { describe, it, expect } from 'vitest'
import { storyCompletionTransitions } from './storyAnalytics'
describe('existing story completion conditions only',()=>{
 it('records completion transition but never a line, hydration, migration or repeated save',()=>{
  const before={sceneState:{'commercial-street':{commercialCafeStoryStatus:'ready-to-leave',commercialCafeRuoyuMeetingStatus:'in-progress'}}}
  const after={sceneState:{'commercial-street':{commercialCafeStoryStatus:'complete',commercialCafeRuoyuMeetingStatus:'complete'}}}
  expect(storyCompletionTransitions(before,after).map(e=>e.objectId)).toEqual(['lao-zhou','ruoyu'])
  expect(storyCompletionTransitions(after,after)).toEqual([])
  expect(storyCompletionTransitions(after,{sceneState:{'commercial-cafe':after.sceneState['commercial-street']}})).toEqual([])
  expect(storyCompletionTransitions(before,before)).toEqual([])
 })
})
