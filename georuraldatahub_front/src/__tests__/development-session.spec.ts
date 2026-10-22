import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'

vi.mock('axios', () => ({ default: { get: vi.fn(), isAxiosError: () => true } }))
const gestor = { id: 7, name: 'Gestora', userType: 'GESTOR', userStatus: 1 }
const operator = { id: 8, name: 'Operador', userType: 'OPERADOR', userStatus: 1 }
const key = 'georural.development-user-id'
beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  sessionStorage.clear()
  vi.stubEnv('DEV', true)
  vi.mocked(axios.get).mockResolvedValue({ data: [gestor, operator] })
})
afterEach(() => {
  vi.unstubAllEnvs()
  sessionStorage.clear()
})

describe('development permission preview across navigation and reloads', () => {
  it('restores before the initial route guard and survives module reloads without saving a role', async () => {
    sessionStorage.setItem(key, '7')
    const { default: router } = await import('@/router')
    const session = await import('@/access/session')
    await router.push('/dictionaries?source=2')
    expect(router.currentRoute.value.fullPath).toBe('/dictionaries?source=2')
    expect(session.sessionUser.value?.userType).toBe('GESTOR')
    await router.push('/sources')
    window.dispatchEvent(new Event('focus'))
    document.dispatchEvent(new Event('visibilitychange'))
    expect(session.sessionUser.value?.id).toBe(7)
    expect(axios.get).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(key)).toBe('7')
    expect(sessionStorage.length).toBe(1)

    // Re-evaluate the JS modules, as on a full page reload.
    vi.resetModules()
    const { default: reloadedRouter } = await import('@/router')
    const reloadedSession = await import('@/access/session')
    await reloadedRouter.push('/dictionaries?source=2')
    expect(reloadedRouter.currentRoute.value.path).toBe('/dictionaries')
    expect(reloadedSession.sessionUser.value?.userType).toBe('GESTOR')
    expect(axios.get).toHaveBeenCalledTimes(2)
  })
  it('uses the current API role, never the previous permissions of the saved ID', async () => {
    sessionStorage.setItem(key, '7')
    vi.mocked(axios.get).mockResolvedValue({ data: [{ ...gestor, userType: 'AUDITOR' }] })
    const preview = await import('@/access/developmentSession')
    const session = await import('@/access/session')
    await preview.restoreDevelopmentSession()
    expect(session.sessionUser.value?.userType).toBe('AUDITOR')
    expect(session.can('dictionaries.manage')).toBe(false)
  })
  it.each([
    { ...gestor, userStatus: 0 },
    { ...gestor, userType: 'INVALID' },
    { ...gestor, id: 99 },
  ])('clears a removed, inactive or invalid saved user: %j', async (user) => {
    sessionStorage.setItem(key, '7')
    vi.mocked(axios.get).mockResolvedValue({ data: [user] })
    const preview = await import('@/access/developmentSession')
    const session = await import('@/access/session')
    await preview.restoreDevelopmentSession()
    expect(session.sessionUser.value).toBeNull()
    expect(sessionStorage.getItem(key)).toBeNull()
  })
  it('does not clear identity on same-user reselection and clears the preference on logout', async () => {
    const preview = await import('@/access/developmentSession')
    const session = await import('@/access/session')
    await preview.loadPreviewUsers()
    preview.selectPreviewUser(7)
    const initial = session.sessionUser.value
    preview.selectPreviewUser(7)
    expect(session.sessionUser.value).toBe(initial)
    session.setSessionUser(null)
    expect(sessionStorage.getItem(key)).toBeNull()
    await preview.restoreDevelopmentSession()
    expect(session.sessionUser.value).toBeNull()
  })
  it('keeps a preference through a temporary API failure and restores after retry', async () => {
    sessionStorage.setItem(key, '7')
    vi.mocked(axios.get).mockRejectedValueOnce({
      response: { data: 'API temporariamente indisponível' },
    })
    const preview = await import('@/access/developmentSession')
    const session = await import('@/access/session')
    await preview.restoreDevelopmentSession()
    expect(preview.previewError.value).toBe('API temporariamente indisponível')
    expect(session.sessionUser.value).toBeNull()
    expect(sessionStorage.getItem(key)).toBe('7')
    await preview.loadPreviewUsers(true)
    expect(session.sessionUser.value?.id).toBe(7)
    expect(preview.previewError.value).toBe('')
  })
  it('does not restore or store preview context in production', async () => {
    vi.stubEnv('DEV', false)
    sessionStorage.setItem(key, '7')
    const preview = await import('@/access/developmentSession')
    const session = await import('@/access/session')
    await preview.restoreDevelopmentSession()
    await preview.loadPreviewUsers()
    preview.selectPreviewUser(7)
    expect(session.sessionUser.value).toBeNull()
    expect(axios.get).not.toHaveBeenCalled()
  })
  it('can navigate without restoring a preview when storage is unavailable', async () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage blocked')
    })
    const preview = await import('@/access/developmentSession')
    await preview.restoreDevelopmentSession()
    await preview.loadPreviewUsers()
    expect(() => preview.selectPreviewUser(7)).not.toThrow()
    spy.mockRestore()
  })
  it('keeps the current allowed page when the preview selector is used again', async () => {
    const { mount, flushPromises } = await import('@vue/test-utils')
    const { defineComponent } = await import('vue')
    const { createMemoryHistory, createRouter } = await import('vue-router')
    const { default: Panel } = await import('@/components/DevelopmentSession.vue')
    const preview = await import('@/access/developmentSession')
    const session = await import('@/access/session')
    await preview.loadPreviewUsers()
    preview.selectPreviewUser(7)
    const Empty = defineComponent({ template: '<div />' })
    const Select = defineComponent({
      props: ['modelValue', 'items'],
      emits: ['update:modelValue'],
      template: '<select />',
    })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/dictionaries', component: Empty, meta: { permission: 'dictionaries.read' } },
        { path: '/home', component: Empty },
        { path: '/access-required', component: Empty },
      ],
    })
    await router.push('/dictionaries?source=2')
    const wrapper = mount(Panel, {
      global: {
        plugins: [router],
        stubs: { VAlert: { template: '<div><slot /></div>' }, VSelect: Select, VBtn: true },
      },
    })
    await flushPromises()
    const initial = session.sessionUser.value
    wrapper.findComponent(Select).vm.$emit('update:modelValue', 7)
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/dictionaries?source=2')
    expect(session.sessionUser.value).toBe(initial)
    expect(axios.get).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})
