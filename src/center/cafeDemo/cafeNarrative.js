// Story source: NewTone-Staging `reader_publications.main-reader`, version 3,
// chapter_02 / chapter_02_scene_01, read-only retrieved on 2026-08-26.
// Dialogue below is kept as the published Chinese wording; scene reactions are
// only the code representation of actions already present in that scene.

export const CAFE_STORY_STATES = Object.freeze({
  OUTSIDE: 'outside',
  ENTERED: 'entered',
  COFFEE_ORDERED: 'coffee-ordered',
  OPENING_CONVERSATION: 'opening-conversation',
  COFFEE_DELIVERED: 'coffee-delivered',
  COFFEE_CONVERSATION: 'coffee-conversation',
  INTEL_CONVERSATION: 'intel-conversation',
  RESOLUTION_CONVERSATION: 'resolution-conversation',
  READY_TO_LEAVE: 'ready-to-leave',
  COMPLETE: 'complete',
})

export const CAFE_DIALOGUE = Object.freeze({
  opening: Object.freeze({
    speakerObjectId: 'lao-zhou',
    lines: Object.freeze([
      Object.freeze({ speaker: '修杰', text: '老周，陈副部长还是没有消息吗？' }),
      Object.freeze({ speaker: '老周', text: '完全没有。' }),
    ]),
    afterEvent: 'deliver-coffee',
  }),
  coffee: Object.freeze({
    speakerObjectId: 'lao-zhou',
    lines: Object.freeze([
      Object.freeze({ speaker: '修杰', text: '你还是不爱喝咖啡。' }),
      Object.freeze({ speaker: '老周', text: '是啊，我真喝不惯那玩意儿，而且上次喝完失眠了，我这把年纪了还是不要折腾比较好。' }),
    ]),
    afterEvent: 'start-intel',
  }),
  intel: Object.freeze({
    speakerObjectId: 'lao-zhou',
    lines: Object.freeze([
      Object.freeze({ speaker: '老周', text: '我昨天无意间看到了一份文档，不过我的权限不足，无法完整地看到内容。' }),
      Object.freeze({ speaker: '老周', text: '不过我能看到一些大概，因为这个档案并不是结论，而是调查报告，说是在矿区外围的摄像头疑似拍到过几次陈副部长的身影。不过我没法看到照片，我也不能确定是不是真的。' }),
      Object.freeze({ speaker: '修杰', text: '矿区外围？' }),
      Object.freeze({ speaker: '老周', text: '对，矿区外围，依照陈副部长的职责和日常活动范围，陈副部长不太可能出现在那边。' }),
      Object.freeze({ speaker: '修杰', text: '整个矿区很大，能知道目的地吗？' }),
      Object.freeze({ speaker: '老周', text: '不能。不过我在那边有个线人，得到的情报是一家叫永和小馆的苍蝇馆子，有人在那边好像见过陈副部长几次。' }),
      Object.freeze({ speaker: '修杰', text: '永和小馆？' }),
      Object.freeze({ speaker: '老周', text: '对，永和小馆，我也查过，这是一家小饭馆，平常都是服务于矿区里面的工友，开了也有些年头了。这种小地方信息量太少了，我也只是打听才知道的。' }),
    ]),
    afterEvent: 'start-resolution',
  }),
  resolution: Object.freeze({
    speakerObjectId: 'lao-zhou',
    lines: Object.freeze([
      Object.freeze({ speaker: '修杰', text: '行，我知道了，有什么新信息再跟我说，继续帮我跟踪一下这件事儿。' }),
      Object.freeze({ speaker: '老周', text: '好。' }),
    ]),
    afterEvent: 'ready-to-leave',
  }),
})

export function createInitialCafeNarrative() {
  return {
    stage: CAFE_STORY_STATES.OUTSIDE,
    doorOpen: false,
    coffeeOrdered: false,
    laoZhouReacted: false,
    coffeeDelivered: false,
    coffeeTouched: false,
    cupEmpty: false,
    banknotePlaced: false,
    laoZhouLooksOutside: false,
    dialogue: null,
    feedback: '咖啡馆外。点击“大门”进入。',
    feedbackVersion: 0,
  }
}

function withFeedback(state, feedback) {
  return { ...state, feedback, feedbackVersion: state.feedbackVersion + 1 }
}

export function applyCafeEvent(state, event) {
  switch (event) {
    case 'enter-cafe':
      return withFeedback({ ...state, stage: CAFE_STORY_STATES.ENTERED, doorOpen: true }, '大门向两侧打开，入口显出来了。')
    case 'order-coffee':
      return withFeedback({ ...state, stage: CAFE_STORY_STATES.COFFEE_ORDERED, coffeeOrdered: true }, '柜台记下了一杯咖啡。')
    case 'meet-lao-zhou':
      return withFeedback({ ...state, stage: CAFE_STORY_STATES.OPENING_CONVERSATION, laoZhouReacted: true, dialogue: { id: 'opening', index: 0 } }, '老周转过头来。')
    case 'deliver-coffee':
      return withFeedback({ ...state, stage: CAFE_STORY_STATES.COFFEE_DELIVERED, coffeeDelivered: true }, '店员把咖啡放到了桌子上。')
    case 'sip-coffee':
      return withFeedback({ ...state, stage: CAFE_STORY_STATES.COFFEE_CONVERSATION, coffeeTouched: true, dialogue: { id: 'coffee', index: 0 } }, '修杰拿起咖啡，抿了一口。')
    case 'start-intel':
      return withFeedback({ ...state, stage: CAFE_STORY_STATES.INTEL_CONVERSATION, dialogue: { id: 'intel', index: 0 } }, '老周整理了一下思绪。')
    case 'start-resolution':
      return withFeedback({ ...state, stage: CAFE_STORY_STATES.RESOLUTION_CONVERSATION, dialogue: { id: 'resolution', index: 0 } }, '修杰收起手机。')
    case 'ready-to-leave':
      return withFeedback({ ...state, stage: CAFE_STORY_STATES.READY_TO_LEAVE, cupEmpty: true, banknotePlaced: true, dialogue: null }, '咖啡杯空了，钞票压在杯子底下。')
    case 'leave-cafe':
      return withFeedback({ ...state, stage: CAFE_STORY_STATES.COMPLETE, laoZhouLooksOutside: true }, '修杰离开，老周看向窗外。')
    default:
      return state
  }
}

export function getCurrentCafeDialogue(state) {
  if (!state.dialogue) return null
  const sequence = CAFE_DIALOGUE[state.dialogue.id]
  return sequence?.lines[state.dialogue.index] ?? null
}

export function advanceCafeDialogue(state) {
  if (!state.dialogue) return state
  const sequence = CAFE_DIALOGUE[state.dialogue.id]
  if (!sequence) return { ...state, dialogue: null }

  const nextIndex = state.dialogue.index + 1
  if (nextIndex < sequence.lines.length) {
    return { ...state, dialogue: { ...state.dialogue, index: nextIndex } }
  }
  return applyCafeEvent({ ...state, dialogue: null }, sequence.afterEvent)
}

export function getCafeStageLabel(stage) {
  const labels = {
    [CAFE_STORY_STATES.OUTSIDE]: '入口外',
    [CAFE_STORY_STATES.ENTERED]: '已进入',
    [CAFE_STORY_STATES.COFFEE_ORDERED]: '已点咖啡',
    [CAFE_STORY_STATES.OPENING_CONVERSATION]: '第一次交谈',
    [CAFE_STORY_STATES.COFFEE_DELIVERED]: '咖啡已送达',
    [CAFE_STORY_STATES.COFFEE_CONVERSATION]: '咖啡对白',
    [CAFE_STORY_STATES.INTEL_CONVERSATION]: '矿区线索',
    [CAFE_STORY_STATES.RESOLUTION_CONVERSATION]: '交代后续',
    [CAFE_STORY_STATES.READY_TO_LEAVE]: '准备离开',
    [CAFE_STORY_STATES.COMPLETE]: '片段完成',
  }
  return labels[stage] ?? stage
}
