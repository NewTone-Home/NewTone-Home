import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import {
  LANDING_PARALLAX_LIMIT,
  mapDeviceOrientation,
  resolveLandingParallax,
  resolveOrientationNormalized,
  resolvePointerNormalized,
  resolveStablePoseAnchor,
} from '../src/landing/landingParallax'

const landingSketchCss = fs.readFileSync(new URL('../src/components/landing/LandingSketchLayer.css', import.meta.url), 'utf8')
const sceneParallaxHook = fs.readFileSync(new URL('../src/hooks/useSceneParallax.js', import.meta.url), 'utf8')

describe('Landing title parallax', () => {
  it('maps the center to rest and clamps viewport corners', () => {
    expect(resolveLandingParallax(640, 360, 1280, 720)).toEqual({ x: 0, y: 0 })
    expect(resolveLandingParallax(1280, 720, 1280, 720)).toEqual(LANDING_PARALLAX_LIMIT)
    expect(resolveLandingParallax(-100, -100, 1280, 720)).toEqual({ x: -14, y: -10 })
  })

  it('keeps the visual offset within the approved restrained range', () => {
    const offset = resolveLandingParallax(1020, 160, 1280, 720)
    expect(Math.abs(offset.x)).toBeLessThanOrEqual(14)
    expect(Math.abs(offset.y)).toBeLessThanOrEqual(10)
  })

  it('emits the same normalized space before layer-specific amplitudes', () => {
    expect(resolvePointerNormalized(640, 360, 1280, 720)).toEqual({ x: 0, y: 0 })
    expect(resolvePointerNormalized(1280, 0, 1280, 720)).toEqual({ x: 1, y: -1 })
  })

  it('lets a real mouse drive returned Landing even on a hybrid coarse-pointer device', () => {
    expect(sceneParallaxHook).toContain("event.pointerType !== 'mouse'")
    expect(sceneParallaxHook).not.toContain("orientationPreferred || event.pointerType === 'touch'")
    expect(sceneParallaxHook).toContain("setTarget(normalized.x, normalized.y, 'pointer')")
  })

  it('reports an honest static fallback when mobile orientation is unavailable or denied', () => {
    expect(sceneParallaxHook).toContain("settleStatic('unsupported')")
    expect(sceneParallaxHook).toContain("settleStatic('denied')")
    expect(sceneParallaxHook).toContain("setTarget(normalized.x, normalized.y, 'orientation')")
  })

  it('maps device orientation through the current screen rotation', () => {
    expect(mapDeviceOrientation(10, 4, 0)).toEqual({ x: 4, y: 10 })
    expect(mapDeviceOrientation(10, 4, 90)).toEqual({ x: 10, y: -4 })
    expect(mapDeviceOrientation(10, 4, 270)).toEqual({ x: -10, y: 4 })
    expect(mapDeviceOrientation(null, 4, 0)).toBeNull()
  })

  it('normalizes orientation relative to the scene baseline and clamps it', () => {
    expect(resolveOrientationNormalized({ x: 7, y: -7 }, { x: 0, y: 0 }, 14)).toEqual({ x: .5, y: -.5 })
    expect(resolveOrientationNormalized({ x: 30, y: -30 }, { x: 0, y: 0 }, 14)).toEqual({ x: 1, y: -1 })
  })

  it('measures stability across a pose window instead of adjacent slow frames', () => {
    const anchor = { x: 0, y: 0 }
    expect(resolveStablePoseAnchor(anchor, { x: .3, y: 0 }, .55)).toEqual({ anchor, stable: true })
    expect(resolveStablePoseAnchor(anchor, { x: .6, y: 0 }, .55)).toEqual({ anchor: { x: .6, y: 0 }, stable: false })
  })

  it('keeps rubbed-out marks on the active paper tone instead of fixed white bars', () => {
    expect(landingSketchCss).toContain('stroke: var(--reader-paper, var(--paper-base, #f0ebe2))')
    expect(landingSketchCss).toContain('fill: var(--reader-paper, var(--paper-base, #f0ebe2))')
    expect(landingSketchCss).not.toContain('stroke: #f0ebe2')
  })
})
