import { afterEach, describe, expect, it } from 'vitest'
import {
  roles,
  roleCan,
  can,
  setSessionUser,
  currentUserId,
  allowedNavigation,
  permissionRoles,
  type Role,
} from '@/access/session'
import { checkRouteAccess } from '@/router'
afterEach(() => setSessionUser(null))
const assume = (userType: Role) =>
  setSessionUser({ id: 17, name: 'Usuário de teste', userType, userStatus: 1 })
describe('role permissions and login integration boundary', () => {
  it.each(roles)('%s can only execute ingestion when it is OPERADOR', (role) => {
    assume(role)
    expect(can('ingestion.run')).toBe(role === 'OPERADOR')
    expect(can('treatment.run')).toBe(role === 'OPERADOR')
    expect(checkRouteAccess('ingestion.run')).toEqual(
      role === 'OPERADOR' ? true : { name: 'access-required' },
    )
    expect(allowedNavigation().some((n) => n.to === '/new-load')).toBe(role === 'OPERADOR')
  })
  it.each(roles)('%s only manages dictionaries and official sources when it is GESTOR', (role) => {
    expect(roleCan(role, 'sources.create')).toBe(role === 'GESTOR')
    expect(roleCan(role, 'dictionaries.manage')).toBe(role === 'GESTOR')
  })
  it.each(['ANALISTA', 'AUDITOR'] as const)('%s has read-only data access', (role) => {
    assume(role)
    expect(can('files.read')).toBe(true)
    expect(can('datasets.read')).toBe(true)
    expect(can('map.read')).toBe(true)
    expect(can('datasets.manage')).toBe(false)
    expect(can('dictionaries.manage')).toBe(false)
  })
  it('does not provide an implicit user or let an invalid/inactive role through', () => {
    setSessionUser(null)
    expect(currentUserId.value).toBeNull()
    expect(allowedNavigation()).toEqual([])
    expect(checkRouteAccess('files.read')).toEqual({ name: 'access-required' })
    setSessionUser({ id: 1, name: 'Inativo', userType: 'ADMIN', userStatus: 0 })
    expect(currentUserId.value).toBeNull()
    setSessionUser({ id: 1, name: 'Inválido', userType: 'UNKNOWN', userStatus: 1 })
    expect(currentUserId.value).toBeNull()
  })
  it('never gives ADMIN business write or approval rights through inheritance', () => {
    assume('ADMIN')
    expect(can('datasets.manage')).toBe(false)
    expect(can('dictionaries.manage')).toBe(false)
    expect(can('ingestion.run')).toBe(false)
    expect(Object.keys(permissionRoles).some((k) => k.includes('approv'))).toBe(false)
  })
})
