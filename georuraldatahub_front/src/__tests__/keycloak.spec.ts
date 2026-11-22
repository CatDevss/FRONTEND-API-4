import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'

// Keycloak simulado: cada teste define se o usuário já está logado.
const kc = vi.hoisted(() => ({
  authenticated: false,
  token: 'token-1',
  init: vi.fn<(options: unknown) => Promise<boolean>>(),
  login: vi.fn<(options?: unknown) => Promise<void>>(),
  logout: vi.fn<(options?: unknown) => Promise<void>>(),
  updateToken: vi.fn<(minValidity: number) => Promise<boolean>>(),
  onTokenExpired: undefined as undefined | (() => void),
}))
const KeycloakMock = vi.hoisted(() => vi.fn<() => typeof kc>())
vi.mock('keycloak-js', () => ({ default: KeycloakMock }))

const interceptors = vi.hoisted(() => ({
  request: [] as ((c: { headers: Record<string, string> }) => unknown)[],
}))
vi.mock('axios', () => ({
  default: {
    get: vi.fn<(url: string) => Promise<unknown>>(),
    isAxiosError: (e: unknown) => !!(e as { isAxiosError?: boolean })?.isAxiosError,
    interceptors: {
      request: {
        use: (fn: (c: { headers: Record<string, string> }) => unknown) =>
          interceptors.request.push(fn),
      },
      response: { use: vi.fn<(ok?: unknown, fail?: unknown) => number>() },
    },
  },
}))

const me = {
  id: 3,
  username: 'gestor',
  name: 'Gustavo Gestor',
  email: 'gestor@georural.local',
  userType: 'GESTOR',
  roles: ['GESTOR'],
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  interceptors.request.length = 0
  vi.stubEnv('VITE_KEYCLOAK_ENABLED', 'true')
  kc.authenticated = false
  kc.token = 'token-1'
  KeycloakMock.mockImplementation(function () {
    return kc
  })
  kc.init.mockImplementation(async () => kc.authenticated)
  kc.updateToken.mockResolvedValue(false)
  kc.login.mockResolvedValue(undefined)
  kc.logout.mockResolvedValue(undefined)
  vi.mocked(axios.get).mockResolvedValue({ data: me })
})
afterEach(() => vi.unstubAllEnvs())

describe('login com Keycloak', () => {
  it('logado: carrega /usuarios/me e define o cargo da sessão', async () => {
    kc.authenticated = true
    const auth = await import('@/access/keycloak')
    const session = await import('@/access/session')

    await auth.initAuth()

    expect(kc.init).toHaveBeenCalledWith(expect.objectContaining({ pkceMethod: 'S256' }))
    expect(axios.get).toHaveBeenCalledWith('/usuarios/me')
    expect(session.sessionUser.value).toEqual({
      id: 3,
      name: 'Gustavo Gestor',
      userType: 'GESTOR',
      userStatus: 1,
    })
    expect(session.currentUserId.value).toBe(3)
    expect(auth.authReady.value).toBe(true)
  })

  it('envia o token no header Authorization, renovando antes', async () => {
    kc.authenticated = true
    const auth = await import('@/access/keycloak')
    await auth.initAuth()

    const config = (await interceptors.request[0]!({ headers: {} })) as {
      headers: Record<string, string>
    }

    expect(kc.updateToken).toHaveBeenCalledWith(30)
    expect(config.headers.Authorization).toBe('Bearer token-1')
  })

  it('sem login: não chama a API nem define sessão', async () => {
    const auth = await import('@/access/keycloak')
    const session = await import('@/access/session')

    await auth.initAuth()

    expect(axios.get).not.toHaveBeenCalled()
    expect(session.sessionUser.value).toBeNull()
    const config = (await interceptors.request[0]!({ headers: {} })) as {
      headers: Record<string, string>
    }
    expect(config.headers.Authorization).toBeUndefined()
  })

  it('usuário sem cargo fica sem sessão e recebe aviso', async () => {
    kc.authenticated = true
    vi.mocked(axios.get).mockResolvedValue({ data: { ...me, userType: null, roles: [] } })
    const auth = await import('@/access/keycloak')
    const session = await import('@/access/session')

    await auth.initAuth()

    expect(session.sessionUser.value).toBeNull()
    expect(auth.authError.value).toContain('não possui um cargo')
  })

  it('rotas: sem login vai para o login; logado sai do login para a primeira página permitida', async () => {
    const auth = await import('@/access/keycloak')
    await auth.initAuth()
    const { default: router } = await import('@/router')

    await router.push('/sources')
    expect(router.currentRoute.value.name).toBe('login')

    kc.authenticated = true
    await auth.loadCurrentUser()
    await router.push('/sources')
    expect(router.currentRoute.value.path).toBe('/sources')
    await router.push('/')
    expect(router.currentRoute.value.path).toBe('/home')

    // GESTOR não tem 'ingestion.run'
    await router.push('/new-load')
    expect(router.currentRoute.value.name).toBe('access-required')
  })

  it('depois do login volta para a raiz, que leva à primeira página do cargo', async () => {
    const auth = await import('@/access/keycloak')
    await auth.initAuth()

    await auth.login()

    expect(kc.login).toHaveBeenCalledWith({ redirectUri: window.location.origin + '/' })
  })

  it('ADMIN sai do login direto para Arquivos, sem passar pelo Workspace', async () => {
    kc.authenticated = true
    vi.mocked(axios.get).mockResolvedValue({ data: { ...me, userType: 'ADMIN', roles: ['ADMIN'] } })
    const auth = await import('@/access/keycloak')
    await auth.initAuth()
    const { default: router } = await import('@/router')

    await router.push('/')

    expect(router.currentRoute.value.path).toBe('/file-uploads')
  })

  it('sair limpa a sessão e encerra no Keycloak', async () => {
    kc.authenticated = true
    const auth = await import('@/access/keycloak')
    const session = await import('@/access/session')
    await auth.initAuth()

    await auth.logout()

    expect(session.sessionUser.value).toBeNull()
    expect(kc.logout).toHaveBeenCalledWith({ redirectUri: window.location.origin + '/' })
  })

  it('Keycloak que não responde não deixa a página em branco: libera a tela com o erro', async () => {
    vi.useFakeTimers()
    try {
      kc.init.mockImplementation(() => new Promise<boolean>(() => {}))
      vi.stubEnv('VITE_KEYCLOAK_URL', 'http://localhost:8081')
      vi.stubEnv('VITE_KEYCLOAK_REALM', 'georural')
      const auth = await import('@/access/keycloak')
      vi.spyOn(console, 'error').mockImplementation(() => {})

      const started = auth.initAuth()
      await vi.advanceTimersByTimeAsync(auth.AUTH_TIMEOUT_MS)
      await started

      expect(auth.authReady.value).toBe(true)
      expect(auth.authError.value).toContain('http://localhost:8081')
      expect(auth.authError.value).toContain('georural')
    } finally {
      vi.useRealTimers()
    }
  })

  it('VITE_KEYCLOAK_ENABLED=false não usa o Keycloak', async () => {
    vi.stubEnv('VITE_KEYCLOAK_ENABLED', 'false')
    const auth = await import('@/access/keycloak')

    await auth.initAuth()

    expect(KeycloakMock).not.toHaveBeenCalled()
    expect(interceptors.request).toHaveLength(0)
    expect(auth.authReady.value).toBe(true)
  })
})
