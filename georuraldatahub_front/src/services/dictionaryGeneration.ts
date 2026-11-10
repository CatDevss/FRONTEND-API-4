import type { Dictionary } from './contracts'

export interface GeneratedDictionary {
  dictionary: Dictionary
  filename: string
  sha256: string
  validation: {
    status: 'VALIDO' | 'REJEITADO'
    validRecords: number
    rejectedRecords: number
    issues: { recordIndex: number; errors: string[] }[]
  }
  warnings: string[]
}
