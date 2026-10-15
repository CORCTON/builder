import { getRenderableImageUrl } from '@/utils/img-rendering'
import { File, getImageSize } from '@/models/common/file'

export type PrototypeEffect = 'blue' | 'warm' | 'soft'

export function resolvePrototypeEffect(instruction: string): PrototypeEffect | null {
  if (/蓝|blue/i.test(instruction)) return 'blue'
  if (/暖|warm/i.test(instruction)) return 'warm'
  if (/柔和|soft/i.test(instruction)) return 'soft'
  return null
}

export function recolorPixels(data: Uint8ClampedArray, effect: PrototypeEffect, variation: number) {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue
    const luminance = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722
    const color = effect === 'blue' ? [0.48, 0.83, 1.24] : [1.23, 0.86, 0.52]
    for (let channel = 0; channel < 3; channel++) {
      const target = effect === 'soft' ? luminance * 0.8 + 45 : luminance * color[channel]
      const strength = variation % 2 === 0 ? 0.7 : 0.85
      data[i + channel] = data[i + channel] * (1 - strength) + target * strength
    }
  }
}

/** Local, whole-image effects for the interaction prototype; not an AI image-editing adapter. */
export async function createPrototypeCandidate(
  source: File,
  effect: PrototypeEffect,
  variation: number,
  signal: AbortSignal
) {
  const size = await getImageSize(source)
  signal.throwIfAborted()
  if (size.width <= 0 || size.height <= 0 || size.width * size.height > 16_000_000) {
    throw new Error('Image is too large for the local prototype')
  }
  const url = await getRenderableImageUrl(source, signal)
  const image = new Image()
  image.src = url
  await image.decode()
  signal.throwIfAborted()
  const canvas = new OffscreenCanvas(size.width, size.height)
  const ctx = canvas.getContext('2d')
  if (ctx == null) throw new Error('Canvas is not available')
  ctx.drawImage(image, 0, 0, size.width, size.height)
  const pixels = ctx.getImageData(0, 0, size.width, size.height)
  recolorPixels(pixels.data, effect, variation)
  ctx.putImageData(pixels, 0, 0)
  const blob = await canvas.convertToBlob({ type: 'image/png' })
  const buffer = await blob.arrayBuffer()
  signal.throwIfAborted()
  return new File('edited-costume.png', async () => buffer, { type: blob.type, meta: { imgSize: size } })
}

/** Deterministic whole-image resize for the prototype's Adjust module. */
export async function resizeImage(source: File, factor: number, signal: AbortSignal): Promise<File> {
  const size = await getImageSize(source)
  signal.throwIfAborted()
  const url = await getRenderableImageUrl(source, signal)
  const image = new Image()
  image.src = url
  await image.decode()
  signal.throwIfAborted()
  const width = Math.max(1, Math.round(size.width * factor))
  const height = Math.max(1, Math.round(size.height * factor))
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (ctx == null) throw new Error('Canvas is not available')
  ctx.drawImage(image, 0, 0, width, height)
  const blob = await canvas.convertToBlob({ type: 'image/png' })
  const buffer = await blob.arrayBuffer()
  signal.throwIfAborted()
  return new File('resized-costume.png', async () => buffer, {
    type: blob.type,
    meta: { imgSize: { width, height } }
  })
}
