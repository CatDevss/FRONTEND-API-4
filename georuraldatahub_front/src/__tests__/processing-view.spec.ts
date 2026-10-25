import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, type Component } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import axios from 'axios'
import { setSessionUser } from '@/access/session'
import FileTreatmentDialog from '@/components/FileTreatmentDialog.vue'
import QuarantineObjects from '@/components/QuarantineObjects.vue'
import Rasters from '@/views/RastersView.vue'
import type { TreatmentExecution, RasterDetail } from '@/services/processing'

vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn(), isAxiosError: () => true } }))
const cleanups: (() => void)[] = []
const vector: TreatmentExecution = {
  id: 50,
  fileId: 11,
  userId: 7,
  inputVersionId: 1,
  status: 'CONCLUIDO',
  startedAt: '2026-10-25T10:00:00',
  finishedAt: '2026-10-25T10:01:00',
  outputVersionId: 2,
  layerId: 61,
  rasterId: null,
  inputCount: 2,
  outputCount: 2,
  error: null,
  parameters: { request: { datasetId: 2 } },
  provenance: { note: '<img src=x onerror=alert(1)>' },
}
const footprint = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [-50, -25],
      [-49, -25],
      [-49, -24],
      [-50, -25],
    ],
  ],
}
const raster: RasterDetail = {
  id: 8,
  versionId: 30,
  location: 'bruta/fontes/2/cobertura.tif',
  sourceSrid: 4674,
  coverageSrid: 4326,
  metadata: {
    summary: {
      width: 200,
      height: 300,
      pixelWidth: 30,
      pixelHeight: 30,
      pixelUnit: 'metre',
      footprint,
    },
    bands: [{ number: 1, dataType: 'UInt16', noData: '-9999', unit: null }],
  },
}
function page<T>(content: T[], totalPages = 1) {
  return { content, page: 0, size: 20, totalElements: content.length, totalPages }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}
async function setup(
  component: Component,
  path = '/file-uploads',
  props: Record<string, unknown> = {},
) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: ['/file-uploads', '/home', '/rasters', '/datasets'].map((path) => ({
      path,
      component: defineComponent({ template: '<div />' }),
    })),
  })
  await router.push(path)
  const wrapper = mount(component, {
    props,
    attachTo: document.body,
    global: {
      plugins: [router, createVuetify({ components, directives, theme: { defaultTheme: 'dark' } })],
      stubs: {
        RasterCoverageMap: {
          name: 'RasterCoverageMap',
          props: ['geometry'],
          template: '<div class="coverage-test" />',
        },
      },
    },
  })
  cleanups.push(() => wrapper.unmount())
  await flushPromises()
  return { wrapper, router }
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
  setSessionUser({ id: 7, name: 'Operador', userStatus: 1, userType: 'OPERADOR' })
  vi.mocked(axios.get).mockImplementation(async (path) => ({
    data:
      path === '/conjuntos'
        ? [{ id: 2, name: 'Paraná' }]
        : path.endsWith('/estrutura')
          ? { sources: [{ files: [{ id: 11 }] }] }
          : path.endsWith('/tratamentos')
            ? page([vector])
            : path === '/rasters'
              ? page([{ ...raster, width: 200, height: 300, bandCount: 1 }])
              : raster,
  }))
  vi.mocked(axios.post).mockResolvedValue({ status: 201, data: vector })
})
afterEach(async () => {
  cleanups.splice(0).forEach((fn) => fn())
  await flushPromises()
  setSessionUser(null)
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})
describe('treatment interface', () => {
  it('shows history, executes treatment and opens its exact result using a route with execution context', async () => {
    const { wrapper } = await setup(FileTreatmentDialog, '/file-uploads', {
      modelValue: true,
      file: { id: 11, name: 'dados.gpkg', formatFile: 'gpkg' },
      initialDatasetId: 2,
    })
    const button = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Tratar arquivo'),
    )!
    expect(button.disabled).toBe(false)
    button.click()
    await flushPromises()
    expect(axios.post).toHaveBeenCalledWith('/arquivos/11/tratamentos', { userId: 7, datasetId: 2 })
    expect(wrapper.emitted('treated')?.[0]).toEqual([vector])
    const links = [...document.querySelectorAll('a')].filter((link) =>
      link.textContent?.includes('Abrir camada 61'),
    )
    expect(links.length).toBeGreaterThan(0)
    expect(links[0]?.getAttribute('href')).toBe('/home?dataset=2&treatment=50')
    expect(document.body.textContent).toContain('não significa publicação')
    expect(document.body.textContent).toContain('10:01')
    expect(document.body.querySelector('img')).toBeNull()
  })
  it('renders a failed execution as text and offers no map link', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: page([
        { ...vector, status: 'FALHOU', error: '<img src=x> Geometria inválida', layerId: null },
      ]),
    })
    setSessionUser({ id: 8, name: 'Auditor', userStatus: 1, userType: 'AUDITOR' })
    await setup(FileTreatmentDialog, '/file-uploads', {
      modelValue: true,
      file: { id: 11, name: 'dados.geojson', formatFile: 'geojson' },
    })
    expect(document.body.textContent).toContain('Geometria inválida')
    expect(document.body.textContent).toContain('Falhou')
    expect(document.body.querySelector('img')).toBeNull()
    expect(
      [...document.querySelectorAll('a')].some((link) =>
        link.textContent?.includes('Abrir camada'),
      ),
    ).toBe(false)
    expect(
      [...document.querySelectorAll('button')].some((b) =>
        b.textContent?.includes('Tratar arquivo'),
      ),
    ).toBe(false)
  })
  it('offers the raster catalog instead of a vector map for raster output', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: page([
        { ...vector, layerId: null, rasterId: 8, parameters: { request: { datasetId: null } } },
      ]),
    })
    await setup(FileTreatmentDialog, '/file-uploads', {
      modelValue: true,
      file: { id: 11, name: 'dados.tif', formatFile: 'tif' },
    })
    expect(document.body.textContent).toContain('As células do GeoTIFF não são processadas')
    expect(document.body.querySelector('a[href="/rasters?raster=8"]')).not.toBeNull()
    expect(document.body.textContent).not.toContain('Abrir camada')
  })
})
describe('raster catalog', () => {
  it('loads paginated metadata and uses the reported footprint without requesting a GeoTIFF image', async () => {
    const { wrapper } = await setup(Rasters, '/rasters?raster=8')
    expect(axios.get).toHaveBeenCalledWith('/rasters', { params: { page: 0, size: 20 } })
    expect(axios.get).toHaveBeenCalledWith('/rasters/8')
    expect(wrapper.text()).toContain('200 × 300')
    expect(wrapper.text()).toContain('EPSG:4674')
    expect(wrapper.text()).toContain('UInt16')
    expect(wrapper.findComponent({ name: 'RasterCoverageMap' }).props('geometry')).toEqual(
      footprint,
    )
    expect(wrapper.findAll('a').some((a) => a.attributes('href')?.includes('.tif'))).toBe(false)
    expect(
      vi
        .mocked(axios.get)
        .mock.calls.some(([path]) => path.includes('geojson') || path.endsWith('.tif')),
    ).toBe(false)
  })
  it('validates EPSG:4326 bbox and sends the real filter to the API', async () => {
    const { wrapper } = await setup(Rasters, '/rasters')
    const input = wrapper.find('input')
    await input.setValue('-49,-24,-50,-25')
    const before = vi.mocked(axios.get).mock.calls.length
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Informe oeste,sul,leste,norte válidos')
    expect(axios.get).toHaveBeenCalledTimes(before)
    await input.setValue('-54.62,-26.72,-48.02,-22.5')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(axios.get).toHaveBeenLastCalledWith('/rasters', {
      params: { page: 0, size: 20, bbox: '-54.62,-26.72,-48.02,-22.5' },
    })
  })
  it('shows backend unavailability and retries without retaining old entries', async () => {
    vi.mocked(axios.get).mockRejectedValue({
      response: { status: 503, data: 'Tratamento persistente desativado.' },
    })
    const { wrapper } = await setup(Rasters, '/rasters')
    expect(wrapper.text()).toContain('Tratamento persistente desativado.')
    vi.mocked(axios.get).mockResolvedValue({ data: page([]) })
    const button = wrapper.findAll('button').find((b) => b.text().includes('Tentar novamente'))!
    await button.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Nenhum raster encontrado')
    expect(wrapper.text()).not.toContain('Tratamento persistente desativado.')
  })
  it('discards late raster details after switching the query selection', async () => {
    const slow = deferred<{ data: RasterDetail }>()
    vi.mocked(axios.get).mockImplementation(async (path) =>
      path === '/rasters/8'
        ? slow.promise
        : {
            data: path === '/rasters' ? page([]) : { ...raster, id: 9, location: 'bruta/novo.tif' },
          },
    )
    const { wrapper, router } = await setup(Rasters, '/rasters?raster=8')
    await router.push('/rasters?raster=9')
    await flushPromises()
    slow.resolve({ data: raster })
    await flushPromises()
    expect(wrapper.text()).toContain('bruta/novo.tif')
    expect(wrapper.text()).not.toContain('bruta/fontes/2/cobertura.tif')
  })
})
describe('quarantine object references', () => {
  it('queries the real file and displays object keys as safe text, without download links', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: page([
        {
          id: 15,
          fileId: 11,
          status: 'REGISTROS_REJEITADOS',
          reason: '<img src=x> erro',
          quarantineLocation: 'quarentena/arquivo.zip',
          quarantineReportLocation: 'quarentena/relatorio.json',
        },
      ]),
    })
    const { wrapper } = await setup(QuarantineObjects, '/file-uploads', { fileId: 11 })
    expect(axios.get).toHaveBeenCalledWith('/quarentenas', {
      params: { fileId: 11, page: 0, size: 20 },
    })
    expect(wrapper.text()).toContain('quarentena/arquivo.zip')
    expect(wrapper.text()).toContain('quarentena/relatorio.json')
    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('sem links públicos')
  })
})
