<template>
  <div class="quarantine-page">
    <header class="page-heading">
      <div>
        <p class="eyebrow">QUALIDADE DOS DADOS</p>
        <h1 class="text-h5 font-weight-bold">Quarentena</h1>
        <p class="text-body-2 text-medium-emphasis mt-1">
          Acompanhe as rejeições, assuma uma correção e registre sua análise.
        </p>
      </div>
      <v-btn
        variant="outlined"
        prepend-icon="mdi-refresh"
        :loading="loading || detailLoading"
        :disabled="busy || loading || detailLoading || !ready"
        @click="refresh"
        >Atualizar</v-btn
      >
    </header>
    <div class="quarantine-notice">
      <v-icon icon="mdi-shield-alert-outline" size="21" />
      <p>
        Resolver uma quarentena encerra a análise.
        <strong>Isso não aprova os dados rejeitados.</strong> O motivo e o relatório original são
        preservados.
      </p>
    </div>
    <v-alert v-if="!ready" type="warning" variant="tonal" class="mb-4"
      >Identifique um usuário ativo pelo mecanismo de sessão existente para consultar a
      quarentena.</v-alert
    >
    <div class="quarantine-layout">
      <section class="quarantine-library" aria-label="Listagem de quarentenas">
        <v-tabs v-model="scope" color="primary" density="compact" class="scope-tabs">
          <v-tab value="all" :disabled="busy">Todas</v-tab>
          <v-tab value="available" :disabled="busy">Disponíveis</v-tab>
          <v-tab value="mine" :disabled="busy || !ready">Minhas análises</v-tab>
        </v-tabs>
        <div class="list-toolbar">
          <v-select
            v-model="status"
            :items="quarantineStatuses"
            item-title="title"
            item-value="value"
            label="Status"
            variant="outlined"
            density="compact"
            hide-details
            clearable
            :disabled="busy || !ready"
            class="status-filter"
          />
          <v-select
            v-model="size"
            :items="[20, 50, 100]"
            label="Por página"
            variant="outlined"
            density="compact"
            hide-details
            :disabled="busy || !ready"
            class="size-filter"
          />
        </div>
        <div class="list-context">
          <span v-if="!loading" role="status"
            >{{ totalElements }}
            {{ totalElements === 1 ? 'análise encontrada' : 'análises encontradas' }}</span
          >
          <span v-else>Consultando quarentena…</span>
          <v-chip
            v-if="fileId !== null"
            size="small"
            closable
            :disabled="busy"
            @click:close="clearFileFilter"
            >Arquivo #{{ fileId }}</v-chip
          >
        </div>
        <v-alert
          v-if="listError"
          type="error"
          variant="tonal"
          density="compact"
          class="panel-error"
          role="alert"
          >{{ listError
          }}<v-btn variant="text" size="small" :disabled="busy || loading" @click="loadList"
            >Tentar novamente</v-btn
          ></v-alert
        >
        <v-progress-linear
          v-if="loading"
          indeterminate
          color="primary"
          height="2"
          aria-label="Carregando quarentenas"
        />
        <v-table v-if="rows.length" class="quarantine-table">
          <thead>
            <tr>
              <th>Arquivo / fonte</th>
              <th>Status</th>
              <th>Responsável / entrada</th>
              <th><span class="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="entry in rows"
              :key="entry.id"
              :class="{ 'is-selected': selectedId === entry.id }"
            >
              <td>
                <div class="row-identity">
                  <v-icon icon="mdi-file-alert-outline" size="20" />
                  <div>
                    <strong>{{ entry.fileName || 'Arquivo não vinculado' }}</strong
                    ><span>{{ entry.sourceName || 'Fonte não informada' }}</span>
                  </div>
                </div>
              </td>
              <td>
                <v-chip :color="statusColor(entry.status)" size="x-small" variant="tonal">{{
                  quarantineStatus(entry.status)
                }}</v-chip>
              </td>
              <td>
                <div class="row-dates">
                  <span>{{
                    entry.responsibleId === null
                      ? quarantineClosed(entry)
                        ? 'Sem responsável'
                        : 'Disponível'
                      : entry.responsibleName || `Usuário #${entry.responsibleId}`
                  }}</span
                  ><time :datetime="entry.dateEntry || undefined">{{
                    quarantineDate(entry.dateEntry)
                  }}</time>
                </div>
              </td>
              <td>
                <v-btn
                  variant="text"
                  size="small"
                  :data-quarantine-id="entry.id"
                  :aria-label="`Ver detalhes da quarentena ${entry.id}`"
                  :disabled="busy"
                  @click="select(entry.id)"
                  >Detalhes</v-btn
                >
              </td>
            </tr>
          </tbody>
        </v-table>
        <div v-else class="list-empty">
          <v-icon
            :icon="loading ? 'mdi-shield-sync-outline' : 'mdi-shield-search'"
            color="primary"
            size="34"
          />
          <h2>
            {{
              loading
                ? 'Carregando análises'
                : listError
                  ? 'Lista indisponível'
                  : 'Nenhuma quarentena encontrada'
            }}
          </h2>
          <p>
            {{
              loading
                ? 'Consultando os registros no backend.'
                : listError
                  ? 'Confira a mensagem da API e tente novamente.'
                  : 'Não há registros para os filtros selecionados.'
            }}
          </p>
        </div>
        <footer class="list-pagination">
          <span>Página {{ totalPages ? page + 1 : 0 }} de {{ totalPages }}</span>
          <v-pagination
            v-if="totalPages > 1"
            :model-value="page + 1"
            :length="totalPages"
            :total-visible="4"
            density="compact"
            :disabled="busy || loading"
            @update:model-value="changePage($event - 1)"
          />
        </footer>
      </section>

      <section
        class="quarantine-detail"
        aria-label="Detalhes da quarentena"
        :aria-busy="detailLoading || busy"
      >
        <div class="detail-toolbar">
          <p class="eyebrow">
            {{ selectedId !== null ? `ANÁLISE #${selectedId}` : 'DETALHES DA ANÁLISE' }}
          </p>
          <v-btn
            v-if="selectedId !== null"
            icon="mdi-refresh"
            variant="text"
            size="small"
            aria-label="Atualizar detalhes"
            :disabled="busy || detailLoading"
            @click="loadDetail(selectedId, true)"
          />
        </div>
        <v-progress-linear
          v-if="detailLoading"
          indeterminate
          color="primary"
          class="mb-4"
          aria-label="Carregando análise"
        />
        <v-alert
          v-if="detailError"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-4"
          role="alert"
          >{{ detailError
          }}<v-btn
            v-if="selectedId !== null"
            variant="text"
            size="small"
            :disabled="busy || detailLoading"
            @click="loadDetail(selectedId, true)"
            >Tentar novamente</v-btn
          ></v-alert
        >
        <template v-if="detail">
          <div class="detail-heading">
            <h2>{{ detail.fileName || 'Arquivo não vinculado' }}</h2>
            <v-chip :color="statusColor(detail.status)" size="small" variant="tonal">{{
              quarantineStatus(detail.status)
            }}</v-chip>
          </div>
          <p class="detail-source">{{ detail.sourceName || 'Fonte não informada' }}</p>
          <dl class="detail-metadata">
            <div>
              <dt>Responsável</dt>
              <dd>
                {{
                  detail.responsibleId === null
                    ? 'Sem responsável'
                    : detail.responsibleName || `Usuário #${detail.responsibleId}`
                }}
              </dd>
            </div>
            <div>
              <dt>Ingestão</dt>
              <dd>
                {{ detail.ingestionId === null ? 'Não informada' : `#${detail.ingestionId}` }}
              </dd>
            </div>
            <div>
              <dt>Entrada</dt>
              <dd>{{ quarantineDate(detail.dateEntry) }}</dd>
            </div>
            <div>
              <dt>Resolução</dt>
              <dd>{{ quarantineDate(detail.dateResolution) }}</dd>
            </div>
          </dl>
          <div class="detail-section">
            <h3>Motivo original</h3>
            <p class="preserve-text">{{ detail.reason || 'Motivo não informado.' }}</p>
          </div>
          <div class="report-access">
            <v-btn
              v-if="detail.validationReportUrl"
              variant="tonal"
              color="primary"
              prepend-icon="mdi-clipboard-text-outline"
              :disabled="detailLoading || reportLoading"
              :loading="reportLoading"
              @click="showReport"
              >Relatório de validação</v-btn
            >
            <p v-else>Relatório de validação não disponível para este registro.</p>
          </div>
          <v-alert
            v-if="actionError"
            type="error"
            variant="tonal"
            density="compact"
            class="mt-4"
            role="alert"
            >{{ actionError }}</v-alert
          >
          <v-alert
            v-if="actionMessage"
            type="info"
            variant="tonal"
            density="compact"
            class="mt-4"
            role="status"
            >{{ actionMessage }}</v-alert
          >
          <div class="detail-section observation-section">
            <h3>Observação da análise</h3>
            <template v-if="canEdit">
              <v-textarea
                v-model="treatment"
                label="Observação (obrigatória)"
                variant="outlined"
                rows="4"
                auto-grow
                :disabled="busy"
                :error-messages="
                  treatment.length && observationError ? observationError : undefined
                "
                hint="Descreva o que está fazendo. Limite de 500 bytes UTF-8, incluindo acentos."
                persistent-hint
                class="observation-input"
              />
              <div
                class="observation-counter"
                :class="{ 'over-limit': treatmentBytes(treatment) > 500 }"
                role="status"
              >
                {{ treatmentBytes(treatment) }} / 500 bytes UTF-8<span v-if="dirty">
                  · Alterações ainda não salvas</span
                >
              </div>
              <div class="observation-actions">
                <v-btn
                  variant="outlined"
                  :disabled="busy || !!observationError || !dirty"
                  :loading="busy"
                  @click="act('observacao')"
                  >Salvar observação</v-btn
                ><v-btn
                  color="primary"
                  prepend-icon="mdi-check"
                  :disabled="busy || !!observationError"
                  @click="requestResolve"
                  >Resolver análise</v-btn
                >
              </div>
            </template>
            <template v-else>
              <p class="preserve-text">
                {{ detail.treatment || 'Nenhuma observação registrada.' }}
              </p>
              <p v-if="quarantineClosed(detail)" class="read-only-note">
                <v-icon icon="mdi-lock-outline" size="16" />Análise encerrada, disponível somente
                para leitura.
              </p>
              <p
                v-else-if="detail.responsibleId !== null && detail.responsibleId !== currentUserId"
                class="read-only-note"
              >
                <v-icon icon="mdi-account-lock-outline" size="16" />Esta correção está com outra
                pessoa. Os detalhes estão disponíveis para consulta.
              </p>
              <p v-else-if="!can('quarantine.manage')" class="read-only-note">
                Seu perfil tem acesso de consulta. O Operador acompanha as correções.
              </p>
              <v-btn
                v-if="canClaim"
                color="primary"
                prepend-icon="mdi-account-check-outline"
                :disabled="busy"
                :loading="busy"
                class="mt-4"
                @click="act('assumir')"
                >Assumir correção</v-btn
              >
            </template>
          </div>
          <p
            v-if="!loading && !listError && !rows.some((entry) => entry.id === selectedId)"
            class="outside-list-note"
          >
            Esta análise não está entre os resultados desta página ou dos filtros atuais.
          </p>
        </template>
        <div v-else-if="!detailError" class="detail-empty">
          <v-icon icon="mdi-text-box-search-outline" size="36" />
          <h2>{{ detailLoading ? 'Consultando análise' : 'Selecione uma quarentena' }}</h2>
          <p>Consulte o motivo e o relatório antes de iniciar a correção.</p>
        </div>
      </section>
    </div>
    <ConfirmDialog
      v-model="confirmResolve"
      title="Encerrar análise da quarentena?"
      :message="`Encerrar a análise de ${detail?.fileName || 'este registro'} com a observação: ${treatment.trim()}? Resolver a quarentena NÃO aprova os dados rejeitados. O motivo e o relatório original permanecem preservados.`"
      @confirm="act('resolver')"
    />
    <v-dialog v-model="reportOpen" max-width="1100">
      <v-card title="Relatório original de validação">
        <v-card-text>
          <p class="text-body-2 mb-3">
            Este relatório é preservado mesmo depois de encerrar a análise da quarentena.
          </p>
          <v-progress-linear v-if="reportLoading" indeterminate color="primary" />
          <v-alert v-if="reportError" type="error" variant="tonal" role="alert"
            >{{ reportError
            }}<v-btn variant="text" :disabled="reportLoading" @click="showReport"
              >Tentar novamente</v-btn
            ></v-alert
          >
          <ValidationResult v-if="report" :report="report" :show-quarantine-link="false" />
          <p v-else-if="!reportLoading && !reportError">
            Relatório indisponível. Não presuma aprovação dos dados.
          </p>
        </v-card-text>
        <v-card-actions
          ><v-spacer /><v-btn @click="reportOpen = false">Fechar</v-btn></v-card-actions
        >
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { can, currentUserId } from '@/access/session'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ValidationResult from '@/components/ValidationResult.vue'
import { useQuarantine } from '@/composables/useQuarantine'
import {
  quarantineClosed,
  quarantineDate,
  quarantineStatus,
  quarantineStatuses,
  treatmentBytes,
} from '@/services/quarantine'

const {
  scope,
  status,
  page,
  size,
  rows,
  totalElements,
  totalPages,
  loading,
  listError,
  selectedId,
  detail,
  detailLoading,
  detailError,
  treatment,
  busy,
  actionError,
  actionMessage,
  confirmResolve,
  reportOpen,
  reportLoading,
  reportError,
  report,
  fileId,
  ready,
  canClaim,
  canEdit,
  observationError,
  dirty,
  loadList,
  loadDetail,
  select,
  refresh,
  changePage,
  requestResolve,
  act,
  showReport,
  clearFileFilter,
} = useQuarantine()
function statusColor(value: string | null) {
  return value === 'ARQUIVO_REJEITADO'
    ? 'error'
    : value === 'REGISTROS_REJEITADOS'
      ? 'warning'
      : value === 'EM_ANALISE'
        ? 'primary'
        : undefined
}
</script>

<style scoped>
.quarantine-page {
  max-width: 1500px;
  margin: auto;
}
.page-heading,
.detail-heading,
.detail-toolbar,
.list-context,
.list-pagination,
.observation-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.page-heading {
  margin-bottom: 24px;
}
.eyebrow {
  color: rgb(var(--v-theme-primary));
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  margin-bottom: 6px;
}
.quarantine-notice {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 20px;
  margin-bottom: 24px;
  border: 1px solid rgba(var(--v-theme-primary), 0.18);
  border-radius: 14px;
  background: rgba(var(--v-theme-primary), 0.035);
}
.quarantine-notice > .v-icon {
  color: rgb(var(--v-theme-primary));
  flex-shrink: 0;
  margin-top: 2px;
}
.quarantine-notice p {
  font-size: 12px;
  line-height: 1.8;
  color: rgba(var(--v-theme-on-surface), 0.65);
}
.quarantine-notice strong {
  color: rgba(var(--v-theme-on-surface), 0.85);
  font-weight: 500;
}
.quarantine-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}
.quarantine-library,
.quarantine-detail {
  min-width: 0;
  border: 1px solid var(--glass-outer-border);
  border-radius: 18px;
  background: rgba(var(--v-theme-surface), 0.45);
  overflow: hidden;
}
.scope-tabs {
  padding: 8px 12px 0;
  border-bottom: 1px solid var(--glass-outer-border);
}
.scope-tabs :deep(.v-tab),
:deep(.v-btn) {
  text-transform: none;
  letter-spacing: 0;
}
.list-toolbar {
  display: flex;
  gap: 12px;
  padding: 20px 20px 12px;
}
.status-filter {
  flex: 1;
  min-width: 150px;
}
.size-filter {
  flex: 0 0 110px;
}
.list-context {
  padding: 0 20px 16px;
  color: rgba(var(--v-theme-on-surface), 0.55);
  font-size: 11px;
}
.panel-error {
  margin: 0 20px 16px;
}
.quarantine-table {
  background: transparent;
}
.quarantine-table :deep(th) {
  font-size: 10px;
  color: rgba(var(--v-theme-on-surface), 0.5);
  white-space: nowrap;
}
.quarantine-table :deep(td) {
  padding: 16px 12px;
}
.is-selected {
  background: rgba(var(--v-theme-primary), 0.05);
}
.row-identity {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 150px;
}
.row-identity > .v-icon {
  color: rgba(var(--v-theme-on-surface), 0.5);
  flex-shrink: 0;
}
.row-identity > div,
.row-dates {
  display: grid;
  gap: 5px;
}
.row-identity strong {
  font-size: 12px;
  font-weight: 500;
  overflow-wrap: anywhere;
}
.row-identity span,
.row-dates time {
  font-size: 10px;
  color: rgba(var(--v-theme-on-surface), 0.5);
}
.row-dates > span {
  font-size: 11px;
}
.row-dates time {
  white-space: nowrap;
}
.list-empty,
.detail-empty {
  min-height: 270px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 32px 20px;
  gap: 12px;
}
.list-empty h2,
.detail-empty h2 {
  font-size: 15px;
  font-weight: 500;
}
.list-empty p,
.detail-empty p {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.55);
  line-height: 1.7;
}
.list-pagination {
  padding: 12px 20px;
  border-top: 1px solid var(--glass-outer-border);
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.quarantine-detail {
  padding: 24px;
}
.detail-toolbar {
  margin-bottom: 12px;
}
.detail-heading {
  align-items: flex-start;
}
.detail-heading h2 {
  font-size: 18px;
  font-weight: 500;
  overflow-wrap: anywhere;
  min-width: 0;
  flex: 1;
}
.detail-source {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.55);
  margin-top: 8px;
}
.detail-metadata {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  padding: 24px 0;
  border-bottom: 1px solid var(--glass-outer-border);
}
.detail-metadata dt {
  font-size: 10px;
  color: rgba(var(--v-theme-on-surface), 0.5);
  margin-bottom: 6px;
}
.detail-metadata dd {
  font-size: 12px;
  overflow-wrap: anywhere;
}
.detail-section {
  padding-top: 22px;
}
.detail-section h3 {
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 12px;
}
.preserve-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 12px;
  line-height: 1.8;
  color: rgba(var(--v-theme-on-surface), 0.7);
}
.report-access {
  margin-top: 20px;
}
.report-access p,
.outside-list-note {
  font-size: 11px;
  line-height: 1.7;
  color: rgba(var(--v-theme-on-surface), 0.5);
}
.observation-section {
  border-top: 1px solid var(--glass-outer-border);
  margin-top: 24px;
}
.observation-input :deep(.v-messages) {
  font-size: 10px;
  line-height: 1.6;
}
.observation-counter {
  font-size: 10px;
  color: rgba(var(--v-theme-on-surface), 0.5);
  margin: 8px 0 18px;
}
.over-limit {
  color: rgb(var(--v-theme-error));
}
.observation-actions {
  justify-content: flex-start;
  gap: 8px;
}
.read-only-note {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  font-size: 11px;
  line-height: 1.7;
  color: rgba(var(--v-theme-on-surface), 0.5);
  margin-top: 18px;
}
.read-only-note > .v-icon {
  flex-shrink: 0;
  margin-top: 2px;
}
.outside-list-note {
  border-top: 1px solid var(--glass-outer-border);
  padding-top: 16px;
  margin-top: 24px;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
@media (max-width: 1150px) {
  .quarantine-layout {
    grid-template-columns: 1fr;
    gap: 18px;
  }
}
@media (max-width: 550px) {
  .list-toolbar {
    flex-wrap: wrap;
    padding: 16px 12px;
  }
  .quarantine-detail {
    padding: 18px;
  }
  .detail-metadata {
    grid-template-columns: 1fr;
    gap: 14px;
  }
  .quarantine-notice {
    padding: 14px;
  }
  .observation-actions > .v-btn {
    width: 100%;
  }
}
</style>
