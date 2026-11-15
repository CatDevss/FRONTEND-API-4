import { onActivated } from 'vue'
import type { AxiosResponse } from 'axios'

let revision = 0

// Reads, including the diagnostic POST, do not invalidate already loaded pages.
export function trackDataMutation(response: AxiosResponse): AxiosResponse {
  const method = response.config.method?.toLowerCase()
  const path = (response.config.url ?? '').split('?')[0] ?? ''
  if (
    response.status >= 200 &&
    response.status < 300 &&
    method &&
    ['post', 'put', 'patch', 'delete'].includes(method) &&
    !path.endsWith('/verificacao') &&
    !path.startsWith('/ambiental/exportacoes/') &&
    !/\/indicadores\/(icv|irl|iapp|isap|iae|idesmat|ifc)(\/mapa)?$/.test(path)
  )
    revision++
  return response
}

/** Retain page state on ordinary navigation; refresh data on return after a write. */
export function usePageRefresh(refresh: () => unknown) {
  let seen = revision
  let firstActivation = true
  onActivated(() => {
    if (firstActivation) {
      firstActivation = false
      return
    }
    if (seen === revision) return
    seen = revision
    void refresh()
  })
}
