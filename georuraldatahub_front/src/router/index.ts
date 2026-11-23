import { createRouter, createWebHistory } from 'vue-router'
import { allowedNavigation, can, type Permission } from '@/access/session'
import { isAuthenticated, keycloakEnabled } from '@/access/keycloak'

declare module 'vue-router' {
  interface RouteMeta {
    permission?: Permission
  }
}
export const routes = [
  { path: '/', name: 'login', component: () => import('../views/LoginView.vue') },
  {
    path: '/access-required',
    name: 'access-required',
    component: () => import('../views/AccessRequiredView.vue'),
  },
  {
    path: '/home',
    name: 'home',
    component: () => import('../views/HomeView.vue'),
    meta: { permission: 'map.read' as const },
  },
  {
    path: '/new-load',
    name: 'new-load',
    component: () => import('../views/NewLoadView.vue'),
    meta: { permission: 'ingestion.run' as const },
  },
  {
    path: '/file-uploads',
    name: 'file-uploads',
    component: () => import('../views/FileUploadsView.vue'),
    meta: { permission: 'files.read' as const },
  },
  {
    path: '/dictionaries',
    name: 'dictionaries',
    component: () => import('../views/DictionariesView.vue'),
    meta: { permission: 'dictionaries.read' as const },
  },
  {
    path: '/quarantine',
    name: 'quarantine',
    component: () => import('../views/QuarantineView.vue'),
    meta: { permission: 'quarantine.read' as const },
  },
  {
    path: '/sources',
    name: 'sources',
    component: () => import('../views/SourcesView.vue'),
    meta: { permission: 'sources.read' as const },
  },
  {
    path: '/datasets',
    name: 'datasets',
    component: () => import('../views/DatasetsView.vue'),
    meta: { permission: 'datasets.read' as const },
  },
]
export function checkRouteAccess(permission?: Permission) {
  return !permission || can(permission) ? true : { name: 'access-required' }
}
const router = createRouter({ history: createWebHistory(import.meta.env.BASE_URL), routes })
router.beforeEach(async (to) => {
  if (keycloakEnabled) {
    // Sem login, só a tela de login; logado, a tela de login leva à primeira página permitida.
    if (!isAuthenticated()) return to.name === 'login' ? true : { name: 'login' }
    if (to.name === 'login') return allowedNavigation()[0]?.to ?? { name: 'access-required' }
    return checkRouteAccess(to.meta.permission)
  }
  if (import.meta.env.DEV) {
    const { restoreDevelopmentSession } = await import('@/access/developmentSession')
    await restoreDevelopmentSession()
  }
  return checkRouteAccess(to.meta.permission)
})
export default router
