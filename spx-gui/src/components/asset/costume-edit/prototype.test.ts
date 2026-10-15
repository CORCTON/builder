import { describe, expect, it } from 'vitest'
import { recolorPixels, resolvePrototypeEffect } from './prototype'

describe('local costume-edit prototype effects', () => {
  it.each([
    ['换成蓝色系', 'blue'],
    ['Change to a BLUE palette', 'blue'],
    ['换成暖色系', 'warm'],
    ['Change to a warm palette', 'warm'],
    ['颜色柔和一点', 'soft'],
    ['Make the colors softer', 'soft'],
    ['Remove the hat', null],
    ['', null]
  ])('resolves %s without pretending to support arbitrary AI instructions', (instruction, effect) => {
    expect(resolvePrototypeEffect(instruction)).toBe(effect)
  })

  it('preserves every alpha value and leaves fully transparent pixels untouched', () => {
    const pixels = new Uint8ClampedArray([20, 80, 120, 0, 200, 100, 20, 128, 80, 120, 150, 255])
    recolorPixels(pixels, 'blue', 0)
    expect([...pixels.slice(0, 4)]).toEqual([20, 80, 120, 0])
    expect([pixels[7], pixels[11]]).toEqual([128, 255])
    expect(pixels.length).toBe(12)
    expect(pixels[6]).toBeGreaterThan(pixels[4])
  })

  it('generates deterministic variations without modifying the source buffer', () => {
    const source = new Uint8ClampedArray([200, 100, 20, 255])
    const first = source.slice()
    const retry = source.slice()
    const repeat = source.slice()
    recolorPixels(first, 'warm', 0)
    recolorPixels(retry, 'warm', 1)
    recolorPixels(repeat, 'warm', 0)
    expect(first).toEqual(repeat)
    expect(first).not.toEqual(retry)
    expect([...source]).toEqual([200, 100, 20, 255])
  })
})
