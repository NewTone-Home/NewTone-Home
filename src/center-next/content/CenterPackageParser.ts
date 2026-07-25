import JSZip from 'jszip'
import type {
  CenterAssetDescriptor,
  CenterDefinition,
  CenterPackageManifest,
  StoredCenterPackage,
} from '../domain/contracts'
import { validateCenterDefinitionPositions } from '../domain/worldResolver'
import { centerDefinitionSchema, centerPackageManifestSchema } from './schema'

export interface ParsedCenterAsset {
  packageId: string
  assetId: string
  mimeType: string
  data: ArrayBuffer
}

export interface ParsedCenterPackage {
  storedPackage: StoredCenterPackage
  assets: ParsedCenterAsset[]
}

async function parseAsset(
  zip: JSZip,
  packageId: string,
  descriptor: CenterAssetDescriptor,
): Promise<ParsedCenterAsset> {
  const entry = zip.file(descriptor.path)
  if (!entry) throw new Error(`Center package is missing asset ${descriptor.path}`)
  return {
    packageId,
    assetId: descriptor.id,
    mimeType: descriptor.mimeType,
    data: await entry.async('arraybuffer'),
  }
}

export class CenterPackageParser {
  async parse(source: Blob | ArrayBuffer | Uint8Array): Promise<ParsedCenterPackage> {
    const input = source instanceof Blob ? await source.arrayBuffer() : source
    const zip = await JSZip.loadAsync(input)
    const manifestEntry = zip.file('manifest.json')
    if (!manifestEntry) throw new Error('Center package is missing manifest.json')

    const manifest = centerPackageManifestSchema.parse(
      JSON.parse(await manifestEntry.async('string')),
    ) as CenterPackageManifest
    const definitionEntry = zip.file(manifest.centerDefinitionPath)
    if (!definitionEntry) {
      throw new Error(`Center package is missing ${manifest.centerDefinitionPath}`)
    }
    const definition = validateCenterDefinitionPositions(
      centerDefinitionSchema.parse(
        JSON.parse(await definitionEntry.async('string')),
      ) as CenterDefinition,
    )
    if (definition.id !== manifest.id) {
      throw new Error('Center package manifest and definition IDs do not match')
    }

    const assets = await Promise.all(
      manifest.assets.map(descriptor => parseAsset(zip, manifest.id, descriptor)),
    )
    return {
      storedPackage: {
        manifest,
        definition,
        importedAt: new Date().toISOString(),
      },
      assets,
    }
  }
}
