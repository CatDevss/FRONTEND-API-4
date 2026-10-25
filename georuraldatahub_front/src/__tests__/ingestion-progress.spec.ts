import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import axios, { type AxiosProgressEvent } from 'axios'
import IngestionProgressPopup from '@/components/IngestionProgressPopup.vue'
import CollectionForm from '@/components/CollectionForm.vue'
import { setSessionUser } from '@/access/session'
import {
  startUpload,
  isUploadInProgress,
  isCollectionInProgress,
  cancelUpload,
  uploadResults,
} from '@/composables/uploadLock'
import {
  beginIngestionProgress,
  finishIngestionProgress,
  updateIngestionProgress,
  clearIngestionProgress,
  ingestionProgress,
} from '@/composables/ingestionProgress'
import type { IngestedFile, CollectionMetadata, ValidationReport } from '@/services/contracts'

vi.mock('axios', () => ({
  default: { post: vi.fn(), isAxiosError: () => true, isCancel: () => false },
}))
const cleanups: (() => void)[] = []
const report = (status: ValidationReport['status']): ValidationReport => ({
  status,
  validRecords: status === 'REJEITADO' ? 0 : 1,
  rejectedRecords: status === 'VALIDO' ? 0 : 1,
  dictionaryId: 12,
  dictionaryVersion: 3,
  records: [],
})
function file(status: ValidationReport['status']): IngestedFile {
  return {
    id: 41,
    name: 'parana.geojson',
    formatFile: 'geojson',
    size: 10,
    hash: null,
    location: null,
    ingestionId: 5,
    receivedDate: '2026-10-25T10:00:00',
    userId: 7,
    validation: report(status),
  }
}
const collection: CollectionMetadata = {
  product: 'IBGE_MUNICIPIOS',
  competence: '2024',
  format: 'geojson',
  originFormat: 'geojson',
  scope: 'Paraná',
  collectedAt: '2026-10-25T10:00:00',
  documentation: '',
  limitations: [],
  originals: [],
}
function deferred<T>() {
  let resolve!: (data: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((r, j) => {
    resolve = r
    reject = j
  })
  return { promise, resolve, reject }
}
async function setup() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: ['/new-load', '/file-uploads', '/quarantine'].map((path) => ({
      path,
      component: defineComponent({ template: '<div />' }),
    })),
  })
  await router.push('/new-load')
  const vuetify = createVuetify({ components, directives, theme: { defaultTheme: 'dark' } })
  const global = { plugins: [router, vuetify] }
  const popup = mount(IngestionProgressPopup, { attachTo: document.body, global })
  cleanups.push(() => popup.unmount())
  const mountCollection = () => {
    const form = mount(CollectionForm, {
      attachTo: document.body,
      props: {
        connector: {
          id: 'IBGE_MUNICIPIOS',
          agency: 'IBGE',
          product: 'Municípios',
          access: 'AUTOMATICO',
          documentation: '',
          limitations: '',
        },
        sourceId: 2,
        sourceUrl: 'https://www.ibge.gov.br/',
        sourceName: 'IBGE',
        userId: 7,
        ready: true,
      },
      global,
    })
    cleanups.push(() => form.unmount())
    return form
  }
  await flushPromises()
  return { popup, router, mountCollection }
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  vi.stubGlobal('visualViewport', {
    width: 1280,
    height: 900,
    offsetTop: 0,
    offsetLeft: 0,
    addEventListener() {},
    removeEventListener() {},
  })
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }))
  setSessionUser({ id: 7, name: 'Operador', userType: 'OPERADOR', userStatus: 1 })
  isUploadInProgress.value = false
  isCollectionInProgress.value = false
  uploadResults.value = []
  clearIngestionProgress()
})
afterEach(async () => {
  cancelUpload()
  cleanups.splice(0).forEach((fn) => fn())
  await flushPromises()
  clearIngestionProgress()
  isUploadInProgress.value = false
  isCollectionInProgress.value = false
  setSessionUser(null)
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})
describe('global ingestion progress popup', () => {
  it('is absent while idle and displays real transfer events before waiting for server validation', async () => {
    const { router } = await setup()
    expect(document.querySelector('.ingestion-progress')).toBeNull()
    const slow = deferred<{ data: IngestedFile }>()
    vi.mocked(axios.post).mockReturnValue(slow.promise)
    const operation = startUpload(2, [new File(['data'], 'dados.csv')], 7, null, 'IBGE')
    await nextTick()
    expect(document.body.textContent).toContain('ENVIO MANUAL')
    expect(document.body.textContent).toContain('IBGE')
    const onProgress = vi.mocked(axios.post).mock.calls[0]![2]!.onUploadProgress!
    onProgress({ loaded: 25, total: 100 } as AxiosProgressEvent)
    await nextTick()
    expect(document.body.textContent).toContain('25%')
    expect(document.body.textContent).toContain('Transferindo arquivo')
    onProgress({ loaded: 100, total: 100 } as AxiosProgressEvent)
    await nextTick()
    expect(document.body.textContent).toContain('Validando e registrando')
    expect(document.body.textContent).not.toContain('100%')
    expect(document.body.textContent).not.toContain('Conteúdo integralmente válido')
    await router.push('/file-uploads')
    expect(document.body.textContent).toContain('Validando e registrando')
    slow.resolve({ data: file('PARCIAL') })
    await operation
    await flushPromises()
    expect(document.body.textContent).toContain('Resultado requer atenção')
    expect(document.body.textContent).toContain('PARCIAL')
    expect(document.querySelector('a[href="/quarantine?fileId=41"]')).not.toBeNull()
    expect(
      document.querySelector('button[aria-label="Fechar progresso da ingestão"]'),
    ).not.toBeNull()
  })
  it('can collapse a running operation without cancelling it and expands on completion', async () => {
    await setup()
    const id = beginIngestionProgress({
      kind: 'automatic',
      title: 'IBGE · Municípios',
      source: 'IBGE',
      fileCount: 1,
    })
    await nextTick()
    ;(
      document.querySelector(
        'button[aria-label="Recolher progresso da ingestão"]',
      ) as HTMLButtonElement
    ).click()
    await nextTick()
    expect(document.querySelector('.is-collapsed')).not.toBeNull()
    expect(ingestionProgress.value?.status).toBe('running')
    finishIngestionProgress(id, 'completed', 'VALIDO: 1 registro aprovado.')
    await nextTick()
    expect(document.querySelector('.is-collapsed')).toBeNull()
    expect(document.body.textContent).toContain('Conteúdo integralmente válido')
    ;(
      document.querySelector(
        'button[aria-label="Fechar progresso da ingestão"]',
      ) as HTMLButtonElement
    ).click()
    await nextTick()
    expect(ingestionProgress.value).toBeNull()
  })
  it('tracks automatic collection with an indeterminate bar and elapsed time, without inventing percentages', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    const { mountCollection } = await setup()
    const form = mountCollection()
    await form.find('input').setValue('2024')
    const slow = deferred<{ data: { file: IngestedFile; collection: CollectionMetadata } }>()
    vi.mocked(axios.post).mockReturnValue(slow.promise)
    await form
      .findAll('button')
      .find((b) => b.text().includes('Coletar e validar'))!
      .trigger('click')
    expect(document.body.textContent).toContain('COLETA AUTOMATIZADA')
    expect(document.body.textContent).toContain('Coleta e validação em andamento')
    expect(document.body.textContent).not.toContain('%')
    vi.advanceTimersByTime(5000)
    await nextTick()
    expect(document.querySelector('.ingestion-progress')?.textContent).toContain('00:05')
    expect(ingestionProgress.value?.percent).toBeNull()
    form.unmount()
    slow.resolve({ data: { file: file('REJEITADO'), collection } })
    await flushPromises()
    expect(document.querySelector('.ingestion-progress')?.textContent).toContain('REJEITADO')
    expect(document.body.textContent).not.toContain('Conteúdo integralmente válido')
    expect(document.querySelector('a[href="/quarantine?fileId=41"]')).not.toBeNull()
    expect(isCollectionInProgress.value).toBe(false)
  })
  it('shows API errors from automatic collection in the popup', async () => {
    const { mountCollection } = await setup()
    const form = mountCollection()
    await form.find('input').setValue('2024')
    vi.mocked(axios.post).mockRejectedValue({ response: { data: 'Serviço oficial indisponível.' } })
    await form
      .findAll('button')
      .find((b) => b.text().includes('Coletar e validar'))!
      .trigger('click')
    await flushPromises()
    expect(document.querySelector('.ingestion-progress')?.textContent).toContain(
      'Serviço oficial indisponível.',
    )
    expect(ingestionProgress.value?.status).toBe('error')
  })
  it('does not presume rejection or offer quarantine without a validation report', async () => {
    const { mountCollection } = await setup()
    const form = mountCollection()
    await form.find('input').setValue('2024')
    vi.mocked(axios.post).mockResolvedValue({
      data: { file: { ...file('VALIDO'), validation: null }, collection },
    })
    await form
      .findAll('button')
      .find((b) => b.text().includes('Coletar e validar'))!
      .trigger('click')
    await flushPromises()
    expect(ingestionProgress.value?.status).toBe('attention')
    expect(document.querySelector('.ingestion-progress')?.textContent).toContain(
      'Validação indisponível',
    )
    expect(document.querySelector('.ingestion-progress a[href*="quarantine"]')).toBeNull()
  })
  it('cancels the browser upload once and does not send the next file', async () => {
    await setup()
    vi.mocked(axios.post).mockImplementation(
      (_path, _data, config) =>
        new Promise((_resolve, reject) => {
          config?.signal?.addEventListener?.('abort', () => reject(new Error('aborted')), {
            once: true,
          })
        }),
    )
    const operation = startUpload(2, [new File(['a'], 'a.csv'), new File(['b'], 'b.csv')], 7)
    await nextTick()
    const button = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Cancelar envio'),
    )!
    button.click()
    button.click()
    await operation
    await flushPromises()
    expect(axios.post).toHaveBeenCalledOnce()
    expect(ingestionProgress.value?.status).toBe('cancelled')
    expect(document.body.textContent).toContain('não desfaz operações concluídas no servidor')
  })
  it('ignores late callbacks after dismissal or a newer operation', () => {
    const old = beginIngestionProgress({
      kind: 'manual',
      title: 'Anterior',
      source: 'IBGE',
      fileCount: 1,
    })
    clearIngestionProgress()
    finishIngestionProgress(old, 'completed', 'Antigo')
    expect(ingestionProgress.value).toBeNull()
    const current = beginIngestionProgress({
      kind: 'automatic',
      title: 'Atual',
      source: 'INPE',
      fileCount: 1,
    })
    updateIngestionProgress(old, { percent: 100 })
    finishIngestionProgress(old, 'error', 'Antigo')
    expect(ingestionProgress.value?.id).toBe(current)
    expect(ingestionProgress.value?.status).toBe('running')
    expect(ingestionProgress.value?.percent).toBeNull()
  })
  it('ignores stale upload progress after an operation has finished', () => {
    const id = beginIngestionProgress({
      kind: 'manual',
      title: 'Envio',
      source: 'IBGE',
      fileCount: 1,
    })
    finishIngestionProgress(id, 'completed', 'VALIDO')
    updateIngestionProgress(id, { stage: 'uploading', percent: 30 })
    expect(ingestionProgress.value?.stage).toBe('finished')
  })
})
