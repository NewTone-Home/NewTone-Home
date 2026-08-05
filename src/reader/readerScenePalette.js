const COOL_SCENES = ['inner-street', 'commercial-street']
const INK_FLIP_LEVEL = 118

const clamp01 = value => Math.min(1, Math.max(0, value))
const clampByte = value => Math.round(Math.min(255, Math.max(0, value)))

export function getScenePalette(sceneState = {}, sceneId = '') {
  const coolScene = COOL_SCENES.includes(sceneId)
  const light = clamp01(sceneState.light ?? (coolScene ? .86 : .78))
  const warm = clamp01(sceneState.warm ?? (sceneId === 'ancestral-home' ? .3 : 0))
  const cool = clamp01(sceneState.cool ?? (coolScene ? .78 : .2))

  const level = Math.round(255 * Math.pow(light, 2.2))
  const tint = level / 255
  // Only the inner-world street family receives the neutral cool-white lift.
  // Other scenes retain their existing warm/cool curve unchanged.
  const r = clampByte(level + (coolScene ? cool * 4 : warm * 16 - cool * 11) * tint)
  const g = clampByte(level + (coolScene ? cool * 8 : warm * 9 - cool * 4) * tint)
  const b = clampByte(level + (coolScene ? cool * 12 : cool * 6 - warm * 18) * tint)

  const darkScene = level < INK_FLIP_LEVEL
  const ink = darkScene ? 'rgb(234 229 219)' : 'rgb(47 42 36)'
  const muted = darkScene ? 'rgb(164 158 148)' : 'rgb(117 109 98)'

  return {
    paper: `rgb(${r} ${g} ${b})`,
    paperChannels: [r, g, b],
    paperLevel: level,
    ink,
    muted,
    darkScene,
    light,
    warm,
    cool,
  }
}
