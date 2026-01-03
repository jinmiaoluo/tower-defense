import App from './App.vue'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { useThemeStore } from './stores'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

const themeStore = useThemeStore()
themeStore.initTheme()

app.mount('#app')
