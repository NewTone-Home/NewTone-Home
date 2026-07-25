import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { StoredCenterPackage } from '../domain/contracts'

interface StoredAsset {
  packageId: string
  assetId: string
  mimeType: string
  data: ArrayBuffer
}

interface CenterContentDb extends DBSchema {
  packages: { key: string; value: StoredCenterPackage }
  assets: { key: string; value: StoredAsset }
}

export interface CenterContentRepository {
  listPackages(): Promise<StoredCenterPackage[]>
  getPackage(packageId: string): Promise<StoredCenterPackage | null>
  putPackage(value: StoredCenterPackage): Promise<void>
  putAsset(value: StoredAsset): Promise<void>
  getAsset(packageId: string, assetId: string): Promise<Blob | null>
  removePackage(packageId: string): Promise<void>
}

export class IndexedDbCenterContentRepository implements CenterContentRepository {
  private readonly database: Promise<IDBPDatabase<CenterContentDb>>

  constructor() {
    this.database = openDB<CenterContentDb>('newtone-center-content-v1', 1, {
      upgrade(db) {
        db.createObjectStore('packages')
        db.createObjectStore('assets')
      },
    })
  }

  async listPackages(): Promise<StoredCenterPackage[]> {
    return (await this.database).getAll('packages')
  }

  async getPackage(packageId: string): Promise<StoredCenterPackage | null> {
    return (await (await this.database).get('packages', packageId)) ?? null
  }

  async putPackage(value: StoredCenterPackage): Promise<void> {
    await (await this.database).put('packages', value, value.manifest.id)
  }

  async putAsset(value: StoredAsset): Promise<void> {
    await (await this.database).put('assets', value, `${value.packageId}:${value.assetId}`)
  }

  async getAsset(packageId: string, assetId: string): Promise<Blob | null> {
    const value = await (await this.database).get('assets', `${packageId}:${assetId}`)
    return value ? new Blob([value.data], { type: value.mimeType }) : null
  }

  async removePackage(packageId: string): Promise<void> {
    const db = await this.database
    const transaction = db.transaction(['packages', 'assets'], 'readwrite')
    await transaction.objectStore('packages').delete(packageId)
    const assets = transaction.objectStore('assets')
    for (const key of await assets.getAllKeys()) {
      if (String(key).startsWith(`${packageId}:`)) await assets.delete(key)
    }
    await transaction.done
  }
}
