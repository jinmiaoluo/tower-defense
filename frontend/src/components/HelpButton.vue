<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/i18n'

const { t, locale } = useI18n()

const tooltipText = computed(() => {
  locale.value
  return t('toolbar_view_guide')
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
      <path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"/>
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

@media (max-width: 480px) {
  .toggle-button {
    width: 44px;
    height: 44px;
  }

  .toggle-button svg {
    width: 20px;
    height: 20px;
  }
}
</style>
