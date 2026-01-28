/**
 * GameOverModal component tests
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import GameOverModal from './GameOverModal.vue'

describe('GameOverModal', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('auto-focus nickname input', () => {
    it('should auto-focus the nickname input when visible becomes true', async () => {
      const wrapper = mount(GameOverModal, {
        props: {
          visible: false,
          gameData: null,
        },
        attachTo: document.body,
      })

      await wrapper.setProps({
        visible: true,
        gameData: {
          score: 100,
          wavesCompleted: 5,
          sessionId: 'test-session',
        },
      })

      await vi.runAllTimersAsync()
      await flushPromises()

      const input = wrapper.find('input#nickname').element as HTMLInputElement
      expect(document.activeElement).toBe(input)

      wrapper.unmount()
    })

    it('should auto-focus the nickname input on initial display', async () => {
      const wrapper = mount(GameOverModal, {
        props: {
          visible: true,
          gameData: {
            score: 100,
            wavesCompleted: 5,
            sessionId: 'test-session',
          },
        },
        attachTo: document.body,
      })

      await vi.runAllTimersAsync()
      await flushPromises()

      const input = wrapper.find('input#nickname').element as HTMLInputElement
      expect(document.activeElement).toBe(input)

      wrapper.unmount()
    })

    it('should not attempt to focus when already submitted (input does not exist)', async () => {
      const wrapper = mount(GameOverModal, {
        props: {
          visible: true,
          gameData: {
            score: 100,
            wavesCompleted: 5,
            sessionId: 'test-session',
          },
        },
        attachTo: document.body,
      })

      await vi.runAllTimersAsync()
      await flushPromises()

      // Simulate successful submission state
      wrapper.vm.setRankingResult({ rank: 1, total: 10, isNewRecord: true })
      await flushPromises()

      // The input should not exist
      expect(wrapper.find('input#nickname').exists()).toBe(false)

      // Verify no errors occur (optional chaining handles this safely)
      wrapper.unmount()
    })

    it('should re-focus the nickname input after reset', async () => {
      const wrapper = mount(GameOverModal, {
        props: {
          visible: true,
          gameData: {
            score: 100,
            wavesCompleted: 5,
            sessionId: 'test-session',
          },
        },
        attachTo: document.body,
      })

      await vi.runAllTimersAsync()
      await flushPromises()

      // Simulate successful submission
      wrapper.vm.setRankingResult({ rank: 1, total: 10, isNewRecord: false })
      await flushPromises()

      // The input should not exist
      expect(wrapper.find('input#nickname').exists()).toBe(false)

      // Reset state (simulating user wanting to re-enter nickname)
      wrapper.vm.resetState()
      await vi.runAllTimersAsync()
      await flushPromises()

      // The input should reappear and be focused
      const input = wrapper.find('input#nickname').element as HTMLInputElement
      expect(input).toBeTruthy()
      expect(document.activeElement).toBe(input)

      wrapper.unmount()
    })

    it('should auto-focus after closing and reopening the modal', async () => {
      const wrapper = mount(GameOverModal, {
        props: {
          visible: true,
          gameData: {
            score: 100,
            wavesCompleted: 5,
            sessionId: 'test-session',
          },
        },
        attachTo: document.body,
      })

      await vi.runAllTimersAsync()
      await flushPromises()

      // Should be focused on initial display
      let input = wrapper.find('input#nickname').element as HTMLInputElement
      expect(document.activeElement).toBe(input)

      // Close the modal
      await wrapper.setProps({ visible: false })
      await flushPromises()

      // Input should not exist when modal is closed
      expect(wrapper.find('input#nickname').exists()).toBe(false)

      // Reopen the modal
      await wrapper.setProps({ visible: true })
      await vi.runAllTimersAsync()
      await flushPromises()

      // Should be focused again
      input = wrapper.find('input#nickname').element as HTMLInputElement
      expect(document.activeElement).toBe(input)

      wrapper.unmount()
    })

    it('should auto-focus the input after a failed submission', async () => {
      const wrapper = mount(GameOverModal, {
        props: {
          visible: true,
          gameData: {
            score: 100,
            wavesCompleted: 5,
            sessionId: 'test-session',
          },
        },
        attachTo: document.body,
      })

      await vi.runAllTimersAsync()
      await flushPromises()

      // Should be focused on initial display
      const input = wrapper.find('input#nickname').element as HTMLInputElement
      expect(document.activeElement).toBe(input)

      // Enter nickname to make the button clickable
      await wrapper.find('input#nickname').setValue('TestUser')
      await flushPromises()

      // Simulate user clicking submit button (focus shifts to button)
      const button = wrapper.find('button.btn-primary').element as HTMLButtonElement
      button.focus()
      expect(document.activeElement).toBe(button)

      // Simulate submission failure
      wrapper.vm.setError('Network error')
      await vi.runAllTimersAsync()
      await flushPromises()

      // The input should still exist and regain focus
      expect(wrapper.find('input#nickname').exists()).toBe(true)
      expect(document.activeElement).toBe(input)

      wrapper.unmount()
    })
  })
})
