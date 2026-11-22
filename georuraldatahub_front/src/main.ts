import { createApp } from 'vue'
import { createPinia } from 'pinia'
import vuetify from './plugins/vuetify'
import axios from 'axios'
import { trackDataMutation } from '@/composables/pageData'
import { initAuth } from '@/access/keycloak'
import App from './App.vue'
import router from './router'
import './assets/glassmorphism.css'

axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL
axios.interceptors.response.use(trackDataMutation)
const app = createApp(App)

app.use(createPinia())
app.use(vuetify)

// Conecta ao Keycloak (e carrega o usuário logado) antes de abrir as páginas.
void initAuth().finally(() => {
  app.use(router)
  app.mount('#app')
})
