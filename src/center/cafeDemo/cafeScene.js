import { INTERACTION_TYPES } from '../sceneRuntime/interactionResolver'
import { CAFE_STORY_STATES } from './cafeNarrative'

const feedback = (target, message) => ({ type: INTERACTION_TYPES.FEEDBACK, target, message })
const story = (target, event) => ({ type: INTERACTION_TYPES.STORY, target, event })

// Source scene: chapter_02_scene_01 / inner-commercial-cafe.
// Only entities present in the published scene are represented here.
export const CAFE_SCENE = Object.freeze({
  id: 'inner-commercial-cafe-demo',
  title: '第二章 · 咖啡馆',
  subtitle: '商业街拐角 / 线构成可走的关系，文字构成对象',
  movementDuration: 420,
  protagonist: Object.freeze({ id: 'xiujie', label: '修杰', start: Object.freeze({ x: 12, y: 58 }) }),
  walkways: Object.freeze([
    Object.freeze({ id: 'entrance-to-counter', from: Object.freeze({ x: 14, y: 55 }), to: Object.freeze({ x: 31, y: 29 }) }),
    Object.freeze({ id: 'counter-to-table', from: Object.freeze({ x: 34, y: 30 }), to: Object.freeze({ x: 68, y: 42 }) }),
    Object.freeze({ id: 'table-to-window', from: Object.freeze({ x: 73, y: 40 }), to: Object.freeze({ x: 86, y: 24 }) }),
  ]),
  objects: Object.freeze([
    Object.freeze({
      id: 'door',
      kind: 'object',
      label: '大门',
      position: Object.freeze({ x: 8, y: 52 }),
      walkTarget: Object.freeze({ x: 14, y: 55 }),
      interaction: ({ narrativeState }) => {
        if (narrativeState.stage === CAFE_STORY_STATES.OUTSIDE) return story({ x: 14, y: 55 }, 'enter-cafe')
        if (narrativeState.stage === CAFE_STORY_STATES.READY_TO_LEAVE) return story({ x: 14, y: 55 }, 'leave-cafe')
        return feedback({ x: 14, y: 55 }, narrativeState.stage === CAFE_STORY_STATES.COMPLETE ? '入口还开着。' : '大门已经打开。')
      },
      presentation: ({ objectState }) => ({
        label: objectState?.open ? '大        门' : '大门',
        stateText: objectState?.open ? '入口已打开' : '入口',
        emphasis: objectState?.highlighted,
      }),
    }),
    Object.freeze({
      id: 'counter',
      kind: 'object',
      label: '柜台',
      position: Object.freeze({ x: 29, y: 24 }),
      walkTarget: Object.freeze({ x: 32, y: 30 }),
      interaction: ({ narrativeState }) => {
        if (narrativeState.stage === CAFE_STORY_STATES.OUTSIDE) return feedback({ x: 16, y: 54 }, '先进入咖啡馆。')
        if (narrativeState.stage === CAFE_STORY_STATES.ENTERED) return story({ x: 32, y: 30 }, 'order-coffee')
        return feedback({ x: 32, y: 30 }, narrativeState.coffeeOrdered ? '柜台前已经点过咖啡。' : '柜台安静地留在入口一侧。')
      },
      presentation: ({ objectState }) => ({
        label: '柜台',
        stateText: objectState?.ordered ? '咖啡已点' : '点一杯咖啡',
        emphasis: objectState?.highlighted,
      }),
    }),
    Object.freeze({
      id: 'server',
      kind: 'character',
      label: '店员',
      position: Object.freeze({ x: 39, y: 31 }),
      walkTarget: Object.freeze({ x: 43, y: 36 }),
      interaction: ({ narrativeState }) => feedback({ x: 43, y: 36 }, narrativeState.coffeeDelivered ? '店员已经回到柜台一侧。' : '店员在柜台后。'),
      presentation: ({ objectState }) => ({ label: '店员', stateText: objectState?.delivered ? '已送达' : '', emphasis: objectState?.highlighted }),
    }),
    Object.freeze({
      id: 'window',
      kind: 'object',
      label: '窗',
      position: Object.freeze({ x: 86, y: 20 }),
      walkTarget: Object.freeze({ x: 83, y: 28 }),
      interaction: ({ narrativeState }) => feedback({ x: 83, y: 28 }, narrativeState.laoZhouLooksOutside ? '老周仍在看着窗外。' : '窗外的光落进最里面的位置。'),
      presentation: ({ objectState }) => ({ label: '窗', stateText: objectState?.looked ? '窗外' : '', emphasis: objectState?.highlighted }),
    }),
    Object.freeze({
      id: 'table',
      kind: 'object',
      label: '桌子',
      position: Object.freeze({ x: 66, y: 43 }),
      walkTarget: Object.freeze({ x: 63, y: 50 }),
      interaction: () => feedback({ x: 63, y: 50 }, '最里面靠窗的桌子。'),
      presentation: ({ objectState }) => ({ label: '桌子', stateText: objectState?.occupied ? '有人坐下' : '靠窗', emphasis: objectState?.highlighted }),
    }),
    Object.freeze({
      id: 'chair',
      kind: 'object',
      label: '椅子',
      position: Object.freeze({ x: 62, y: 55 }),
      walkTarget: Object.freeze({ x: 62, y: 59 }),
      interaction: () => feedback({ x: 62, y: 59 }, '椅子在桌子对面。'),
      presentation: ({ objectState }) => ({ label: '椅子', stateText: objectState?.occupied ? '已坐下' : '', emphasis: objectState?.highlighted }),
    }),
    Object.freeze({
      id: 'coffee',
      kind: 'object',
      label: '咖啡',
      position: Object.freeze({ x: 72, y: 47 }),
      walkTarget: Object.freeze({ x: 70, y: 53 }),
      interaction: ({ narrativeState }) => {
        if (!narrativeState.coffeeDelivered) return feedback({ x: 70, y: 53 }, '咖啡还没有送到桌上。')
        if (!narrativeState.coffeeTouched) return story({ x: 70, y: 53 }, 'sip-coffee')
        return feedback({ x: 70, y: 53 }, narrativeState.cupEmpty ? '杯子已经空了。' : '杯子在桌子上。')
      },
      presentation: ({ objectState }) => ({
        label: '咖啡',
        stateText: objectState?.empty ? '空杯' : '桌上',
        hidden: !objectState?.visible,
        emphasis: objectState?.highlighted,
      }),
    }),
    Object.freeze({
      id: 'lao-zhou',
      kind: 'character',
      label: '老周',
      position: Object.freeze({ x: 71, y: 34 }),
      walkTarget: Object.freeze({ x: 76, y: 42 }),
      interaction: ({ narrativeState }) => {
        if (narrativeState.stage === CAFE_STORY_STATES.OUTSIDE) return feedback({ x: 16, y: 54 }, '先进入咖啡馆。')
        if (narrativeState.stage === CAFE_STORY_STATES.ENTERED) return feedback({ x: 38, y: 34 }, '先到柜台点一杯咖啡。')
        if (narrativeState.stage === CAFE_STORY_STATES.COFFEE_ORDERED) return story({ x: 76, y: 42 }, 'meet-lao-zhou')
        return feedback({ x: 76, y: 42 }, narrativeState.laoZhouLooksOutside ? '老周看着窗外。' : '老周坐在桌子另一侧。')
      },
      presentation: ({ objectState }) => ({
        label: '老周',
        stateText: objectState?.lookingOutside ? '看着窗外' : objectState?.turned ? '转过头来' : '靠窗坐着',
        emphasis: objectState?.highlighted,
      }),
    }),
  ]),
})
