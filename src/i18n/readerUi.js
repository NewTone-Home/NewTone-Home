import { copy } from './copy'

const ENGLISH_SCENES = Object.freeze({
  'ancestral-home-courtyard': 'Ji ancestral residence · Courtyard',
  'ancestral-home-hall': 'Ji ancestral residence · Main hall',
  'ancestral-passage': 'Hidden passage',
  'inner-street': 'Inner World · Street',
  'inner-commercial-street': 'Inner World · Shopping street',
  'inner-commercial-cafe': 'Inner World · Shopping district café',
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
