import { computed, readonly, ref } from 'vue'
import type { IngestionUser } from '@/services/contracts'

export const roles = ['ADMIN', 'GESTOR', 'OPERADOR', 'ANALISTA', 'AUDITOR'] as const
export type Role = (typeof roles)[number]
export type SessionUser = Omit<IngestionUser, 'userType'> & { userType: Role }
const user = ref<SessionUser | null>(null)

// Integration boundary for the login team. This module neither authenticates nor persists credentials.
export function setSessionUser(value: IngestionUser | null) {
  const next =
    value &&
    Number.isInteger(value.id) &&
    value.id > 0 &&
    value.userStatus === 1 &&
    roles.includes(value.userType as Role)
      ? {
          id: value.id,
          name: value.name,
          userStatus: value.userStatus,
          userType: value.userType as Role,
        }
      : null
  // Re-selecting the same preview must not remount pages or cancel active work.
  if (JSON.stringify(user.value) !== JSON.stringify(next)) user.value = next
}
export const sessionUser = readonly(user)
export const currentUserId = computed(() => user.value?.id ?? null)
const readers: readonly Role[] = ['ADMIN', 'GESTOR', 'OPERADOR', 'ANALISTA', 'AUDITOR']
export const permissionRoles = {
  'files.read': readers,
  'sources.read': readers,
  'sources.create': ['GESTOR'],
  'dictionaries.read': ['GESTOR', 'OPERADOR', 'ANALISTA', 'AUDITOR'],
  'dictionaries.manage': ['GESTOR'],
  'datasets.read': ['GESTOR', 'OPERADOR', 'ANALISTA', 'AUDITOR'],
  'datasets.manage': ['OPERADOR'],
  'map.read': ['GESTOR', 'OPERADOR', 'ANALISTA', 'AUDITOR'],
  'ingestion.run': ['OPERADOR'],
} as const satisfies Record<string, readonly Role[]>
export type Permission = keyof typeof permissionRoles
export function roleCan(role: Role | undefined, permission: Permission): boolean {
  return !!role && (permissionRoles[permission] as readonly Role[]).includes(role)
}
export function can(permission: Permission): boolean {
  return roleCan(user.value?.userType, permission)
}
export const navigation = [
  { title: 'Workspace geográfico', icon: 'mdi-map-outline', to: '/home', permission: 'map.read' },
  {
    title: 'Nova ingestão',
    icon: 'mdi-plus-circle-outline',
    to: '/new-load',
    permission: 'ingestion.run',
  },
  {
    title: 'Arquivos por fonte',
    icon: 'mdi-file-check-outline',
    to: '/file-uploads',
    permission: 'files.read',
  },
  { title: 'Conjuntos', icon: 'mdi-folder-outline', to: '/datasets', permission: 'datasets.read' },
  { title: 'Fontes', icon: 'mdi-database-outline', to: '/sources', permission: 'sources.read' },
  {
    title: 'Dicionários',
    icon: 'mdi-book-open-outline',
    to: '/dictionaries',
    permission: 'dictionaries.read',
  },
] as const
export function allowedNavigation() {
  return navigation.filter((item) => can(item.permission))
}
