import { describe,it,expect,vi } from 'vitest'
import Boundary from './RuntimeRecoveryBoundary.jsx'
import Panel from './RuntimeRecoveryPanel.jsx'
import { entryPresentation } from '../services/entryPresentation.mjs'
describe('stable runtime boundary contract',()=>{
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
