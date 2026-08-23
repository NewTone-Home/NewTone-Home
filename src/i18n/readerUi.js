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

export function getReaderUi(language) {
  return copy[language] ?? copy.zh
}

export function getReaderSceneLabel(language, locationId, fallbackLabel) {
  if (language !== 'en') return fallbackLabel
  return ENGLISH_SCENES[locationId] ?? fallbackLabel
}

export const READER_SCENE_LABELS_EN = ENGLISH_SCENES
