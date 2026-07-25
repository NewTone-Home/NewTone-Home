import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { defaultCenterDefinition } from './defaultCenterDefinition'
import { CenterPackageParser } from './CenterPackageParser'

describe('CenterPackageParser', () => {
  it('parses a validated world definition and binary assets from one package', async () => {
    const zip = new JSZip()
    zip.file('manifest.json', JSON.stringify({
      schemaVersion: 1,
      id: defaultCenterDefinition.id,
      version: '1.0.0',
      title: defaultCenterDefinition.title,
      centerDefinitionPath: 'center/world.json',
      assets: [{ id: 'surface-map', path: 'assets/surface.png', mimeType: 'image/png' }],
    }))
    zip.file('center/world.json', JSON.stringify({
      ...defaultCenterDefinition,
      layers: {
        ...defaultCenterDefinition.layers,
        surface: {
          ...defaultCenterDefinition.layers.surface,
          variants: defaultCenterDefinition.layers.surface.variants.map((variant, index) => (
            index === 0 ? { ...variant, assetId: 'surface-map' } : variant
          )),
        },
      },
    }))
    zip.file('assets/surface.png', new Uint8Array([137, 80, 78, 71]))

    const parsed = await new CenterPackageParser().parse(
      await zip.generateAsync({ type: 'uint8array' }),
    )

    expect(parsed.storedPackage.manifest.id).toBe(defaultCenterDefinition.id)
    expect(parsed.storedPackage.definition.layers.surface.variants[0].assetId).toBe('surface-map')
    expect(parsed.assets).toHaveLength(1)
    expect(parsed.assets[0].mimeType).toBe('image/png')
  })

  it('rejects a package whose definition does not match its manifest', async () => {
    const zip = new JSZip()
    zip.file('manifest.json', JSON.stringify({
      schemaVersion: 1,
      id: 'different-id',
      version: '1.0.0',
      title: defaultCenterDefinition.title,
      centerDefinitionPath: 'world.json',
      assets: [],
    }))
    zip.file('world.json', JSON.stringify(defaultCenterDefinition))

    await expect(new CenterPackageParser().parse(
      await zip.generateAsync({ type: 'uint8array' }),
    )).rejects.toThrow('do not match')
  })
})
