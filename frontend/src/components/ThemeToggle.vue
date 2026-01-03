<script setup lang="ts">
import { computed } from 'vue'
import { useThemeStore } from '@/stores'
import { useI18n } from '@/i18n'

const themeStore = useThemeStore()
const { t, locale } = useI18n()

const isDark = computed(() => themeStore.isDark)

const tooltipText = computed(() => {
  locale.value
  return isDark.value ? t('toolbar_switch_to_light') : t('toolbar_switch_to_dark')
})

function handleToggle(): void {
  themeStore.toggleTheme()
}
</script>

<template>
  <button
    class="toggle-button"
    :class="{ dark: isDark }"
    :title="tooltipText"
    @click="handleToggle"
  >
    <span class="icon sun-icon">
      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
        <path d="M12 7a5 5 0 100 10 5 5 0 000-10zm0-5a1 1 0 011 1v1a1 1 0 01-2 0V3a1 1 0 011-1zm0 18a1 1 0 011 1v1a1 1 0 01-2 0v-1a1 1 0 011-1zm9-9a1 1 0 010 2h-1a1 1 0 010-2h1zM4 12a1 1 0 010 2H3a1 1 0 010-2h1zm15.071-6.071a1 1 0 010 1.414l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 0zM7.05 16.95a1 1 0 010 1.414l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 0zm11.9 0a1 1 0 011.414 0l.707.707a1 1 0 01-1.414 1.414l-.707-.707a1 1 0 010-1.414zM7.05 7.05a1 1 0 011.414 0l-.707-.707a1 1 0 00-1.414 1.414l.707.707a1 1 0 010-1.414z"/>
      </svg>
    </span>
    <span class="icon moon-icon">
      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
        <path d="M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 01-4.4 2.26 5.403 5.403 0 01-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/>
      </svg>
    </span>
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

.icon {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s ease;
}

.sun-icon {
  color: var(--color-warning);
}

.moon-icon {
  color: var(--color-info);
  display: none;
}

.toggle-button.dark .sun-icon {
  display: none;
}

.toggle-button.dark .moon-icon {
  display: flex;
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
