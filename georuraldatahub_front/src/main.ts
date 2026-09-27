// import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import vuetify from './plugins/vuetify'
import axios from 'axios'
import App from './App.vue'
import router from './router'
import './assets/glassmorphism.css'

axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL
console.log('API base URL:', axios.defaults.baseURL)
const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(vuetify)

app.mount('#app')