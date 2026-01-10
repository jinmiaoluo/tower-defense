<script lang="ts">
const STORAGE_KEY = 'tower-defense-guide-dismissed'

export default {
  shouldShowGuide(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'true'
    } catch {
      return true
    }
  },
}
</script>

<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted } from 'vue'
import { useI18n } from '@/i18n'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const closeButtonRef = ref<HTMLButtonElement | null>(null)

function handleClose() {
  try {
    localStorage.setItem(STORAGE_KEY, 'true')
  } catch {
    // 忽略 localStorage 写入失败（如隐私模式、配额满）
  }
  // 移除焦点，避免焦点转移到其他可交互元素（如 HelpButton）
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
  emit('close')
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    handleClose()
  }
}

watch(() => props.visible, (newVisible) => {
  if (newVisible) {
    document.addEventListener('keydown', handleKeydown)
    nextTick(() => {
      closeButtonRef.value?.focus()
    })
  } else {
    document.removeEventListener('keydown', handleKeydown)
  }
}, { immediate: true })

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Transition name="modal">
    <div v-if="visible" class="modal-overlay" @click.self="handleClose">
      <div class="modal-content">
        <h2 class="modal-title">{{ t('guide_title') }}</h2>

        <div class="guide-sections">
          <div class="guide-section">
            <h3 class="section-title">{{ t('guide_objective_title') }}</h3>
            <p class="section-content">{{ t('guide_objective') }}</p>
          </div>

          <div class="guide-section">
            <h3 class="section-title">{{ t('guide_build_title') }}</h3>
            <p class="section-content">{{ t('guide_build') }}</p>
          </div>

          <div class="guide-section">
            <h3 class="section-title">{{ t('guide_upgrade_title') }}</h3>
            <p class="section-content">{{ t('guide_upgrade') }}</p>
          </div>

          <div class="guide-section">
            <h3 class="section-title">{{ t('guide_tips_title') }}</h3>
            <p class="section-content">{{ t('guide_tips') }}</p>
          </div>
        </div>

        <button ref="closeButtonRef" class="close-button" @click="handleClose">
          {{ t('guide_start_game') }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--color-background);
  border: 2px solid var(--color-border);
  border-radius: 12px;
  padding: 24px;
  width: 90%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-title {
  color: var(--color-primary);
  font-size: 24px;
  font-weight: bold;
  margin: 0 0 20px 0;
  text-align: center;
}

.guide-sections {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 20px;
}

.guide-section {
  background: var(--color-background-secondary);
  border-radius: 8px;
  padding: 12px 16px;
}

.section-title {
  color: var(--color-text);
  font-size: 16px;
  font-weight: bold;
  margin: 0 0 8px 0;
}

.section-content {
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1.5;
  margin: 0;
}

.close-button {
  width: 100%;
  padding: 14px 24px;
  font-size: 16px;
  font-weight: bold;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  background: var(--color-primary);
  color: var(--color-text);
  transition: background 0.2s;
}

.close-button:hover {
  background: var(--color-primary-hover);
}

@media (max-width: 480px) {
  .modal-content {
    padding: 20px 16px;
    border-radius: 8px;
  }

  .modal-title {
    font-size: 20px;
    margin-bottom: 16px;
  }

  .guide-sections {
    gap: 12px;
    margin-bottom: 16px;
  }

  .guide-section {
    padding: 10px 12px;
  }

  .section-title {
    font-size: 15px;
  }

  .section-content {
    font-size: 13px;
  }

  .close-button {
    min-height: 44px;
    padding: 12px 16px;
  }
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  opacity: 0;
  transform: scale(0.9) translateY(-20px);
}
</style>
