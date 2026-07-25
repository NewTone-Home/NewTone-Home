import { defaultCenterDefinition } from '../content/defaultCenterDefinition'
import type { CenterDefinition } from './contracts'
import { validateCenterDefinitionPositions } from './worldResolver'

let activeDefinition = validateCenterDefinitionPositions(defaultCenterDefinition)

export function getActiveCenterDefinition(): CenterDefinition {
  return activeDefinition
}

export function registerActiveCenterDefinition(definition: CenterDefinition): CenterDefinition {
  activeDefinition = validateCenterDefinitionPositions(definition)
  return activeDefinition
}
