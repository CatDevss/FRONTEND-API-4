import type { FileStage, ValidationReport, VersionStatus } from './contracts'

export function isLegacyValidatedStage(stage: FileStage): boolean {
  return (
    stage.status === 'BRUTA' && stage.versionNumber > 1 && !!stage.location?.startsWith('validada/')
  )
}

export interface LegacyFlow {
  status: VersionStatus | null
  label: string
  note: string
}

// Versões antigas eram gravadas em validada/ sem atualizar o enum BRUTA.
// O caminho sozinho não comprova aprovação integral nem uma mudança de zona.
export function resolveLegacyFlow(report?: ValidationReport): LegacyFlow {
  if (
    report?.status === 'VALIDO' &&
    Number.isInteger(report.validRecords) &&
    report.validRecords > 0 &&
    report.rejectedRecords === 0
  ) {
    return {
      status: 'TRATADA',
      label: 'Tratada',
      note: 'Versão legada em validada/: aprovação integral confirmada pelo relatório. A API ainda informa BRUTA.',
    }
  }
  return {
    status: null,
    label: report?.status === 'PARCIAL' ? 'Validação parcial · legado' : 'Etapa não confirmada',
    note: 'Versão legada em validada/ com status BRUTA inconsistente. Não há confirmação de aprovação integral; consulte a validação e a quarentena.',
  }
}
