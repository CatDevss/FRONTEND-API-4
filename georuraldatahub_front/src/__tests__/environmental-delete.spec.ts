import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import axios from 'axios'
import Reports from '@/components/workspace/EnvironmentalReports.vue'
import History from '@/components/workspace/EnvironmentalHistory.vue'
import { setSessionUser } from '@/access/session'
vi.mock('axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn(), isAxiosError: () => false },
}))
const report = {
  id: 'r',
  name: 'Relatório IFC',
  indicator: 'ifc',
  createdAt: '2026-11-21T12:00:00Z',
  total: 1,
  completed: 1,
  failed: 0,
}
const calculation = {
  id: 21,
  name: 'Adrianópolis',
  indicator: 'ifc',
  calculatedAt: '2026-11-21 12:00:00',
}
const box = { template: '<div><slot /><slot name="append" /></div>' }
const stubs = {
  EnvironmentalHistoryReport: true,
  EnvironmentalHistoryFilters: true,
  VBtn: { props: ['disabled'], template: '<button :disabled="disabled"><slot /></button>' },
  VTextField: true,
  VSelect: true,
  VAlert: box,
  VList: box,
  VListItem: { props: ['title'], template: '<div>{{title}}<slot name="append" /></div>' },
  ConfirmDialog: {
    props: ['modelValue', 'message'],
    emits: ['update:modelValue', 'confirm'],
    template:
      '<div v-if="modelValue">{{ message }}<button @click="$emit(\'update:modelValue\',false)">Cancelar</button><button @click="$emit(\'update:modelValue\',false);$emit(\'confirm\')">Confirmar</button></div>',
  },
}
beforeEach(() => {
  vi.clearAllMocks()
  setSessionUser({ id: 4, name: 'Operador', userStatus: 1, userType: 'OPERADOR' })
  vi.mocked(axios.delete).mockResolvedValue({ status: 204 })
  vi.mocked(axios.get).mockImplementation(async (url) => ({
    data: String(url).endsWith('/recursos')
      ? { enabled: true, deletionEnabled: true, calculationDeletionEnabled: true }
      : { items: String(url).includes('/calculos') ? [calculation] : [report], total: 1 },
  }))
})
afterEach(() => setSessionUser(null))
for (const kind of ['relatório', 'cálculo'] as const) {
  describe(`Exclusão de ${kind}`, () => {
    const setup = () => mount(kind === 'relatório' ? Reports : History, { global: { stubs } })
    it('solicita confirmação e só remove após resposta do servidor', async () => {
      const panel = setup()
      await flushPromises()
      const button = (text: string) =>
        panel.findAll('button').find((button) => button.text() === text)!
      await button('Excluir').trigger('click')
      expect(axios.delete).not.toHaveBeenCalled()
      await button('Cancelar').trigger('click')
      expect(axios.delete).not.toHaveBeenCalled()
      await button('Excluir').trigger('click')
      await button('Confirmar').trigger('click')
      await flushPromises()
      expect(axios.delete).toHaveBeenCalledWith(
        kind === 'relatório' ? '/ambiental/relatorios/r' : '/ambiental/calculos/21',
        { params: { usuarioId: 4 }, timeout: 30000 },
      )
      expect(panel.text()).toContain('auditoria')
      expect(panel.findAll('button').some((button) => button.text() === 'Excluir')).toBe(false)
      panel.unmount()
    })
    it('mantém o registro quando a exclusão falha', async () => {
      vi.mocked(axios.delete).mockRejectedValue(new Error('Conexão interrompida'))
      const panel = setup()
      await flushPromises()
      await panel
        .findAll('button')
        .find((button) => button.text() === 'Excluir')!
        .trigger('click')
      await panel
        .findAll('button')
        .find((button) => button.text() === 'Confirmar')!
        .trigger('click')
      await flushPromises()
      expect(panel.text()).toContain(kind === 'relatório' ? report.name : calculation.name)
      expect(panel.text()).toContain('Não foi possível confirmar a exclusão')
      panel.unmount()
    })
    it('não oferece exclusão para auditor', async () => {
      setSessionUser({ id: 4, name: 'Auditor', userStatus: 1, userType: 'AUDITOR' })
      const panel = setup()
      await flushPromises()
      expect(panel.findAll('button').some((button) => button.text() === 'Excluir')).toBe(false)
      panel.unmount()
    })
  })
}
