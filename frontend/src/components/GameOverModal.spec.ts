/**
 * GameOverModal 组件测试
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

  describe('自动 focus 昵称输入框', () => {
    it('当 visible 变为 true 时，应自动 focus 昵称输入框', async () => {
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

    it('当组件初始显示时，应自动 focus 昵称输入框', async () => {
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

    it('已提交状态下不应尝试 focus（输入框不存在）', async () => {
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

      // 模拟提交成功后的状态
      wrapper.vm.setRankingResult({ rank: 1, total: 10, isNewRecord: true })
      await flushPromises()

      // 输入框应该不存在
      expect(wrapper.find('input#nickname').exists()).toBe(false)

      // 验证没有错误发生（可选链安全处理）
      wrapper.unmount()
    })

    it('重置后应重新 focus 昵称输入框', async () => {
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

      // 模拟提交成功
      wrapper.vm.setRankingResult({ rank: 1, total: 10, isNewRecord: false })
      await flushPromises()

      // 输入框应该不存在
      expect(wrapper.find('input#nickname').exists()).toBe(false)

      // 重置状态（模拟用户想重新输入昵称的场景）
      wrapper.vm.resetState()
      await vi.runAllTimersAsync()
      await flushPromises()

      // 输入框应该重新出现并获得焦点
      const input = wrapper.find('input#nickname').element as HTMLInputElement
      expect(input).toBeTruthy()
      expect(document.activeElement).toBe(input)

      wrapper.unmount()
    })

    it('弹窗关闭后重新打开应自动 focus', async () => {
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

      // 初始显示时应该 focus
      let input = wrapper.find('input#nickname').element as HTMLInputElement
      expect(document.activeElement).toBe(input)

      // 关闭弹窗
      await wrapper.setProps({ visible: false })
      await flushPromises()

      // 弹窗关闭后输入框不存在
      expect(wrapper.find('input#nickname').exists()).toBe(false)

      // 重新打开弹窗
      await wrapper.setProps({ visible: true })
      await vi.runAllTimersAsync()
      await flushPromises()

      // 应该重新 focus
      input = wrapper.find('input#nickname').element as HTMLInputElement
      expect(document.activeElement).toBe(input)

      wrapper.unmount()
    })

    it('提交失败后输入框应自动 focus', async () => {
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

      // 初始显示时应该 focus
      const input = wrapper.find('input#nickname').element as HTMLInputElement
      expect(document.activeElement).toBe(input)

      // 输入昵称使按钮可点击
      await wrapper.find('input#nickname').setValue('TestUser')
      await flushPromises()

      // 模拟用户点击提交按钮（焦点转移到按钮）
      const button = wrapper.find('button.btn-primary').element as HTMLButtonElement
      button.focus()
      expect(document.activeElement).toBe(button)

      // 模拟提交失败
      wrapper.vm.setError('Network error')
      await vi.runAllTimersAsync()
      await flushPromises()

      // 输入框应该仍然存在并重新获得焦点
      expect(wrapper.find('input#nickname').exists()).toBe(true)
      expect(document.activeElement).toBe(input)

      wrapper.unmount()
    })
  })
})
