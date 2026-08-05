import { copy } from './copy'

const ENGLISH_SCENES = Object.freeze({
  'ancestral-home-courtyard': 'Ji ancestral home · courtyard',
  'ancestral-home-hall': 'Ji ancestral home · main hall',
  'ancestral-passage': 'hidden passage',
  'inner-street': 'inner-world street',
  'inner-commercial-street': 'inner-world commercial street',
  'inner-commercial-cafe': 'inner-world commercial street café',
  'inner-lakeside': 'inner world · lakeside',
  'inner-transit': 'inner world · en route',
  'mining-old-street': 'mining district · old street',
  'yonghe-diner': 'Yonghe diner',
  'yonghe-back-alley': 'alley behind Yonghe diner',
  'ruoyu-commercial-street': 'commercial street',
  'ruoyu-cafe': 'café at the end of commercial street',
  'noodle-shop': 'noodle shop near the subway',
  'walk-to-subway': 'on the way to the subway',
  subway: 'subway station and train',
})

export function getReaderUi(language) {
  return copy[language] ?? copy.zh
}

export function getReaderSceneLabel(language, locationId, fallbackLabel) {
  if (language !== 'en') return fallbackLabel
  return ENGLISH_SCENES[locationId] ?? fallbackLabel
}

export const READER_SCENE_LABELS_EN = ENGLISH_SCENES
