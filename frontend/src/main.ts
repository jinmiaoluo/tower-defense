import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import { getTranslator } from './i18n'
import { useThemeStore } from './stores'
import { AppEventBus } from './utils/EventEmitter'

function updateRotateScreenText() {
  const el = document.querySelector('#rotate-screen p')
  if (el) {
    const t = getTranslator()
    el.textContent = t('rotate_screen')
  }
}

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

const themeStore = useThemeStore()
themeStore.initTheme()

updateRotateScreenText()
AppEventBus.on('locale-changed', updateRotateScreenText)

app.mount('#app')
