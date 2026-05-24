import data from "../../../content/data/assets.json"
import type { Asset } from "../../types"

const ASSETS = data as Asset[]

export function getAssets(): Asset[] {
  return ASSETS
}

export function getAssetById(id: string): Asset | undefined {
  return ASSETS.find((a) => a.id === id)
}
