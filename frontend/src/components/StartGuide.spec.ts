/**
 * StartGuide 组件测试
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

  describe('显示控制', () => {
    it('当 visible 为 true 时应显示指引', () => {
      const wrapper = mount(StartGuide, {
        props: { visible: true },
      })

      expect(wrapper.find('.modal-overlay').exists()).toBe(true)
    })

    it('当 visible 为 false 时不应显示指引', () => {
      const wrapper = mount(StartGuide, {
        props: { visible: false },
      })

      expect(wrapper.find('.modal-overlay').exists()).toBe(false)
    })
  })

  describe('关闭行为', () => {
    it('点击关闭按钮应触发 close 事件', async () => {
      const wrapper = mount(StartGuide, {
        props: { visible: true },
      })

      await wrapper.find('.close-button').trigger('click')

      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('显示时应自动聚焦到关闭按钮', async () => {
      const wrapper = mount(StartGuide, {
        props: { visible: true },
        attachTo: document.body,
      })

      await wrapper.vm.$nextTick()
      const closeButton = wrapper.find('.close-button').element as HTMLElement
      expect(document.activeElement).toBe(closeButton)
      wrapper.unmount()
    })

    it('从隐藏变为显示时应自动聚焦到关闭按钮', async () => {
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

    it('关闭时应移除焦点避免焦点转移到其他元素', async () => {
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

    it('按下 Enter 键应触发 close 事件', async () => {
      const wrapper = mount(StartGuide, {
        props: { visible: true },
        attachTo: document.body,
      })

      const event = new KeyboardEvent('keydown', { key: 'Enter' })
      document.dispatchEvent(event)

      expect(wrapper.emitted('close')).toHaveLength(1)
      wrapper.unmount()
    })

    it('visible 为 false 时按下 Enter 键不应触发 close 事件', async () => {
      const wrapper = mount(StartGuide, {
        props: { visible: false },
        attachTo: document.body,
      })

      const event = new KeyboardEvent('keydown', { key: 'Enter' })
      document.dispatchEvent(event)

      expect(wrapper.emitted('close')).toBeUndefined()
      wrapper.unmount()
    })

    it('visible 从 true 变为 false 后按下 Enter 键不应触发 close 事件', async () => {
      const wrapper = mount(StartGuide, {
        props: { visible: true },
        attachTo: document.body,
      })

      // 先验证 visible=true 时可以响应
      let event = new KeyboardEvent('keydown', { key: 'Enter' })
      document.dispatchEvent(event)
      expect(wrapper.emitted('close')).toHaveLength(1)

      // 切换为 visible=false
      await wrapper.setProps({ visible: false })

      // 再次按 Enter 不应触发新的 close 事件
      event = new KeyboardEvent('keydown', { key: 'Enter' })
      document.dispatchEvent(event)
      expect(wrapper.emitted('close')).toHaveLength(1) // 仍然是 1，没有新增

      wrapper.unmount()
    })

    it('visible 从 false 变为 true 后按下 Enter 键应触发 close 事件', async () => {
      const wrapper = mount(StartGuide, {
        props: { visible: false },
        attachTo: document.body,
      })

      // visible=false 时按 Enter 不应响应
      let event = new KeyboardEvent('keydown', { key: 'Enter' })
      document.dispatchEvent(event)
      expect(wrapper.emitted('close')).toBeUndefined()

      // 切换为 visible=true（模拟用户点击 HelpButton 重新打开）
      await wrapper.setProps({ visible: true })

      // 再次按 Enter 应触发 close 事件
      event = new KeyboardEvent('keydown', { key: 'Enter' })
      document.dispatchEvent(event)
      expect(wrapper.emitted('close')).toHaveLength(1)

      wrapper.unmount()
    })

    it('点击背景遮罩应触发 close 事件', async () => {
      const wrapper = mount(StartGuide, {
        props: { visible: true },
      })

      await wrapper.find('.modal-overlay').trigger('click')

      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('点击内容区域不应触发 close 事件', async () => {
      const wrapper = mount(StartGuide, {
        props: { visible: true },
      })

      await wrapper.find('.modal-content').trigger('click')

      expect(wrapper.emitted('close')).toBeUndefined()
    })
  })

  describe('自动记住关闭状态', () => {
    it('关闭时应自动保存到 localStorage', async () => {
      const wrapper = mount(StartGuide, {
        props: { visible: true },
      })

      await wrapper.find('.close-button').trigger('click')

      expect(localStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, 'true')
    })

    it('点击遮罩关闭时也应保存到 localStorage', async () => {
      const wrapper = mount(StartGuide, {
        props: { visible: true },
      })

      await wrapper.find('.modal-overlay').trigger('click')

      expect(localStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, 'true')
    })

    it('localStorage.setItem 抛出异常时不应崩溃', async () => {
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

    it('不应显示 checkbox 选项', () => {
      const wrapper = mount(StartGuide, {
        props: { visible: true },
      })

      expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
    })
  })

  describe('shouldShowGuide 静态方法', () => {
    it('首次访问应返回 true', () => {
      const { shouldShowGuide } = StartGuide
      expect(shouldShowGuide()).toBe(true)
    })

    it('已dismiss过应返回 false', () => {
      localStorageMock[STORAGE_KEY] = 'true'
      const { shouldShowGuide } = StartGuide
      expect(shouldShowGuide()).toBe(false)
    })

    it('localStorage 返回异常值时应返回 true', () => {
      localStorageMock[STORAGE_KEY] = 'false'
      expect(StartGuide.shouldShowGuide()).toBe(true)

      localStorageMock[STORAGE_KEY] = '1'
      expect(StartGuide.shouldShowGuide()).toBe(true)

      localStorageMock[STORAGE_KEY] = ''
      expect(StartGuide.shouldShowGuide()).toBe(true)
    })

    it('localStorage.getItem 抛出异常时应返回 true', () => {
      vi.stubGlobal('localStorage', {
        getItem: vi.fn(() => {
          throw new Error('localStorage disabled')
        }),
        setItem: vi.fn(),
      })

      expect(StartGuide.shouldShowGuide()).toBe(true)
    })
  })

  describe('内容显示', () => {
    it('应显示游戏目标说明', () => {
      const wrapper = mount(StartGuide, {
        props: { visible: true },
      })

      const content = wrapper.text()
      expect(content).toContain('Objective')
      expect(content).toContain('monsters')
    })

    it('应显示建造操作说明', () => {
      const wrapper = mount(StartGuide, {
        props: { visible: true },
      })

      const content = wrapper.text()
      expect(content).toContain('Build Towers')
    })

    it('应显示升级/出售说明', () => {
      const wrapper = mount(StartGuide, {
        props: { visible: true },
      })

      const content = wrapper.text()
      expect(content).toContain('Upgrade')
      expect(content).toContain('Sell')
    })

    it('关闭按钮应显示通用确认文案而非开始游戏', () => {
      const wrapper = mount(StartGuide, {
        props: { visible: true },
      })

      const buttonText = wrapper.find('.close-button').text()
      expect(buttonText).toBe('Got it')
      expect(buttonText).not.toContain('Start')
    })
  })
})
