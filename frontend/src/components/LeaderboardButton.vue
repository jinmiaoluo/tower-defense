<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/i18n'

const { t, locale } = useI18n()

const tooltipText = computed(() => {
  locale.value
  return t('toolbar_view_leaderboard')
})

const emit = defineEmits<{
  click: []
}>()

function handleClick(): void {
  emit('click')
}
</script>

<template>
  <button
    class="toggle-button"
    :title="tooltipText"
    @click="handleClick"
  >
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M2 20h20v2H2v-2zm2-8h2v7H4v-7zm5-4h2v11H9V8zm5-4h2v15h-2V4zm5 6h2v9h-2v-9z"/>
    </svg>
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
</style>
