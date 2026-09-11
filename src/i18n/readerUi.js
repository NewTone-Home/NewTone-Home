import { copy } from './copy'

const ENGLISH_SCENES = Object.freeze({
  'ancestral-home-courtyard': 'Courtyard',
  'ancestral-home-hall': 'Main hall',
  'ancestral-passage': 'Dark passage',
  'inner-street': 'Street',
  'inner-central-court': 'Central Court',
  'inner-commercial-street': 'Shopping street',
  'inner-commercial-cafe': 'Café',
  'inner-lakeside': 'Inner World · Lakeside',
  'inner-transit': 'Inner World · En route',
  'mining-old-street': 'Mining district · Old street',
  'yonghe-diner': 'Yonghe Diner',
  'yonghe-back-alley': 'Alley behind Yonghe Diner',
  'ruoyu-commercial-street': 'Shopping street',
  'ruoyu-cafe': 'Café at the end of the shopping street',
  'noodle-shop': 'Noodle shop near the subway',
  'walk-to-subway': 'On the way to the subway',
  subway: 'Subway station and train',
})

const ENVIRONMENT_STATUS_LABELS = Object.freeze({
  zh: Object.freeze({
    world: Object.freeze({ surface: '表世界', inner: '里世界', transition: '世界转化', unknown: '未知' }),
    time: Object.freeze({ unknown: '未知', morning: '上午', noon: '中午', afternoon: '下午', dusk: '傍晚', night: '夜晚' }),
    weather: Object.freeze({ unknown: '未知', clear: '晴', overcast: '阴', rain: '雨', snow: '雪' }),
  }),
  en: Object.freeze({
    world: Object.freeze({ surface: 'Surface World', inner: 'Inner World', transition: 'In Transit', unknown: 'Unknown' }),
    time: Object.freeze({ unknown: 'Unknown', morning: 'Morning', noon: 'Noon', afternoon: 'Afternoon', dusk: 'Dusk', night: 'Night' }),
    weather: Object.freeze({ unknown: 'Unknown', clear: 'Clear', overcast: 'Overcast', rain: 'Rain', snow: 'Snow' }),
  }),
})

export function getReaderUi(language) {
  return copy[language] ?? copy.zh
}

export function getReaderSceneLabel(language, locationId, fallbackLabel) {
  if (language !== 'en') return fallbackLabel
  return ENGLISH_SCENES[locationId] ?? fallbackLabel
}

export function getReaderEnvironmentStatus(language, state = {}) {
  const labels = ENVIRONMENT_STATUS_LABELS[language] ?? ENVIRONMENT_STATUS_LABELS.zh
  return {
    world: labels.world[state.worldLayer] ?? labels.world.unknown,
    time: labels.time[state.time] ?? labels.time.unknown,
    weather: labels.weather[state.weather] ?? labels.weather.unknown,
  }
}

export const READER_SCENE_LABELS_EN = ENGLISH_SCENES
