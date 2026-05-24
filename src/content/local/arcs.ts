import data from "../../../content/data/arcs.json"
import type { Arc } from "../../types"

const ARCS = data as Arc[]

export function getArcs(): Arc[] {
  return ARCS
}

export function getArcById(id: string): Arc | undefined {
  return ARCS.find((a) => a.id === id)
}

export function getArcsByWorldId(worldId: string): Arc[] {
  return ARCS.filter((a) => a.worldId === worldId)
}
