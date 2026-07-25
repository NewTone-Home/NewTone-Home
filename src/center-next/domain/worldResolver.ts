import { resolvePosition } from '../../reader/readerPosition'
import type {
  CenterDefinition,
  CenterProgressDefinition,
  CenterWorldSnapshot,
  ReaderPosition,
} from './contracts'

function linearIndex(position: ReaderPosition): number {
  return resolvePosition(position).linearIndex
}

function sortedProgressStates(definition: CenterDefinition): CenterProgressDefinition[] {
  return [...definition.progressStates].sort((left, right) => linearIndex(left.startsAt) - linearIndex(right.startsAt))
}

function stateAt(definition: CenterDefinition, position: ReaderPosition): CenterProgressDefinition {
  const targetIndex = linearIndex(position)
  const states = sortedProgressStates(definition)
  let resolved = states[0]
  for (const candidate of states) {
    if (linearIndex(candidate.startsAt) > targetIndex) break
    resolved = candidate
  }
  if (!resolved) throw new Error(`Center definition ${definition.id} has no progress states`)
  return resolved
}

export function resolveCenterWorld(input: {
  definition: CenterDefinition
  furthestLocation: ReaderPosition
  committedLocation: ReaderPosition
  visitedLandmarkIds?: string[]
}): CenterWorldSnapshot {
  const facts = stateAt(input.definition, input.furthestLocation)
  const context = stateAt(input.definition, input.committedLocation)
  const unlocked = new Set(facts.unlockedLandmarkIds)
  const visited = [...new Set(input.visitedLandmarkIds ?? [])].filter(id => unlocked.has(id))

  return {
    definitionId: input.definition.id,
    progressKey: facts.key,
    surfaceVariant: facts.surfaceVariant,
    innerVariant: facts.innerVariant,
    unlockedLandmarkIds: [...unlocked],
    visitedLandmarkIds: visited,
    contextualLandmarkIds: (context.contextualLandmarkIds ?? []).filter(id => unlocked.has(id)),
  }
}

export function validateCenterDefinitionPositions(definition: CenterDefinition): CenterDefinition {
  if (definition.progressStates.length === 0) throw new Error('Center definition requires progress states')
  for (const state of definition.progressStates) linearIndex(state.startsAt)
  for (const landmark of definition.landmarks) {
    if (landmark.polygon.length < 3) throw new Error(`Landmark ${landmark.id} requires a polygon`)
    if (landmark.contentTarget?.position) linearIndex(landmark.contentTarget.position)
  }
  return definition
}
