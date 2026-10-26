import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import axios from 'axios'
import QuarantineView from '@/views/QuarantineView.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import QuarantineCorrectionDialog from '@/components/QuarantineCorrectionDialog.vue'
import { setSessionUser, type Role } from '@/access/session'
import { treatmentBytes, treatmentError, type QuarantineRecord } from '@/services/quarantine'

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    isAxiosError: (error: unknown) => !!error && typeof error === 'object' && 'response' in error,
  },
}))
let records: QuarantineRecord[]
let cleanups: (() => void)[] = []
const report = {
  status: 'PARCIAL',
  dictionaryId: 10,
  dictionaryVersion: 2,
  validRecords: 1,
  rejectedRecords: 1,
  records: [
    {
      recordIndex: -1,
      rawContent: '<img src=x onerror="alert(1)">',
      valid: false,
      errors: ['<script>alert(1)</script>', 'Arquivo sem geometria válida.'],
    },
  ],
}
function record(id: number, overrides: Partial<QuarantineRecord> = {}): QuarantineRecord {
  return {
    id,
    ingestionId: id + 10,
    fileId: 99,
    fileName: 'municipios.geojson',
    sourceId: 2,
    sourceName: 'IBGE',
    status: 'REGISTROS_REJEITADOS',
    reason: '<b>Registros rejeitados na validação.</b>',
    treatment: null,
    dateEntry: '2026-10-24T12:00:00',
    dateResolution: null,
    responsibleId: null,
    responsibleName: null,
    validationReportUrl: '/arquivos/99/validacao',
    ...overrides,
  }
}
function response(path: string, query: unknown = {}) {
  const params = (query ?? {}) as Record<string, unknown>
  if (path === '/quarentenas') {
    const filtered = records.filter(
      (entry) =>
        (!params.status || params.status === entry.status) &&
        (!params.unassigned ||
          (entry.responsibleId === null &&
            entry.dateResolution === null &&
            entry.status !== 'RESOLVIDA')) &&
        (!params.responsibleId || params.responsibleId === entry.responsibleId) &&
        (!params.fileId || params.fileId === entry.fileId),
    )
    const page = Number(params.page ?? 0),
      size = Number(params.size ?? 20)
    return {
      data: structuredClone({
        content: filtered.slice(page * size, (page + 1) * size),
        page,
        size,
        totalElements: filtered.length,
        totalPages: Math.ceil(filtered.length / size),
      }),
    }
  }
  if (path === '/arquivos/99/validacao') return { data: structuredClone(report) }
  const found = records.find((entry) => path === `/quarentenas/${entry.id}`)
  if (found) return { data: structuredClone(found) }
  throw { response: { status: 404, data: 'Quarentena não encontrada.' } }
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
    width: 1400,
    height: 1000,
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
  setSessionUser({ id: 7, name: 'Operador atual', userType: 'OPERADOR', userStatus: 1 })
  records = [
    record(1),
    record(2, {
      fileId: 100,
      fileName: 'outra.csv',
      responsibleId: 8,
      responsibleName: 'Outra pessoa',
      status: 'EM_ANALISE',
      treatment: 'Em conferência.',
    }),
    record(3, {
      status: 'RESOLVIDA',
      responsibleId: 7,
      responsibleName: 'Operador atual',
      treatment: 'Análise concluída.',
      dateResolution: '2026-10-24T13:00:00',
    }),
  ]
  vi.mocked(axios.get).mockImplementation(async (path, config) => response(path, config?.params))
  vi.mocked(axios.post).mockImplementation(async (path, body) => {
    const target = records.find((entry) => entry.id === Number(path.split('/')[2]))!
    const actor = body as { userId: number; treatment?: string }
    expect(actor.userId).toBe(7)
    if (path.endsWith('/assumir'))
      Object.assign(target, {
        responsibleId: actor.userId,
        responsibleName: 'Operador atual',
        status: 'EM_ANALISE',
      })
    else
      Object.assign(target, {
        treatment: actor.treatment,
        status: 'RESOLVIDA',
        dateResolution: '2026-10-24T13:00:00',
      })
    return { data: structuredClone(target), status: 200 }
  })
  vi.mocked(axios.patch).mockImplementation(async (path, body) => {
    const target = records.find((entry) => entry.id === Number(path.split('/')[2]))!
    Object.assign(target, { treatment: (body as { treatment: string }).treatment })
    return { data: structuredClone(target), status: 200 }
  })
})
afterEach(async () => {
  cleanups.forEach((cleanup) => cleanup())
  cleanups = []
  await flushPromises()
  setSessionUser(null)
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})
async function setup(path = '/quarantine', role: Role = 'OPERADOR') {
  setSessionUser({ id: 7, name: 'Operador atual', userType: role, userStatus: 1 })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/quarantine', component: QuarantineView }],
  })
  await router.push(path)
  const w = mount(QuarantineView, {
    attachTo: document.body,
    global: {
      plugins: [router, createVuetify({ components, directives, theme: { defaultTheme: 'dark' } })],
    },
  })
  cleanups.push(() => w.unmount())
  await flushPromises()
  return { w, router }
}
type Wrapper = Awaited<ReturnType<typeof setup>>['w']
const button = (w: Wrapper, text: string) =>
  w.findAll('button').find((entry) => entry.text() === text)!
async function select(w: Wrapper, id: number) {
  await w.find(`button[data-quarantine-id="${id}"]`).trigger('click')
  await flushPromises()
}
async function claim(w: Wrapper) {
  await button(w, 'Assumir correção').trigger('click')
  await flushPromises()
}

describe('BE-05 quarantine', () => {
  it('selects the matching record when navigating to quarantine for a different file', async () => {
    const { w, router } = await setup('/quarantine?fileId=99')
    expect(w.find('.detail-heading').text()).toContain('municipios.geojson')
    await router.replace('/quarantine?fileId=100')
    await flushPromises()
    expect(axios.get).toHaveBeenCalledWith('/quarentenas', {
      params: { page: 0, size: 20, fileId: 100 },
    })
    expect(w.find('.detail-heading').text()).toContain('outra.csv')
    expect(button(w, 'Assumir correção')).toBeUndefined()
  })
  it.each([400, 422])(
    'preserves draft and backend validation errors for HTTP %s',
    async (status) => {
      const { w } = await setup()
      await claim(w)
      await w.find('textarea').setValue('Conferência com a fonte.')
      vi.mocked(axios.patch).mockRejectedValueOnce({
        response: { status, data: 'Observação recusada pelo backend.' },
      })
      await button(w, 'Salvar observação').trigger('click')
      await flushPromises()
      expect(w.text()).toContain('Observação recusada pelo backend.')
      expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe(
        'Conferência com a fonte.',
      )
      expect(records[0]!.treatment).toBeNull()
    },
  )

  it('cancels resolution and later handles a conflict with an already closed analysis', async () => {
    const { w } = await setup()
    await claim(w)
    await w.find('textarea').setValue('Análise realizada.')
    await button(w, 'Resolver análise').trigger('click')
    const confirm = w.findComponent(ConfirmDialog)
    await confirm
      .findAllComponents(components.VBtn)
      .find((entry) => entry.text() === 'Cancelar')!
      .trigger('click')
    await flushPromises()
    await (w.vm as unknown as { act: (action: string) => Promise<void> }).act('resolver')
    expect(axios.post).toHaveBeenCalledTimes(1)
    vi.mocked(axios.post).mockImplementationOnce(async () => {
      Object.assign(records[0]!, { status: 'RESOLVIDA', dateResolution: '2026-10-24T13:00:00' })
      throw { response: { status: 409, data: 'A análise desta quarentena já foi encerrada.' } }
    })
    await button(w, 'Resolver análise').trigger('click')
    await confirm
      .findAllComponents(components.VBtn)
      .find((entry) => entry.text() === 'Confirmar')!
      .trigger('click')
    await flushPromises()
    expect(w.text()).toContain('A análise desta quarentena já foi encerrada.')
    expect(w.find('textarea').exists()).toBe(false)
    expect(w.text()).toContain('Análise encerrada, disponível somente para leitura.')
  })

  it('shows a missing quarantine without exposing stale correction actions', async () => {
    vi.mocked(axios.get).mockImplementation(async (path, config) => {
      if (path === '/quarentenas/1')
        throw { response: { status: 404, data: 'Quarentena não encontrada.' } }
      return response(path, config?.params)
    })
    const { w } = await setup()
    expect(w.text()).toContain('Quarentena não encontrada.')
    expect(button(w, 'Assumir correção')).toBeUndefined()
    await select(w, 2)
    expect(w.find('.detail-heading').text()).toContain('outra.csv')
  })

  it('keeps report errors visible and retries the URL supplied by the backend', async () => {
    const { w } = await setup()
    vi.mocked(axios.get).mockRejectedValueOnce({
      response: { status: 404, data: 'Relatório original indisponível.' },
    })
    await button(w, 'Relatório de validação').trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('Relatório original indisponível.')
    await w
      .findAllComponents(components.VBtn)
      .find((entry) => entry.text() === 'Tentar novamente')!
      .trigger('click')
    await flushPromises()
    expect(axios.get).toHaveBeenLastCalledWith('/arquivos/99/validacao')
    expect(document.body.textContent).toContain(
      'PARCIAL: 1 registro(s) aprovado(s), 1 rejeitado(s).',
    )
  })

  it('claims an available record, saves an observation and confirms resolution without approving data', async () => {
    const { w } = await setup()
    const originalReason = records[0]!.reason
    expect(w.text()).toContain('Nenhuma observação registrada.')
    expect(w.find('textarea').exists()).toBe(false)
    await claim(w)
    expect(axios.post).toHaveBeenCalledWith('/quarentenas/1/assumir', { userId: 7 })
    expect(w.find('textarea').exists()).toBe(true)
    expect(button(w, 'Resolver análise').attributes('disabled')).toBeDefined()
    await w.find('textarea').setValue('  Conferindo os dados com a fonte.  ')
    await button(w, 'Salvar observação').trigger('click')
    await flushPromises()
    expect(axios.patch).toHaveBeenCalledExactlyOnceWith('/quarentenas/1/observacao', {
      userId: 7,
      treatment: 'Conferindo os dados com a fonte.',
    })
    await w.find('textarea').setValue('Descrição final da análise.')
    await button(w, 'Resolver análise').trigger('click')
    const dialog = w.findComponent(ConfirmDialog)
    expect(dialog.props('modelValue')).toBe(true)
    expect(dialog.props('message')).toContain('NÃO aprova os dados rejeitados')
    expect(axios.post).toHaveBeenCalledTimes(1)
    await dialog
      .findAllComponents(components.VBtn)
      .find((entry) => entry.text() === 'Confirmar')!
      .trigger('click')
    await flushPromises()
    expect(axios.post).toHaveBeenLastCalledWith('/quarentenas/1/resolver', {
      userId: 7,
      treatment: 'Descrição final da análise.',
    })
    expect(w.find('textarea').exists()).toBe(false)
    expect(w.find('.quarantine-detail').text()).toContain('24/10/2026 às 13:00:00')
    expect(records[0]!.reason).toBe(originalReason)
    expect(axios.get).toHaveBeenCalledWith('/quarentenas/1')
    expect(
      vi.mocked(axios.get).mock.calls.filter(([path]) => path === '/quarentenas'),
    ).toHaveLength(4)
    await button(w, 'Relatório de validação').trigger('click')
    await flushPromises()
    expect(axios.get).toHaveBeenLastCalledWith('/arquivos/99/validacao')
    expect(document.body.textContent).toContain(
      'PARCIAL: 1 registro(s) aprovado(s), 1 rejeitado(s).',
    )
  })

  it('keeps another person’s record, resolved records and auditor access read-only', async () => {
    const { w } = await setup('/quarantine', 'AUDITOR')
    expect(button(w, 'Assumir correção')).toBeUndefined()
    await select(w, 2)
    expect(w.text()).toContain('Esta correção está com outra pessoa.')
    expect(w.text()).toContain('Em conferência.')
    expect(w.find('textarea').exists()).toBe(false)
    await (w.vm as unknown as { act: (action: string) => Promise<void> }).act('assumir')
    expect(axios.post).not.toHaveBeenCalled()
    expect(axios.patch).not.toHaveBeenCalled()
    await select(w, 3)
    expect(w.text()).toContain('Análise encerrada, disponível somente para leitura.')
  })

  it('reads back current ownership on a claim conflict and preserves the plain backend message', async () => {
    const { w } = await setup()
    vi.mocked(axios.post).mockImplementationOnce(async () => {
      Object.assign(records[0]!, {
        responsibleId: 8,
        responsibleName: 'Outra pessoa',
        status: 'EM_ANALISE',
      })
      throw { response: { status: 409, data: 'Esta quarentena já foi assumida por outra pessoa.' } }
    })
    await claim(w)
    expect(w.text()).toContain('Esta quarentena já foi assumida por outra pessoa.')
    expect(w.find('.quarantine-detail').text()).toContain('Outra pessoa')
    expect(w.find('textarea').exists()).toBe(false)
    expect(button(w, 'Assumir correção')).toBeUndefined()
    expect(axios.get).toHaveBeenCalledWith('/quarentenas/1')
  })

  it('prevents duplicate claims while awaiting the API', async () => {
    const { w } = await setup()
    let resolve!: (value: { data: QuarantineRecord }) => void
    vi.mocked(axios.post).mockImplementationOnce(
      () => new Promise((resolveRequest) => (resolve = resolveRequest)),
    )
    await button(w, 'Assumir correção').trigger('click')
    expect(button(w, 'Assumir correção').attributes('disabled')).toBeDefined()
    await (w.vm as unknown as { act: (action: string) => Promise<void> }).act('assumir')
    expect(axios.post).toHaveBeenCalledTimes(1)
    Object.assign(records[0]!, {
      responsibleId: 7,
      responsibleName: 'Operador atual',
      status: 'EM_ANALISE',
    })
    resolve({ data: structuredClone(records[0]!) })
    await flushPromises()
    expect(w.find('textarea').exists()).toBe(true)
  })

  it('validates observations using trimmed UTF-8 bytes and never submits empty or oversized text', async () => {
    const { w } = await setup()
    await claim(w)
    await w.find('textarea').setValue('   ')
    expect(button(w, 'Salvar observação').attributes('disabled')).toBeDefined()
    await w.find('textarea').setValue('á'.repeat(251))
    expect(w.text()).toContain('502 / 500 bytes UTF-8')
    expect(button(w, 'Resolver análise').attributes('disabled')).toBeDefined()
    await (w.vm as unknown as { act: (action: string) => Promise<void> }).act('observacao')
    expect(axios.patch).not.toHaveBeenCalled()
    await w.find('textarea').setValue(' á'.trim().repeat(250))
    expect(button(w, 'Salvar observação').attributes('disabled')).toBeUndefined()
    expect(treatmentBytes(' 😀 '.trim().repeat(125))).toBe(500)
    expect(treatmentError('  ')).toContain('obrigatória')
  })

  it('uses server pagination, current identity, status and file filters', async () => {
    records = Array.from({ length: 25 }, (_, index) => record(index + 1))
    const { w, router } = await setup('/quarantine?fileId=99')
    expect(axios.get).toHaveBeenCalledWith('/quarentenas', {
      params: { page: 0, size: 20, fileId: 99 },
    })
    w.findComponent(components.VPagination).vm.$emit('update:modelValue', 2)
    await flushPromises()
    expect(axios.get).toHaveBeenCalledWith('/quarentenas', {
      params: { page: 1, size: 20, fileId: 99 },
    })
    expect(w.findAll('tbody tr')).toHaveLength(5)
    await button(w, 'Disponíveis').trigger('click')
    await flushPromises()
    expect(axios.get).toHaveBeenCalledWith('/quarentenas', {
      params: { page: 0, size: 20, fileId: 99, unassigned: true },
    })
    await button(w, 'Minhas análises').trigger('click')
    await flushPromises()
    expect(axios.get).toHaveBeenCalledWith('/quarentenas', {
      params: { page: 0, size: 20, fileId: 99, responsibleId: 7 },
    })
    expect(w.text()).toContain('Nenhuma quarentena encontrada')
    w.findAllComponents(components.VSelect)
      .find((entry) => entry.props('label') === 'Status')!
      .vm.$emit('update:modelValue', 'EM_ANALISE')
    await flushPromises()
    expect(axios.get).toHaveBeenLastCalledWith('/quarentenas', {
      params: { page: 0, size: 20, fileId: 99, responsibleId: 7, status: 'EM_ANALISE' },
    })
    await router.replace('/quarantine')
    await flushPromises()
    expect(vi.mocked(axios.get).mock.calls.slice(-1)[0]?.[1]?.params).not.toHaveProperty('fileId')
  })

  it('keeps the claimed detail available for editing after it leaves the available filter', async () => {
    const { w } = await setup()
    await button(w, 'Disponíveis').trigger('click')
    await flushPromises()
    await claim(w)
    expect(w.find('textarea').exists()).toBe(true)
    expect(w.text()).toContain('Esta análise não está entre os resultados')
    expect(w.findAll('tbody tr')).toHaveLength(0)
  })

  it('renders nullable file references without guessing a report URL', async () => {
    records = [
      record(1, {
        fileId: null,
        fileName: null,
        sourceName: null,
        reason: null,
        validationReportUrl: null,
      }),
    ]
    const { w } = await setup()
    expect(w.text()).toContain('Arquivo não vinculado')
    expect(w.text()).toContain('Relatório de validação não disponível')
    expect(button(w, 'Relatório de validação')).toBeUndefined()
    expect(vi.mocked(axios.get).mock.calls.every(([path]) => !path.startsWith('/arquivos/'))).toBe(
      true,
    )
  })

  it('renders original reasons, record indices, content and errors as escaped text', async () => {
    const { w } = await setup()
    expect(w.find('.preserve-text').text()).toBe(records[0]!.reason)
    expect(w.find('.preserve-text b').exists()).toBe(false)
    await button(w, 'Relatório de validação').trigger('click')
    await flushPromises()
    const raw = document.body.querySelector('.raw-content')!
    expect(raw.textContent).toBe(report.records[0]!.rawContent)
    expect(raw.querySelector('img')).toBeNull()
    expect(document.body.querySelector('script')).toBeNull()
    expect(document.body.textContent).toContain('<script>alert(1)</script>')
    expect(document.body.textContent).toContain('Arquivo')
    expect(document.body.textContent).toContain('Índice do registro')
  })

  it('discards late detail and report responses when selecting another record', async () => {
    const { w } = await setup()
    let resolveReport!: (value: { data: typeof report }) => void
    vi.mocked(axios.get).mockImplementationOnce(
      () => new Promise((resolve) => (resolveReport = resolve)),
    )
    await button(w, 'Relatório de validação').trigger('click')
    await select(w, 2)
    resolveReport({ data: report })
    await flushPromises()
    expect(w.findComponent(components.VDialog).props('modelValue')).toBe(false)
    let resolveDetail!: (value: { data: QuarantineRecord }) => void
    vi.mocked(axios.get).mockImplementationOnce(
      () => new Promise((resolve) => (resolveDetail = resolve)),
    )
    await w.find('button[data-quarantine-id="1"]').trigger('click')
    await select(w, 2)
    resolveDetail({ data: structuredClone(records[0]!) })
    await flushPromises()
    expect(w.find('.detail-heading').text()).toContain('outra.csv')
    expect(button(w, 'Assumir correção')).toBeUndefined()
  })

  it('shows API list errors with retry and re-reads ownership after a forbidden update', async () => {
    vi.mocked(axios.get).mockRejectedValueOnce({
      response: { status: 500, data: 'Falha ao consultar quarentenas.' },
    })
    const { w } = await setup()
    expect(w.text()).toContain('Falha ao consultar quarentenas.')
    await button(w, 'Tentar novamente').trigger('click')
    await flushPromises()
    await claim(w)
    await w.find('textarea').setValue('Conferência em andamento.')
    vi.mocked(axios.patch).mockImplementationOnce(async () => {
      Object.assign(records[0]!, { responsibleId: 8, responsibleName: 'Outra pessoa' })
      throw {
        response: { status: 403, data: 'Somente o responsável pode alterar esta quarentena.' },
      }
    })
    await button(w, 'Salvar observação').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Somente o responsável pode alterar esta quarentena.')
    expect(w.find('textarea').exists()).toBe(false)
  })

  const richReport = {
    ...report,
    records: [
      { recordIndex: 3, rawContent: '{"nome":""}', valid: false, errors: ['REQUIRED_FIELD: nome'] },
      { recordIndex: 4, rawContent: '{"area":"abc"}', valid: false, errors: ['INVALID_TYPE: area'] },
    ],
  }
  function serveRichReport() {
    vi.mocked(axios.get).mockImplementation(async (path, config) =>
      path === '/arquivos/99/validacao'
        ? { data: structuredClone(richReport) }
        : response(path, config?.params),
    )
  }

  it('opens the correction dialog after claiming and can reopen it without reloading the report', async () => {
    serveRichReport()
    const { w } = await setup()
    expect(button(w, 'Corrigir registros')).toBeUndefined()
    await claim(w)
    expect(axios.post).toHaveBeenCalledExactlyOnceWith('/quarentenas/1/assumir', { userId: 7 })
    expect(
      vi.mocked(axios.get).mock.calls.filter(([path]) => path === '/arquivos/99/validacao'),
    ).toHaveLength(1)
    expect(document.body.textContent).toContain('Registros para corrigir')
    expect(document.body.textContent).toContain('Índice do registro: 3')
    expect(document.body.textContent).toContain('Campo obrigatório')
    expect(axios.patch).not.toHaveBeenCalled()
    const close = [...document.body.querySelectorAll('button')].find(
      (entry) => entry.textContent?.trim() === 'Fechar',
    )!
    close.click()
    await flushPromises()
    expect(w.findComponent(QuarantineCorrectionDialog).props('modelValue')).toBe(false)
    await button(w, 'Corrigir registros').trigger('click')
    await flushPromises()
    expect(w.findComponent(QuarantineCorrectionDialog).props('modelValue')).toBe(true)
    expect(
      vi.mocked(axios.get).mock.calls.filter(([path]) => path === '/arquivos/99/validacao'),
    ).toHaveLength(1)
  })

  it('does not offer corrections to read-only profiles or to other people’s analyses', async () => {
    serveRichReport()
    const auditor = await setup('/quarantine', 'AUDITOR')
    expect(button(auditor.w, 'Corrigir registros')).toBeUndefined()
    await select(auditor.w, 2)
    expect(button(auditor.w, 'Corrigir registros')).toBeUndefined()
    cleanups.forEach((cleanup) => cleanup())
    cleanups = []
    const operator = await setup()
    await select(operator.w, 2)
    expect(button(operator.w, 'Corrigir registros')).toBeUndefined()
    expect(document.body.textContent).not.toContain('Registros para corrigir')
  })
})