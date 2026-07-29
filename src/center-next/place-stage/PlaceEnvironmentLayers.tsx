import type { EnvironmentToggles } from '../environment/environmentTypes'

/**
 * 舞台自己的深处层。
 *
 * 天空、天体、天气、空气都已经搬去 `src/center-next/environment/` 的全局系统 ——
 * 那些东西任何地点都复用，不该住在 place-stage 里。
 *
 * 留在这里的只有一件事：**世界边界的暗示**。它属于这个舞台的空间结构
 * （最后一个地点之后还有什么），不属于环境，因此不跟着时间与天气走。
 */

interface RearSilhouetteProps {
  toggles: EnvironmentToggles
}

/**
 * 舞台更深处的未知地点暗示与世界边界。
 *
 * 不可点击，不占真实地点 index，也不伪造任何地点数据。
 */
export function RearSilhouetteLayer({ toggles }: RearSilhouetteProps) {
  if (!toggles.rearSilhouette) return null
  return (
    <div className="pstage-rear-silhouette" aria-hidden="true">
      <span className="pstage-rear-shape" data-depth="far" />
      <span className="pstage-rear-shape" data-depth="mid" />
    </div>
  )
}
