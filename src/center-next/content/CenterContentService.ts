import type { CenterDefinition, StoredCenterPackage } from '../domain/contracts'
import { registerActiveCenterDefinition } from '../domain/definitionRegistry'
import { defaultCenterDefinition, DEFAULT_CENTER_PACKAGE_ID } from './defaultCenterDefinition'
import {
  IndexedDbCenterContentRepository,
  type CenterContentRepository,
} from './CenterContentRepository'
import { CenterPackageParser } from './CenterPackageParser'

export interface CenterAssetUrlSet {
  urls: Record<string, string>
  release(): void
}

export class CenterContentService {
  private repository: CenterContentRepository | null = null
  private readonly parser = new CenterPackageParser()

  private getRepository(): CenterContentRepository {
    if (!this.repository) this.repository = new IndexedDbCenterContentRepository()
    return this.repository
  }

  async listPackages(): Promise<StoredCenterPackage[]> {
    const builtin: StoredCenterPackage = {
      manifest: {
        schemaVersion: 1,
        id: DEFAULT_CENTER_PACKAGE_ID,
        version: '1.0.0',
        title: defaultCenterDefinition.title,
        centerDefinitionPath: 'builtin',
        assets: [],
      },
      definition: defaultCenterDefinition,
      importedAt: 'builtin',
    }
    try {
      return [builtin, ...(await this.getRepository().listPackages())]
    } catch {
      return [builtin]
    }
  }

  async loadDefinition(packageId: string): Promise<CenterDefinition> {
    if (packageId === DEFAULT_CENTER_PACKAGE_ID) {
      return registerActiveCenterDefinition(defaultCenterDefinition)
    }
    const stored = await this.getRepository().getPackage(packageId)
    if (!stored) throw new Error(`Center content package ${packageId} was not found`)
    return registerActiveCenterDefinition(stored.definition)
  }

  async importPackage(source: Blob | ArrayBuffer | Uint8Array): Promise<StoredCenterPackage> {
    const parsed = await this.parser.parse(source)
    const repository = this.getRepository()
    await repository.putPackage(parsed.storedPackage)
    for (const asset of parsed.assets) await repository.putAsset(asset)
    registerActiveCenterDefinition(parsed.storedPackage.definition)
    return parsed.storedPackage
  }

  async resolveAssetUrls(
    packageId: string,
    definition: CenterDefinition,
  ): Promise<CenterAssetUrlSet> {
    if (packageId === DEFAULT_CENTER_PACKAGE_ID) return { urls: {}, release() {} }
    const assetIds = new Set<string>()
    for (const layer of Object.values(definition.layers)) {
      for (const variant of layer.variants) {
        if (variant.assetId) assetIds.add(variant.assetId)
      }
    }

    const urls: Record<string, string> = {}
    const created: string[] = []
    for (const assetId of assetIds) {
      const blob = await this.getRepository().getAsset(packageId, assetId)
      if (!blob) continue
      const url = URL.createObjectURL(blob)
      urls[assetId] = url
      created.push(url)
    }
    return {
      urls,
      release() {
        created.forEach(url => URL.revokeObjectURL(url))
      },
    }
  }
}

export const centerContentService = new CenterContentService()
