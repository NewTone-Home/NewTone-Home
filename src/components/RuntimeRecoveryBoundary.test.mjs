import { describe,it,expect,vi } from 'vitest'
import Boundary, { boundaryRecoveryPresentation, runBoundaryRecoveryAction } from './RuntimeRecoveryBoundary.jsx'
import { runtimeFailureRecord } from '../services/runtimeRecovery.mjs'
import Panel from './RuntimeRecoveryPanel.jsx'
import { entryPresentation } from '../services/entryPresentation.mjs'
describe('stable runtime boundary contract',()=>{
  it.each(['zh','en'])('exposes captured first cause and usable %s controls while parent is still entering',language=>{
    const {text}=entryPresentation({language,hasInitializedLanguage:true})
    const state={phase:'entering',runtimeEvidence:null},calls=[]
    const controller={getState:()=>state,runtimeFailed:e=>{calls.push(['failed',e]);state.phase='failed'},back:()=>{calls.push(['back']);state.phase='back'}}
    const boundary=new Boundary({resetKey:{},children:'runtime',renderFallback:captured=>{
      const presentation=boundaryRecoveryPresentation(state,captured)
      return Panel({language,text,...presentation,onBack:()=>runBoundaryRecoveryAction(controller,captured,'back'),onRecheck:vi.fn()})
    }})
    boundary.state={...boundary.state,...Boundary.getDerivedStateFromError(Error('BOUNDARY_RENDER_SENTINEL'))}
    const panel=boundary.render()
    expect(panel.props['data-recovery-first-reason']).toBe('BOUNDARY_RENDER_SENTINEL')
    expect(panel.props['data-recovery-event-count']).toBe(1)
    const section=panel.props.children,nav=section.props.children.at(-1),buttons=nav.props.children
    expect(buttons[0].props.disabled).toBe(false)
    expect(buttons[1].props.disabled).toBe(false)
    buttons[0].props.onClick()
    expect(calls.map(call=>call[0])).toEqual(['failed','back'])
    expect(boundaryRecoveryPresentation(state,boundary.state.evidence)).toBeNull()
  })
  it('rechecks through the original controller and retains its first evidence and uncertainty',async()=>{
    const captured=runtimeFailureRecord(Error('render-first'))
    const state={phase:'entering'},recheck=vi.fn().mockResolvedValue(true)
    const controller={getState:()=>state,runtimeFailed:vi.fn(e=>{state.phase='failed';state.runtimeEvidence=e}),recheck}
    await runBoundaryRecoveryAction(controller,captured,'recheck')
    expect(controller.runtimeFailed).toHaveBeenCalledWith(captured)
    expect(recheck).toHaveBeenCalledOnce()
    state.phase='uncertain'
    const presentation=boundaryRecoveryPresentation(state,runtimeFailureRecord(Error('secondary')))
    expect(presentation.phase).toBe('uncertain')
    expect(presentation.evidence.first.message).toBe('render-first')
    state.phase='probing'
    expect(boundaryRecoveryPresentation(state,captured).phase).toBe('probing')
  })

  it('renders a store-independent fallback before deferred parent state updates commit',()=>{
    const error=Error('BOUNDARY_RENDER_SENTINEL'),fallback='visible-recovery'
    const boundary=new Boundary({resetKey:{},onError:vi.fn(),children:'broken-runtime',fallback})
    boundary.state={...boundary.state,...Boundary.getDerivedStateFromError(error)}
    expect(boundary.render()).toBe(fallback)
  })
  it('records a real render or cleanup error without removing the surrounding recovery controls',()=>{
    const onError=vi.fn(),handle={},boundary=new Boundary({resetKey:handle,onError,children:'runtime'})
    const error=Error('cleanup-write-after-revoke')
    boundary.state={...boundary.state,...Boundary.getDerivedStateFromError(error)}
    boundary.componentDidCatch(error,{componentStack:'CenterExperience'})
    expect(boundary.render()).toBeNull()
    expect(onError).toHaveBeenCalledWith(error,{stage:'runtime-boundary',componentStack:'CenterExperience'})
    expect(Boundary.getDerivedStateFromProps({resetKey:handle},boundary.state)).toBeNull()
    expect(Boundary.getDerivedStateFromProps({resetKey:{}},boundary.state).error).toBeNull()
  })
  it.each(['zh','en'])('renders independent %s recovery controls without reading game storage',language=>{
    const {text}=entryPresentation({language,hasInitializedLanguage:true})
    const element=Panel({language,text,phase:'failed',evidence:{first:{message:'actual-first-cause'},events:[]},onBack:vi.fn(),onRecheck:vi.fn(),style:{}})
    expect(element.type).toBe('main')
    expect(element.props['data-runtime-recovery']).toBe(true)
    expect(element.props['data-recovery-first-reason']).toBe('actual-first-cause')
  })
})
