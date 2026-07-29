/**
 * 策略注册的唯一入口。
 *
 * import 这个文件即完成注册；控制器只通过 id 取策略，不 import 具体实现，
 * 因此新增策略不需要改控制器。
 */
import './placeShift'
import './reserved'

export { placeShiftStrategy } from './placeShift'
export {
  layerUnfoldStrategy,
  silhouetteDissolveStrategy,
  silhouetteRevealStrategy,
} from './reserved'
export {
  getTransitionStrategy,
  listTransitionStrategies,
  registerTransitionStrategy,
} from './types'
export type {
  PlaceTransitionContext,
  PlaceTransitionStrategy,
  PlaceTransitionStrategyId,
} from './types'
