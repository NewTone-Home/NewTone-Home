import { describe, expect, it, vi } from 'vitest'
import { defaultCenterDefinition } from '../content/defaultCenterDefinition'
import type {
  CenterViewSnapshot,
  CenterWorldSnapshot,
  ReaderPosition,
} from '../domain/contracts'
import { createDefaultCenterViewSnapshot, normalizeCenterViewSnapshot } from '../domain/invariants'
import { resolveCenterWorld } from '../domain/worldResolver'
import { CenterBridge } from './CenterBridge'
import { CenterRuntimeSession } from './CenterRuntimeSession'
import type {
  CenterLaunchRequest,
  CenterRuntimeInstance,
  CenterRuntimeLauncher,
  CenterSceneHandle,
  CenterSceneStatus,
} from './types'

const POSITION: ReaderPosition = { phaseId: 'M1', pageId: 'ancestral-home', beatIndex: 0 }

/** 代替 CenterScene：只记录被交付了什么，不需要 Phaser。 */
class FakeScene implements CenterSceneHandle {
  status: CenterSceneStatus = 'booting'
  initialWorld: CenterWorldSnapshot | null = null
  initialView: CenterViewSnapshot | null = null
  readonly worlds: CenterWorldSnapshot[] = []
  readonly views: CenterViewSnapshot[] = []
  failOnApply = false

  applyWorld(snapshot: CenterWorldSnapshot): void {
    if (this.failOnApply) throw new Error('scene is broken')
    this.worlds.push(snapshot)
  }

  applyView(snapshot: CenterViewSnapshot): void {
    if (this.failOnApply) throw new Error('scene is broken')
    this.views.push(snapshot)
  }
}

/** 代替 Phaser：把 boot / create / shutdown 变成可以手动触发的步骤。 */
class FakeLauncher implements CenterRuntimeLauncher {
  readonly requests: CenterLaunchRequest[] = []
  readonly instances: Array<{ generation: number; destroyed: boolean }> = []

  launch(request: CenterLaunchRequest): CenterRuntimeInstance {
    this.requests.push(request)
    const instance = { generation: request.generation, destroyed: false }
    this.instances.push(instance)
    return { destroy: () => { instance.destroyed = true } }
  }

  get liveInstances(): Array<{ generation: number; destroyed: boolean }> {
    return this.instances.filter(instance => !instance.destroyed)
  }

  /** 模拟 postBoot + Scene.create()：过期的 generation 必须拿不到 Scene。 */
  bootScene(request: CenterLaunchRequest): FakeScene | null {
    if (!request.shouldStartScene(request.generation)) return null
    const scene = new FakeScene()
    scene.initialWorld = request.owner.currentWorld()
    scene.initialView = request.owner.currentView()
    scene.status = 'live'
    request.owner.attachScene(request.generation, scene)
    request.owner.emitFromScene(request.generation, { type: 'runtime/ready' })
    return scene
  }

  /** 模拟 SHUTDOWN / DESTROY。 */
  killScene(request: CenterLaunchRequest, scene: FakeScene): void {
    scene.status = 'dead'
    request.owner.releaseScene(scene)
  }
}

function createHarness() {
  const bridge = new CenterBridge()
  const launcher = new FakeLauncher()
  const parent = {} as HTMLElement
  const world = resolveCenterWorld({
    definition: defaultCenterDefinition,
    committedLocation: POSITION,
    furthestLocation: POSITION,
  })
  const view = createDefaultCenterViewSnapshot()
  const events: string[] = []
  const errors: string[] = []
  const logger = vi.fn()

  bridge.subscribe(event => {
    events.push(event.type)
    if (event.type === 'runtime/error') errors.push(event.message)
  })

  const session = new CenterRuntimeSession({
    bridge,
    definition: defaultCenterDefinition,
    assetUrls: {},
    world,
    view,
    launcher,
    logger,
  })

  return { bridge, launcher, parent, session, world, view, events, errors, logger }
}

function viewWith(base: CenterViewSnapshot, expansion: number): CenterViewSnapshot {
  return normalizeCenterViewSnapshot({ ...base, expansion })
}

describe('CenterRuntimeSession', () => {
  it('start 与 stop 都是幂等的', () => {
    const { launcher, parent, session } = createHarness()

    session.start(parent)
    session.start(parent)
    expect(launcher.instances).toHaveLength(1)
    expect(session.sessionStatus).toBe('running')

    session.stop()
    session.stop()
    expect(launcher.liveInstances).toHaveLength(0)
    expect(session.sessionStatus).toBe('stopped')
  })

  it('start → stop → start 之后只有一个存活的运行时实例', () => {
    const { launcher, parent, session } = createHarness()

    session.start(parent)
    session.stop()
    session.start(parent)

    expect(launcher.instances).toHaveLength(2)
    expect(launcher.liveInstances).toHaveLength(1)
    expect(launcher.liveInstances[0].generation).toBe(session.sceneGeneration)
  })

  it('Scene 死亡后 pushView / pushWorld 不再落地也不抛错', () => {
    const { bridge, launcher, parent, session, view, world } = createHarness()
    session.start(parent)
    const request = launcher.requests[0]
    const scene = launcher.bootScene(request)!

    const delivered = viewWith(view, 0.6)
    bridge.pushView(delivered)
    expect(scene.views).toEqual([delivered])

    launcher.killScene(request, scene)

    const dropped = viewWith(view, 0.9)
    expect(() => bridge.pushView(dropped)).not.toThrow()
    expect(() => bridge.pushWorld(world)).not.toThrow()
    expect(scene.views).toEqual([delivered])
    expect(scene.worlds).toEqual([])
  })

  it('session 停止后即使 Scene 自己还没收到销毁通知，也不会再收到快照', () => {
    // 这就是线上的黑屏场景：game.destroy() 只 emit DESTROY，
    // 旧写法里 Scene 的退订永远不会执行。现在闸门在 session 手上。
    const { bridge, launcher, parent, session, view } = createHarness()
    session.start(parent)
    const scene = launcher.bootScene(launcher.requests[0])!

    session.stop()
    expect(scene.status).toBe('live')

    const dropped = viewWith(view, 0.8)
    expect(() => bridge.pushView(dropped)).not.toThrow()
    expect(scene.views).toEqual([])
  })

  it('ready 之前的多次更新只保留最新值，不重放历史', () => {
    const { bridge, launcher, parent, session, view, world } = createHarness()
    session.start(parent)

    const staleWorld = { ...world, progressKey: 'stale' }
    const latestWorld = { ...world, progressKey: 'latest' }
    bridge.pushWorld(staleWorld)
    bridge.pushWorld(latestWorld)
    bridge.pushView(viewWith(view, 0.1))
    const latestView = viewWith(view, 0.7)
    bridge.pushView(latestView)

    const scene = launcher.bootScene(launcher.requests[0])!

    expect(scene.initialWorld).toBe(latestWorld)
    expect(scene.initialView).toBe(latestView)
    expect(scene.worlds).toEqual([])
    expect(scene.views).toEqual([])
  })

  it('ready 之后的连续更新按序交付', () => {
    const { bridge, launcher, parent, session, view } = createHarness()
    session.start(parent)
    const scene = launcher.bootScene(launcher.requests[0])!

    const first = viewWith(view, 0.2)
    const second = viewWith(view, 0.4)
    const third = viewWith(view, 0.6)
    bridge.pushView(first)
    bridge.pushView(second)
    bridge.pushView(third)

    expect(scene.views).toEqual([first, second, third])
  })

  it('过期 generation 的 postBoot 不得创建 Scene', () => {
    const { launcher, parent, session } = createHarness()
    session.start(parent)
    const staleRequest = launcher.requests[0]

    session.stop()
    expect(launcher.bootScene(staleRequest)).toBeNull()

    session.start(parent)
    expect(launcher.bootScene(staleRequest)).toBeNull()
    expect(launcher.bootScene(launcher.requests[1])).not.toBeNull()
  })

  it('过期 generation 的出站事件不会进入 Bridge', () => {
    const { events, launcher, parent, session } = createHarness()
    session.start(parent)
    const request = launcher.requests[0]
    launcher.bootScene(request)
    expect(events).toEqual(['runtime/ready'])

    session.stop()
    request.owner.emitFromScene(request.generation, { type: 'landmark/open', landmarkId: 'x' })

    expect(events).toEqual(['runtime/ready'])
  })

  it('runtime 异常被转成一次 runtime/error 并停掉 session，不向调用方冒泡', () => {
    const { bridge, errors, launcher, logger, parent, session, view } = createHarness()
    session.start(parent)
    const scene = launcher.bootScene(launcher.requests[0])!
    scene.failOnApply = true

    expect(() => bridge.pushView(viewWith(view, 0.5))).not.toThrow()

    expect(errors).toEqual(['scene is broken'])
    expect(logger).toHaveBeenCalledTimes(1)
    expect(session.sessionStatus).toBe('stopped')
    expect(launcher.liveInstances).toHaveLength(0)
  })

  it('Scene 启动失败通过 runtime/error 上报，握手不会悬空', () => {
    const { errors, launcher, parent, session } = createHarness()
    session.start(parent)
    const request = launcher.requests[0]

    request.owner.reportSceneFailure(request.generation, new Error('create failed'))

    expect(errors).toEqual(['create failed'])
    expect(session.sessionStatus).toBe('stopped')
    expect(launcher.liveInstances).toHaveLength(0)
  })

  it('晚订阅者仍能拿到 runtime/ready 重放', () => {
    const { bridge, launcher, parent, session } = createHarness()
    session.start(parent)
    launcher.bootScene(launcher.requests[0])

    const late = vi.fn()
    bridge.subscribe(late)

    expect(late).toHaveBeenCalledWith({ type: 'runtime/ready' })
  })
})
