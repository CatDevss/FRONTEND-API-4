import { ref, watch } from 'vue'
import axios from 'axios'
import { sessionUser, setSessionUser, roles, type Role } from './session'
import { apiError, type IngestionUser } from '@/services/contracts'

// Development preference only: store an ID, then re-read its current role from the API.
// No password, token or serialized permission matrix is persisted.
const key = 'georural.development-user-id'
export const previewUsers = ref<(IngestionUser & { label: string })[]>([])
export const previewLoading = ref(false)
export const previewError = ref('')
let loaded = false
let pending: Promise<void> | null = null

function savedId(): number | null {
  try {
    const id = Number(sessionStorage.getItem(key))
    return Number.isInteger(id) && id > 0 ? id : null
  } catch {
    return null
  }
}
function remember(id: number | null) {
  try {
    if (id === null) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, String(id))
  } catch {
    // Restricted storage must not prevent using the in-memory preview.
  }
}
watch(
  sessionUser,
  (user) => {
    if (!user && import.meta.env.DEV) remember(null)
  },
  { flush: 'sync' },
)

export async function loadPreviewUsers(force = false) {
  if (!import.meta.env.DEV) return
  if (pending) return pending
  if (loaded && !force) return
  previewLoading.value = true
  previewError.value = ''
  pending = (async () => {
    try {
      const { data } = await axios.get<IngestionUser[]>('/usuarios')
      previewUsers.value = data
        .filter(
          (u) =>
            Number.isInteger(u.id) &&
            u.id > 0 &&
            u.userStatus === 1 &&
            roles.includes(u.userType as Role),
        )
        .map((u) => ({ ...u, label: `${u.name} — ${u.userType}` }))
        .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR') || a.id - b.id)
      loaded = true
      const id = savedId()
      if (id !== null) {
        const user = previewUsers.value.find((u) => u.id === id)
        if (user) setSessionUser(user)
        else {
          remember(null)
          setSessionUser(null)
        }
      }
    } catch (e) {
      previewError.value = apiError(e, 'Não foi possível carregar os cadastros para prévia.')
      // Keep the saved ID so a transient API outage can be retried.
    } finally {
      previewLoading.value = false
      pending = null
    }
  })()
  return pending
}

export async function restoreDevelopmentSession() {
  if (import.meta.env.DEV && !sessionUser.value && savedId() !== null) await loadPreviewUsers()
}
export function selectPreviewUser(id: number | null) {
  if (!import.meta.env.DEV) return
  const user = previewUsers.value.find((u) => u.id === id) ?? null
  remember(user?.id ?? null)
  setSessionUser(user)
}
