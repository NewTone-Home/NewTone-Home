/**
 * Phase 0.5 视觉原型的入口门控。
 *
 * 这里只决定「Landing 背景要不要换成某个场景」，不碰阅读状态、不碰 Center、
 * 不进 progressStore。场景本身是纯代码生成的（SVG + CSS），不引入任何图片资产。
 *
 * 入口：?landing-scene=jijia_compound
 */

export const LANDING_SCENE_QUERY_KEY = 'landing-scene'

export const LANDING_SCENES = Object.freeze({
  JIJIA_COMPOUND: 'jijia_compound',
})

const KNOWN_SCENES = new Set(Object.values(LANDING_SCENES))

/** 与 isThemeLabEnabled / isPlaceStageLabEnabled 同语义：未知值一律当作未开启。 */
export function resolveLandingScene(search) {
  try {
    const value = new URLSearchParams(search).get(LANDING_SCENE_QUERY_KEY)
    if (!value || value === '0') return null
    return KNOWN_SCENES.has(value) ? value : null
  } catch {
    return null
  }
}
