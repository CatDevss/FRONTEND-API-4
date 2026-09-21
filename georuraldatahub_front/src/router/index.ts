import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import Home from '../views/HomeView.vue'
import NewLoad from '../views/NewLoadView.vue' 
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/',
      name: 'login',
      component: LoginView },
    { path: '/home',
      name: 'home',
      component: Home },
    { path: '/new-load',
      name: 'new-load',
      component: NewLoad},
  ],
})

export default router