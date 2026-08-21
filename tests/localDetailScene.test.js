import { describe, expect, it } from 'vitest'
import {
  LOCAL_DETAIL_SCENE,
  LOCAL_DETAIL_VIEWBOX,
  localDetailHeightAt,
} from '../src/center/geometry/localDetailScene'

describe('local structured detail scene', () => {
  it('keeps semantic terrain and world-piece data separate from rendered paths', () => {
    expect(LOCAL_DETAIL_SCENE.data.terrain.mountains.length).toBeGreaterThanOrEqual(2)
    expect(LOCAL_DETAIL_SCENE.data.river.points.length).toBeGreaterThan(5)
    expect(LOCAL_DETAIL_SCENE.data.roads.length).toBeGreaterThanOrEqual(3)
    expect(LOCAL_DETAIL_SCENE.data.cells.every(cell => Array.isArray(cell.neighbors))).toBe(true)
    expect(LOCAL_DETAIL_SCENE.data.landmarks.map(landmark => landmark.id)).toContain('memory-archive')
  })

  it('builds a readable local scene with meaningful line hierarchy', () => {
    const archive = LOCAL_DETAIL_SCENE.landmarks.find(landmark => landmark.id === 'memory-archive')
    expect(archive.focus).toBe(true)
    expect(archive.geometry.stats.masses).toBeGreaterThanOrEqual(3)
    expect(archive.geometry.layers.primary.length).toBeGreaterThan(100)
    expect(archive.geometry.layers.secondary.length).toBeGreaterThan(100)
    expect(archive.geometry.layers.tertiary.length).toBeGreaterThan(100)
    expect(archive.geometry.hitPath).toContain('M')
  })

  it('uses terrain height for roads and landmarks instead of a flat overlay', () => {
    const low = localDetailHeightAt(8.5, 7.2)
    const ridge = localDetailHeightAt(3.5, 2.1)
    expect(ridge).toBeGreaterThan(low)
    expect(LOCAL_DETAIL_VIEWBOX.width).toBe(1600)
    expect(LOCAL_DETAIL_VIEWBOX.height).toBe(1000)
  })
})
