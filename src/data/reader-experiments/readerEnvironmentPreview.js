export const READER_ENVIRONMENT_OPTIONS = {
  worldLayers: [
    { value: 'surface', label: '表世界' },
    { value: 'inner', label: '里世界' },
  ],
  times: [
    { value: 'unknown', label: '未指定' },
    { value: 'morning', label: '上午' },
    { value: 'noon', label: '中午' },
    { value: 'afternoon', label: '下午' },
    { value: 'dusk', label: '傍晚' },
    { value: 'night', label: '夜晚' },
  ],
  weather: [
    { value: 'unknown', label: '未指定' },
    { value: 'clear', label: '晴天' },
    { value: 'overcast', label: '阴天' },
    { value: 'rain', label: '雨天' },
    { value: 'snow', label: '雪天' },
  ],
}

const TIME_EXPOSURE = {
  unknown: 1,
  morning: 0.98,
  noon: 1.05,
  afternoon: 1,
  dusk: 0.96,
  night: 0.9,
}

const WEATHER_EXPOSURE = {
  unknown: 1,
  clear: 1,
  overcast: 0.98,
  rain: 0.76,
  snow: 1.05,
}

const WEATHER_LIGHT = {
  unknown: 0.2,
  clear: 0.58,
  overcast: 0.13,
  rain: 0,
  snow: 0.22,
}

function channels(value) {
  return value.split(' ').map(Number)
}

function clampChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function mix(source, target, amount) {
  return source.map((channel, index) => channel + (target[index] - channel) * amount)
}

function toRgb(value) {
  return `rgb(${value.map(clampChannel).join(' ')})`
}

export function resolveReaderEnvironmentPreview(state) {
  const visualWorldLayer = state.worldLayer === 'unknown' ? 'surface' : state.worldLayer
  const visualWeather = state.weather === 'unknown' ? 'clear' : state.weather
  const resolved = {
    palette: visualWorldLayer === 'inner'
      ? { ground: '207 215 210', light: '238 246 244' }
      : { ground: '239 231 211', light: '255 236 188' },
    grade: { brightness: 1 },
  }

  const worldExposure = visualWorldLayer === 'inner' ? 0.96 : 1
  const exposure = resolved.grade.brightness
    * (TIME_EXPOSURE[state.time] ?? TIME_EXPOSURE.noon)
    * WEATHER_EXPOSURE[visualWeather]
    * worldExposure
  let paper = channels(resolved.palette.ground).map(channel => channel * exposure)

  if (visualWorldLayer === 'inner') paper = mix(paper, [184, 202, 204], 0.13)

  if (visualWeather === 'clear' && (state.time === 'noon' || state.time === 'afternoon')) {
    paper = mix(paper, visualWorldLayer === 'surface' ? [255, 239, 184] : [228, 236, 229], 0.3)
  }
  if (visualWeather === 'clear' && state.time === 'dusk') {
    paper = mix(paper, visualWorldLayer === 'surface' ? [239, 145, 108] : [205, 157, 145], 0.42)
  }
  if (state.time === 'night') {
    paper = visualWorldLayer === 'surface' ? [30, 32, 38] : [19, 25, 34]
  }

  if (visualWeather === 'overcast') {
    paper = state.time === 'dusk' || state.time === 'night'
      ? mix(paper, [72, 78, 84], state.time === 'dusk' ? 0.9 : 0.55)
      : mix(paper, [184, 188, 188], 0.08)
  }
  if (visualWeather === 'rain') paper = mix(paper, [78, 91, 101], 0.32)
  if (visualWeather === 'snow') paper = mix(paper, [236, 242, 245], 0.38)

  let light = channels(resolved.palette.light)
  if (state.time === 'morning') light = visualWorldLayer === 'surface' ? [255, 244, 210] : [242, 250, 249]
  if (state.time === 'noon' || state.time === 'afternoon') light = visualWorldLayer === 'surface' ? [255, 228, 151] : [245, 250, 247]
  if (state.time === 'dusk') light = visualWorldLayer === 'surface' ? [255, 134, 86] : [235, 164, 140]
  if (state.time === 'night') light = visualWorldLayer === 'surface' ? [181, 198, 220] : [164, 190, 218]

  let lightStrength = WEATHER_LIGHT[visualWeather]
  if (visualWeather === 'clear' && visualWorldLayer === 'inner') lightStrength *= 1.26
  if (state.time === 'night') lightStrength *= 0.3

  const darkPaper = paper.reduce((sum, channel) => sum + channel, 0) / paper.length < 105
  const darkEnvironment = darkPaper || state.time === 'night'

  const lightOverrides = {
    'interior-dim': { rgb: '210 193 160', strength: .12 },
    'passage-dark': { rgb: '142 165 180', strength: .04 },
    'threshold-white': { rgb: '255 255 255', strength: .76 },
    'interior-warm': { rgb: '244 211 158', strength: .2 },
    'fluorescent-warm-dim': { rgb: '224 202 142', strength: .16 },
    'alley-dim': { rgb: '166 177 178', strength: .08 },
    'interior-daylight': { rgb: '235 226 203', strength: .22 },
    'subway-white': { rgb: '236 243 247', strength: .42 },
  }
  const lightOverride = lightOverrides[state.light]

  return {
    state,
    resolved,
    style: {
      '--reader-paper': toRgb(paper),
      '--reader-ink': darkPaper ? '#ece9e2' : '#30312d',
      '--reader-muted': darkPaper ? '#aaaeb2' : '#716f68',
      '--reader-environment-light-rgb': lightOverride?.rgb ?? light.join(' '),
      '--reader-environment-light-strength': lightOverride?.strength ?? Math.min(0.78, lightStrength),
      '--reader-rain-rgb': darkEnvironment ? '174 195 210' : '38 63 82',
      '--reader-rain-contrast': darkEnvironment ? 0.82 : 1.55,
      '--reader-snow-rgb': darkEnvironment ? '242 247 249' : '133 153 164',
      '--reader-snow-contrast': darkEnvironment ? 0.9 : 0.82,
    },
  }
}
