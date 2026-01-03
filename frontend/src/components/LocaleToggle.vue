<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/i18n'

const { t, locale, setLocale } = useI18n()

const isEnglish = computed(() => locale.value === 'en')

const tooltipText = computed(() => {
  return isEnglish.value ? t('toolbar_switch_to_chinese') : t('toolbar_switch_to_english')
})

function handleToggle(): void {
  setLocale(isEnglish.value ? 'zh' : 'en')
}
</script>

<template>
  <button
    class="toggle-button"
    :title="tooltipText"
    @click="handleToggle"
  >
    <span class="locale-text">{{ isEnglish ? 'EN' : '中' }}</span>
  </button>
</template>

<style scoped>
.toggle-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background-color: var(--color-background-secondary);
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.2s ease;
}

.toggle-button:hover {
  background-color: var(--color-background-tertiary);
  border-color: var(--color-border-light);
}

.toggle-button:active {
  transform: scale(0.95);
}

.locale-text {
  font-size: 14px;
  font-weight: bold;
}
</style>
