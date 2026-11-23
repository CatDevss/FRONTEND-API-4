import Keycloak from 'keycloak-js'
import axios, { type InternalAxiosRequestConfig } from 'axios'
import { ref } from 'vue'
import { setSessionUser } from './session'
import { apiError } from '@/services/contracts'

/**
 * Login com Keycloak.
 *
 * O portal redireciona para a tela de login do Keycloak, recebe o token (JWT)
 * e o envia no header Authorization de todas as chamadas à API. Depois do
 * login, GET /usuarios/me devolve o usuário da tabela `usuario` e o perfil,
 * que alimentam o `setSessionUser` (menu, rotas e permissões).
 *
 * Com VITE_KEYCLOAK_ENABLED=false nada disso é usado e a prévia de cargo de
 * desenvolvimento continua funcionando (backend com KEYCLOAK_ENABLED=false).
 */
export const keycloakEnabled = import.meta.env.VITE_KEYCLOAK_ENABLED !== 'false'

export const authReady = ref(!keycloakEnabled)
export const authError = ref('')

/** Perfil retornado por GET /usuarios/me. */
export interface CurrentUser {
  id: number
  username: string
  name: string
  email: string
  userType: string | null
  roles: string[]
}

let keycloak: Keycloak | null = null

/** Renova o token quando faltar menos que isso (segundos). */
const MIN_VALIDITY = 30

export function isAuthenticated(): boolean {
  return !!keycloak?.authenticated
}

/** Inicia o Keycloak sem forçar o login; a tela de login chama `login()`. */
export async function initAuth(): Promise<void> {
  if (!keycloakEnabled) return
  keycloak = new Keycloak({
    url: import.meta.env.VITE_KEYCLOAK_URL,
    realm: import.meta.env.VITE_KEYCLOAK_REALM,
    clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
  })
  keycloak.onTokenExpired = () => {
    void keycloak?.updateToken(MIN_VALIDITY).catch(() => login())
  }
  axios.interceptors.request.use(addToken)
  axios.interceptors.response.use(undefined, onUnauthorized)
  try {
    // O keycloak-js não limita o tempo da checagem silenciosa: sem este limite, um Keycloak que não
    // responde como esperado (realm ou client diferentes, endereço de retorno recusado) deixaria a
    // página em branco para sempre.
    const authenticated = await withTimeout(
      keycloak.init({
        onLoad: 'check-sso',
        // Checa a sessão em um iframe invisível, sem redirecionar a página.
        silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
        pkceMethod: 'S256',
        checkLoginIframe: false,
      }),
      AUTH_TIMEOUT_MS,
    )
    if (authenticated) await loadCurrentUser()
  } catch (e) {
    console.error('[login] Falha ao iniciar o Keycloak', e)
    authError.value =
      `Não foi possível conectar ao login (Keycloak em ${import.meta.env.VITE_KEYCLOAK_URL}, ` +
      `realm ${import.meta.env.VITE_KEYCLOAK_REALM}). Confira se ele está rodando e se o realm existe.`
  } finally {
    authReady.value = true
  }
}

/** Tempo máximo para o Keycloak responder antes de o portal abrir mesmo assim. */
export const AUTH_TIMEOUT_MS = 15_000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Keycloak não respondeu em ${ms} ms`)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

/** Busca o usuário logado no backend e atualiza a sessão do portal. */
export async function loadCurrentUser(): Promise<void> {
  try {
    const { data } = await axios.get<CurrentUser>('/usuarios/me')
    setSessionUser(
      data.userType
        ? { id: data.id, name: data.name, userType: data.userType, userStatus: 1 }
        : null,
    )
    authError.value = data.userType
      ? ''
      : 'Seu usuário não possui um cargo no GeoRural DataHub. Procure o administrador.'
  } catch (e) {
    setSessionUser(null)
    authError.value = apiError(e, 'Não foi possível carregar o seu usuário.')
  }
}

// Volta para '/': o roteador leva cada cargo à primeira página que ele pode abrir.
export function login(redirectPath = '/'): Promise<void> {
  if (!keycloak) return Promise.resolve()
  return keycloak.login({ redirectUri: window.location.origin + redirectPath })
}

export function logout(): Promise<void> {
  setSessionUser(null)
  if (!keycloak) return Promise.resolve()
  return keycloak.logout({ redirectUri: window.location.origin + '/' })
}

async function addToken(config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> {
  if (keycloak?.authenticated) {
    try {
      await keycloak.updateToken(MIN_VALIDITY)
    } catch {
      await login(window.location.pathname)
      return Promise.reject(new Error('Sessão expirada. Faça login novamente.'))
    }
    config.headers.Authorization = `Bearer ${keycloak.token}`
  }
  return config
}

function onUnauthorized(error: unknown) {
  if (axios.isAxiosError(error) && error.response?.status === 401 && keycloak?.authenticated)
    void login(window.location.pathname)
  return Promise.reject(error)
}
