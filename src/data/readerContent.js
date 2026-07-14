import { PHASES } from '../constants/phases'

export const READER_PAGE_MODES = Object.freeze({
  FOCUS_SEQUENCE: 'focus-sequence',
  FLOW: 'flow',
})

function deepFreeze(value) {
  Object.values(value).forEach(child => {
    if (child && typeof child === 'object' && !Object.isFrozen(child)) {
      deepFreeze(child)
    }
  })
  return Object.freeze(value)
}

const page = ({ id, sceneId, sceneLabel, beats, backward, forward }) => ({
  id,
  mode: READER_PAGE_MODES.FOCUS_SEQUENCE,
  supportedModes: [
    READER_PAGE_MODES.FOCUS_SEQUENCE,
    READER_PAGE_MODES.FLOW,
  ],
  scene: {
    id: sceneId,
    label: sceneLabel,
  },
  beats: beats.map(([id, text]) => ({
    id,
    blocks: [{ type: 'paragraph', text }],
  })),
  exits: {
    backward,
    forward,
  },
})

const navigate = (phaseId, pageId) => ({
  action: 'navigate',
  target: { phaseId, pageId },
})

export const readerContent = deepFreeze([
  {
    id: 'M1',
    title: '第一乐章',
    pages: [
      page({
        id: 'm1-arrival',
        sceneId: 'threshold',
        sceneLabel: '入口',
        beats: [
          ['m1-arrival-01', '纸面的边缘先显出一道很浅的痕迹。'],
          ['m1-arrival-02', '远处的声音停了一拍，像在等待回应。'],
          ['m1-arrival-03', '第一条路径从空白中慢慢浮现。'],
        ],
        backward: { action: 'leave-reader', target: 'landing' },
        forward: navigate('M1', 'm1-signal'),
      }),
      page({
        id: 'm1-signal',
        sceneId: 'signal-room',
        sceneLabel: '信号室',
        beats: [
          ['m1-signal-01', '信号在墙面上留下短促的回声。'],
          ['m1-signal-02', '每一次回应都让路径更清楚一点。'],
          ['m1-signal-03', '门后的第二段旅程已经可以辨认。'],
        ],
        backward: navigate('M1', 'm1-arrival'),
        forward: navigate('M2', 'm2-platform'),
      }),
    ],
  },
  {
    id: 'M2',
    title: '第二乐章',
    pages: [
      page({
        id: 'm2-platform',
        sceneId: 'platform',
        sceneLabel: '月台',
        beats: [
          ['m2-platform-01', '月台没有时刻表，只有不断改写的方向。'],
          ['m2-platform-02', '脚步声从另一条轨道折返回来。'],
          ['m2-platform-03', '一盏灯在列车到来前先亮起。'],
        ],
        backward: navigate('M1', 'm1-signal'),
        forward: navigate('M2', 'm2-carriage'),
      }),
      page({
        id: 'm2-carriage',
        sceneId: 'carriage',
        sceneLabel: '车厢',
        beats: [
          ['m2-carriage-01', '窗外的景物只在被注视时保持形状。'],
          ['m2-carriage-02', '座位之间藏着一段没有说完的对话。'],
          ['m2-carriage-03', '列车越过边界，纸张的纹理随之改变。'],
        ],
        backward: navigate('M2', 'm2-platform'),
        forward: navigate('M3', 'm3-archive'),
      }),
    ],
  },
  {
    id: 'M3',
    title: '第三乐章',
    pages: [
      page({
        id: 'm3-archive',
        sceneId: 'archive',
        sceneLabel: '档案室',
        beats: [
          ['m3-archive-01', '档案页按照尚未发生的日期排列。'],
          ['m3-archive-02', '一行批注把两个遥远的事件连在一起。'],
          ['m3-archive-03', '最旧的记录反而保留着最新的墨迹。'],
        ],
        backward: navigate('M2', 'm2-carriage'),
        forward: navigate('M3', 'm3-corridor'),
      }),
      page({
        id: 'm3-corridor',
        sceneId: 'corridor',
        sceneLabel: '回廊',
        beats: [
          ['m3-corridor-01', '回廊把每一道门都折向同一个中心。'],
          ['m3-corridor-02', '墙上的线条在视线之外继续生长。'],
          ['m3-corridor-03', '最后一道门后传来矿石相互碰撞的声音。'],
        ],
        backward: navigate('M3', 'm3-archive'),
        forward: navigate('M4', 'm4-descent'),
      }),
    ],
  },
  {
    id: 'M4',
    title: '第四乐章',
    pages: [
      page({
        id: 'm4-descent',
        sceneId: 'mine-lift',
        sceneLabel: '下行井',
        beats: [
          ['m4-descent-01', '升降梯向下时，光线被留在了上方。'],
          ['m4-descent-02', '刻度一格格消失，却没有显示深度。'],
          ['m4-descent-03', '落地的震动让最后一页松开边缘。'],
        ],
        backward: navigate('M3', 'm3-corridor'),
        forward: navigate('M4', 'm4-core'),
      }),
      page({
        id: 'm4-core',
        sceneId: 'mine-core',
        sceneLabel: '矿区核心',
        beats: [
          ['m4-core-01', '矿脉像一条缓慢呼吸的句子。'],
          ['m4-core-02', '所有曾经分开的信号在这里重新汇合。'],
          ['m4-core-03', '出口已经出现，但完成仍需要一次明确选择。'],
        ],
        backward: navigate('M4', 'm4-descent'),
        forward: { action: 'complete-reader' },
      }),
    ],
  },
])

export function validateReaderContent(content) {
  if (!Array.isArray(content)) {
    throw new TypeError('Reader content must be an array of phases')
  }

  const phaseIds = new Set()
  const pageIds = new Set()
  const beatIds = new Set()

  for (const phase of content) {
    if (!phase || typeof phase.id !== 'string' || !PHASES.includes(phase.id)) {
      throw new Error(`Invalid phase ID: ${String(phase?.id)}`)
    }
    if (phaseIds.has(phase.id)) {
      throw new Error(`Duplicate phase ID: ${phase.id}`)
    }
    phaseIds.add(phase.id)

    if (!Array.isArray(phase.pages)) {
      throw new Error(`Phase ${phase.id} must provide a pages array`)
    }

    for (const currentPage of phase.pages) {
      if (!currentPage || typeof currentPage.id !== 'string' || currentPage.id.length === 0) {
        throw new Error(`Invalid page ID in phase ${phase.id}`)
      }
      if (pageIds.has(currentPage.id)) {
        throw new Error(`Duplicate page ID: ${currentPage.id}`)
      }
      pageIds.add(currentPage.id)

      if (!Object.values(READER_PAGE_MODES).includes(currentPage.mode)) {
        throw new Error(`Invalid page mode: ${String(currentPage.mode)}`)
      }
      if (!Array.isArray(currentPage.beats) || currentPage.beats.length === 0) {
        throw new Error(`Empty page: ${currentPage.id}`)
      }

      for (const beat of currentPage.beats) {
        if (!beat || typeof beat.id !== 'string' || beat.id.length === 0) {
          throw new Error(`Invalid beat ID in page ${currentPage.id}`)
        }
        if (beatIds.has(beat.id)) {
          throw new Error(`Duplicate beat ID: ${beat.id}`)
        }
        beatIds.add(beat.id)
      }
    }
  }

  const missingPhases = PHASES.filter(phaseId => !phaseIds.has(phaseId))
  if (missingPhases.length > 0) {
    throw new Error(`Missing phase IDs: ${missingPhases.join(', ')}`)
  }
  if (content.length !== PHASES.length) {
    throw new Error('Reader content must contain exactly M1–M4')
  }

  const actualOrder = content.map(phase => phase.id)
  if (actualOrder.some((phaseId, index) => phaseId !== PHASES[index])) {
    throw new Error('Reader phases must use the stable M1–M4 order')
  }

  return content
}

validateReaderContent(readerContent)
