import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { File } from '@/models/common/file'
import CostumeEditModal from './CostumeEditModal.vue'
import { createPrototypeCandidate } from './prototype'

const { confirm } = vi.hoisted(() => ({ confirm: vi.fn() }))

vi.mock('@/utils/i18n', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useI18n: () => ({ t: (message: { en: string }) => message.en })
}))
vi.mock('@/components/ui', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useConfirmDialogWithResult: () => confirm
}))
vi.mock('@/utils/img-rendering', () => ({
  useRenderableImageUrl: () => [ref('blob:preview'), ref(false)]
}))
vi.mock('./prototype', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createPrototypeCandidate: vi.fn()
}))

function file(name: string) {
  return new File(name, async () => new ArrayBuffer(0))
}

let wrapper: VueWrapper
let source: File
let result: File

function button(text: string) {
  const match = wrapper.findAll('button').find((node) => node.text() === text)
  if (match == null) throw new Error(`Button not found: ${text}`)
  return match
}

async function preview(instruction = 'Change to a blue palette') {
  await wrapper.get('textarea').setValue(instruction)
  await button('Preview edit').trigger('click')
  await vi.advanceTimersByTimeAsync(900)
  await flushPromises()
}

beforeEach(() => {
  vi.useFakeTimers()
  confirm.mockResolvedValue(true)
  source = file('source.png')
  result = file('candidate.png')
  vi.mocked(createPrototypeCandidate).mockResolvedValue(result)
  wrapper = mount(CostumeEditModal, {
    props: { visible: true, image: source, name: 'Explorer' },
    global: {
      mocks: { $t: (message: { en: string }) => message.en },
      directives: { radar: () => {} },
      stubs: {
        UIFormModal: { template: '<div><slot /></div>' },
        UIImg: true,
        UILoading: true
      }
    }
  })
})

afterEach(() => {
  wrapper.unmount()
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('CostumeEditModal', () => {
  it('labels the input and disables empty instructions', () => {
    expect(button('Preview edit').attributes('disabled')).toBeDefined()
    const input = wrapper.get('textarea')
    const label = wrapper.get(`[id="${input.attributes('aria-labelledby')}"]`)
    expect(label.text()).toBe('What would you like to change?')
    expect(wrapper.text()).toContain('not AI editing')
  })

  it('rejects unsupported instructions without calling an AI or changing the project', async () => {
    await preview('Remove the hat')
    expect(createPrototypeCandidate).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toContain('not connected yet')
    expect(wrapper.emitted('resolved')).toBeUndefined()
  })

  it('keeps a preview separate until explicitly applied', async () => {
    await preview()
    expect(createPrototypeCandidate).toHaveBeenCalledWith(source, 'blue', 0, expect.any(AbortSignal))
    expect(wrapper.emitted('resolved')).toBeUndefined()
    await button('Apply').trigger('click')
    expect(wrapper.emitted('resolved')).toEqual([[result]])
  })

  it('retries from the same source and retains earlier candidates', async () => {
    await preview()
    const retry = file('retry.png')
    vi.mocked(createPrototypeCandidate).mockResolvedValue(retry)
    await button('Try again').trigger('click')
    await vi.advanceTimersByTimeAsync(900)
    await flushPromises()
    expect(createPrototypeCandidate).toHaveBeenLastCalledWith(source, 'blue', 1, expect.any(AbortSignal))
    await wrapper.get('button[aria-label="Preview 1"]').trigger('click')
    await button('Apply').trigger('click')
    expect(wrapper.emitted('resolved')).toEqual([[result]])
  })

  it('continues from the chosen result, not from the initial image', async () => {
    await preview()
    await button('Continue editing').trigger('click')
    expect(wrapper.text()).toContain('Unsaved edits')
    const next = file('second-round.png')
    vi.mocked(createPrototypeCandidate).mockResolvedValue(next)
    await preview('Change to a warm palette')
    expect(createPrototypeCandidate).toHaveBeenLastCalledWith(result, 'warm', 0, expect.any(AbortSignal))
    await button('Apply').trigger('click')
    expect(wrapper.emitted('resolved')).toEqual([[next]])
  })

  it('lets people keep editing or discard without committing a candidate', async () => {
    await preview()
    confirm.mockResolvedValueOnce(false)
    await button('Cancel').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('cancelled')).toBeUndefined()
    await button('Cancel').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('cancelled')).toHaveLength(1)
    expect(wrapper.emitted('resolved')).toBeUndefined()
  })

  it('ignores results arriving after cancellation', async () => {
    let resolve!: (value: File) => void
    vi.mocked(createPrototypeCandidate).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        })
    )
    await wrapper.get('textarea').setValue('Change to a blue palette')
    await button('Preview edit').trigger('click')
    await vi.advanceTimersByTimeAsync(900)
    await button('Cancel').trigger('click')
    await flushPromises()
    await wrapper.setProps({ visible: false })
    resolve(result)
    await flushPromises()
    expect(wrapper.findAll('button').some((node) => node.text() === 'Apply')).toBe(false)
    expect(wrapper.emitted('resolved')).toBeUndefined()
  })

  it('keeps the source intact after a failed preview and allows retry', async () => {
    vi.mocked(createPrototypeCandidate).mockRejectedValueOnce(new Error('Preview failed'))
    await preview()
    expect(wrapper.get('[role="alert"]').text()).toContain('unchanged')
    expect(wrapper.emitted('resolved')).toBeUndefined()
    await preview()
    await button('Apply').trigger('click')
    expect(wrapper.emitted('resolved')).toEqual([[result]])
  })
})
