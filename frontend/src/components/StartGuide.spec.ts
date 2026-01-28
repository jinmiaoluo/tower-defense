/**
 * StartGuide component tests
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import StartGuide from './StartGuide.vue'

const STORAGE_KEY = 'tower-defense-guide-dismissed'

describe('StartGuide', () => {
  let localStorageMock: Record<string, string>

  beforeEach(() => {
    localStorageMock = {}
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => localStorageMock[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageMock[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageMock[key]
      }),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('visibility control', () => {
    it('should show the guide when visible is true', () => {
      const wrapper = mount(StartGuide, {
        props: { visible: true },
      })

      expect(wrapper.find('.modal-overlay').exists()).toBe(true)
    })

    it('should not show the guide when visible is false', () => {
      const wrapper = mount(StartGuide, {
        props: { visible: false },
      })

      expect(wrapper.find('.modal-overlay').exists()).toBe(false)
    })
  })

  describe('close behavior', () => {
    it('should emit close event when close button is clicked', async () => {
      const wrapper = mount(StartGuide, {
        props: { visible: true },
      })

      await wrapper.find('.close-button').trigger('click')

      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('should auto-focus the close button when shown', async () => {
      const wrapper = mount(StartGuide, {
        props: { visible: true },
        attachTo: document.body,
      })

      await wrapper.vm.$nextTick()
      const closeButton = wrapper.find('.close-button').element as HTMLElement
      expect(document.activeElement).toBe(closeButton)
      wrapper.unmount()
    })

    it('should auto-focus the close button when transitioning from hidden to shown', async () => {
      const wrapper = mount(StartGuide, {
        props: { visible: false },
        attachTo: document.body,
      })

      expect(wrapper.find('.close-button').exists()).toBe(false)

      await wrapper.setProps({ visible: true })
      await wrapper.vm.$nextTick()

      const closeButton = wrapper.find('.close-button').element as HTMLElement
      expect(document.activeElement).toBe(closeButton)
      wrapper.unmount()
    })

    it('should remove focus on close to prevent focus shifting to other elements', async () => {
      const wrapper = mount(StartGuide, {
        props: { visible: true },
        attachTo: document.body,
      })

      await wrapper.vm.$nextTick()
      const closeButton = wrapper.find('.close-button').element as HTMLElement
      expect(document.activeElement).toBe(closeButton)

      await wrapper.find('.close-button').trigger('click')

      expect(document.activeElement).not.toBe(closeButton)
      expect(document.activeElement).toBe(document.body)
      wrapper.unmount()
    })

    it('should emit close event when Enter key is pressed', async () => {
      const wrapper = mount(StartGuide, {
        props: { visible: true },
        attachTo: document.body,
      })

      const event = new KeyboardEvent('keydown', { key: 'Enter' })
      document.dispatchEvent(event)

      expect(wrapper.emitted('close')).toHaveLength(1)
      wrapper.unmount()
    })

    it('should not emit close event when Enter is pressed while visible is false', async () => {
      const wrapper = mount(StartGuide, {
        props: { visible: false },
        attachTo: document.body,
      })

      const event = new KeyboardEvent('keydown', { key: 'Enter' })
      document.dispatchEvent(event)

      expect(wrapper.emitted('close')).toBeUndefined()
      wrapper.unmount()
    })

    it('should not emit close event on Enter after visible changes from true to false', async () => {
      const wrapper = mount(StartGuide, {
        props: { visible: true },
        attachTo: document.body,
      })

      // Verify Enter triggers close when visible=true
      let event = new KeyboardEvent('keydown', { key: 'Enter' })
      document.dispatchEvent(event)
      expect(wrapper.emitted('close')).toHaveLength(1)

      // Switch to visible=false
      await wrapper.setProps({ visible: false })

      // Press Enter again; should not trigger a new close event
      event = new KeyboardEvent('keydown', { key: 'Enter' })
      document.dispatchEvent(event)
      expect(wrapper.emitted('close')).toHaveLength(1) // Still 1, no new emission

      wrapper.unmount()
    })

    it('should emit close event on Enter after visible changes from false to true', async () => {
      const wrapper = mount(StartGuide, {
        props: { visible: false },
        attachTo: document.body,
      })

      // Enter should not respond when visible=false
      let event = new KeyboardEvent('keydown', { key: 'Enter' })
      document.dispatchEvent(event)
      expect(wrapper.emitted('close')).toBeUndefined()

      // Switch to visible=true (simulating user clicking HelpButton to reopen)
      await wrapper.setProps({ visible: true })

      // Press Enter again; should trigger close event
      event = new KeyboardEvent('keydown', { key: 'Enter' })
      document.dispatchEvent(event)
      expect(wrapper.emitted('close')).toHaveLength(1)

      wrapper.unmount()
    })

    it('should emit close event when clicking the backdrop overlay', async () => {
      const wrapper = mount(StartGuide, {
        props: { visible: true },
      })

      await wrapper.find('.modal-overlay').trigger('click')

      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('should not emit close event when clicking the content area', async () => {
      const wrapper = mount(StartGuide, {
        props: { visible: true },
      })

      await wrapper.find('.modal-content').trigger('click')

      expect(wrapper.emitted('close')).toBeUndefined()
    })
  })

  describe('auto-remember dismissed state', () => {
    it('should save to localStorage on close', async () => {
      const wrapper = mount(StartGuide, {
        props: { visible: true },
      })

      await wrapper.find('.close-button').trigger('click')

      expect(localStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, 'true')
    })

    it('should save to localStorage when closing via overlay click', async () => {
      const wrapper = mount(StartGuide, {
        props: { visible: true },
      })

      await wrapper.find('.modal-overlay').trigger('click')

      expect(localStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, 'true')
    })

    it('should not crash when localStorage.setItem throws', async () => {
      vi.stubGlobal('localStorage', {
        getItem: vi.fn(() => null),
        setItem: vi.fn(() => {
          throw new Error('QuotaExceededError')
        }),
      })

      const wrapper = mount(StartGuide, {
        props: { visible: true },
      })

      await expect(
        wrapper.find('.close-button').trigger('click'),
      ).resolves.toBeUndefined()
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('should not show a checkbox option', () => {
      const wrapper = mount(StartGuide, {
        props: { visible: true },
      })

      expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
    })
  })

  describe('shouldShowGuide static method', () => {
    it('should return true on first visit', () => {
      const { shouldShowGuide } = StartGuide
      expect(shouldShowGuide()).toBe(true)
    })

    it('should return false after being dismissed', () => {
      localStorageMock[STORAGE_KEY] = 'true'
      const { shouldShowGuide } = StartGuide
      expect(shouldShowGuide()).toBe(false)
    })

    it('should return true when localStorage returns unexpected values', () => {
      localStorageMock[STORAGE_KEY] = 'false'
      expect(StartGuide.shouldShowGuide()).toBe(true)

      localStorageMock[STORAGE_KEY] = '1'
      expect(StartGuide.shouldShowGuide()).toBe(true)

      localStorageMock[STORAGE_KEY] = ''
      expect(StartGuide.shouldShowGuide()).toBe(true)
    })

    it('should return true when localStorage.getItem throws', () => {
      vi.stubGlobal('localStorage', {
        getItem: vi.fn(() => {
          throw new Error('localStorage disabled')
        }),
        setItem: vi.fn(),
      })

      expect(StartGuide.shouldShowGuide()).toBe(true)
    })
  })

  describe('content display', () => {
    it('should display the game objective description', () => {
      const wrapper = mount(StartGuide, {
        props: { visible: true },
      })

      const content = wrapper.text()
      expect(content).toContain('Objective')
      expect(content).toContain('monsters')
    })

    it('should display the build instructions', () => {
      const wrapper = mount(StartGuide, {
        props: { visible: true },
      })

      const content = wrapper.text()
      expect(content).toContain('Build Towers')
    })

    it('should display the upgrade/sell instructions', () => {
      const wrapper = mount(StartGuide, {
        props: { visible: true },
      })

      const content = wrapper.text()
      expect(content).toContain('Upgrade')
      expect(content).toContain('Sell')
    })

    it('should show a generic confirmation label on the close button, not a start-game label', () => {
      const wrapper = mount(StartGuide, {
        props: { visible: true },
      })

      const buttonText = wrapper.find('.close-button').text()
      expect(buttonText).toBe('Got it')
      expect(buttonText).not.toContain('Start')
    })
  })
})
