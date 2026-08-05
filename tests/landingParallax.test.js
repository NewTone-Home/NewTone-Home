import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { LANDING_PARALLAX_LIMIT, resolveLandingParallax } from '../src/landing/landingParallax'

const landingSketchCss = fs.readFileSync(new URL('../src/components/landing/LandingSketchLayer.css', import.meta.url), 'utf8')

describe('Landing title parallax', () => {
  it('maps the center to rest and clamps viewport corners', () => {
    expect(resolveLandingParallax(640, 360, 1280, 720)).toEqual({ x: 0, y: 0 })
    expect(resolveLandingParallax(1280, 720, 1280, 720)).toEqual(LANDING_PARALLAX_LIMIT)
    expect(resolveLandingParallax(-100, -100, 1280, 720)).toEqual({ x: -12, y: -9 })
  })

  it('keeps the visual offset within the approved restrained range', () => {
    const offset = resolveLandingParallax(1020, 160, 1280, 720)
    expect(Math.abs(offset.x)).toBeLessThanOrEqual(12)
    expect(Math.abs(offset.y)).toBeLessThanOrEqual(9)
  })

  it('keeps rubbed-out marks on the active paper tone instead of fixed white bars', () => {
    expect(landingSketchCss).toContain('stroke: var(--reader-paper, var(--paper-base, #f0ebe2))')
    expect(landingSketchCss).toContain('fill: var(--reader-paper, var(--paper-base, #f0ebe2))')
    expect(landingSketchCss).not.toContain('stroke: #f0ebe2')
  })
})
