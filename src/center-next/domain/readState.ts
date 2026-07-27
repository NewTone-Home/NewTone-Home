import { readerContentIndex, resolvePosition } from '../../reader/readerPosition'
import type {
  CenterDefinition,
  CenterLocalizedText,
  CenterWorldSnapshot,
  ReaderPosition,
} from './contracts'

/**
 * Center Shell 的只读阅读状态。
 *
 * 这里不持有任何地名文本：地名一律从 CenterDefinition 的 landmark title 解析，
 * 段落位置一律从 reader 的线性索引解析。Shell 只负责显示。
 */
export interface CenterReadState {
  /** committedLocation 对应的地点，取阅读位置之前最近的一个 landmark */
  place: CenterLocalizedText | null
  /** furthestLocation 对应的地点 */
  furthestPlace: CenterLocalizedText | null
  /** 当前处于第几节（reader 的页），以及总节数 */
  sectionOrdinal: number
  sectionTotal: number
  /** 当前处于本节第几段，以及本节段数 */
  beatOrdinal: number
  beatTotal: number
  /** 已解锁 / 已探访的地标数量 */
  knownCount: number
  visitedCount: number
}

const pageOrder: string[] = (() => {
  const seen: string[] = []
  for (const entry of readerContentIndex.entries) {
    const key = `${entry.phaseId}/${entry.pageId}`
    if (!seen.includes(key)) seen.push(key)
  }
  return seen
})()

function safeLinearIndex(position: ReaderPosition | null | undefined): number | null {
  if (!position) return null
  try {
    return resolvePosition(position).linearIndex
  } catch {
    return null
  }
}

/** 阅读位置之前最近的一个 landmark，就是“现在在哪”。 */
function placeAt(definition: CenterDefinition, position: ReaderPosition | null | undefined): CenterLocalizedText | null {
  const target = safeLinearIndex(position)
  if (target === null) return null

  let bestIndex = -1
  let bestTitle: CenterLocalizedText | null = null

  for (const landmark of definition.landmarks) {
    const landmarkIndex = safeLinearIndex(landmark.contentTarget?.position)
    if (landmarkIndex === null || landmarkIndex > target) continue
    if (landmarkIndex >= bestIndex) {
      bestIndex = landmarkIndex
      bestTitle = landmark.title
    }
  }

  return bestTitle
}

export function resolveCenterReadState(input: {
  definition: CenterDefinition
  committedLocation: ReaderPosition | null | undefined
  furthestLocation: ReaderPosition | null | undefined
  snapshot: CenterWorldSnapshot | null | undefined
}): CenterReadState {
  const { definition, committedLocation, furthestLocation, snapshot } = input

  const pageKey = committedLocation ? `${committedLocation.phaseId}/${committedLocation.pageId}` : ''
  const sectionIndex = pageOrder.indexOf(pageKey)
  const beats = readerContentIndex.pageLookup[pageKey]

  return {
    place: placeAt(definition, committedLocation),
    furthestPlace: placeAt(definition, furthestLocation),
    sectionOrdinal: sectionIndex >= 0 ? sectionIndex + 1 : 0,
    sectionTotal: pageOrder.length,
    beatOrdinal: beats && committedLocation ? committedLocation.beatIndex + 1 : 0,
    beatTotal: beats ? beats.length : 0,
    knownCount: snapshot?.unlockedLandmarkIds.length ?? 0,
    visitedCount: snapshot?.visitedLandmarkIds.length ?? 0,
  }
}
