<template>
  <v-app>
    <v-navigation-drawer
      v-if="$route.name !== 'login'"
      id="main-navigation"
      permanent
      :rail="sidebarCollapsed"
      :rail-width="64"
      :width="260"
      theme="dark"
      class="custom-drawer"
    >
      <div
        class="navigation-heading"
        :class="{ 'navigation-heading--collapsed': sidebarCollapsed }"
      >
        <span v-if="!sidebarCollapsed" class="navigation-brand">GeoRural DataHub</span>
        <v-btn
          :icon="sidebarCollapsed ? 'mdi-menu' : 'mdi-menu-open'"
          variant="text"
          size="small"
          :aria-label="sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'"
          :title="sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'"
          :aria-expanded="!sidebarCollapsed"
          aria-controls="main-navigation"
          @click="sidebarCollapsed = !sidebarCollapsed"
        />
      </div>
      <v-divider />

      <v-list nav>
        <v-tooltip
          v-for="item in menuItems"
          :key="item.title"
          :text="item.title"
          location="right"
          :disabled="!sidebarCollapsed"
        >
          <template #activator="{ props }">
            <v-list-item
              v-bind="props"
              :title="item.title"
              :aria-label="item.title"
              :prepend-icon="item.icon"
              :to="item.to"
            />
          </template>
        </v-tooltip>
      </v-list>

      <template #append>
        <v-list nav>
          <v-tooltip :text="sessionLabel" location="right" :disabled="!sidebarCollapsed">
            <template #activator="{ props }">
              <v-list-item
                v-bind="props"
                :title="sessionLabel"
                :aria-label="sessionLabel"
                prepend-icon="mdi-account-circle-outline"
                :tabindex="sidebarCollapsed ? 0 : undefined"
              />
            </template>
          </v-tooltip>
          <v-tooltip text="Sair" location="right" :disabled="!sidebarCollapsed">
            <template #activator="{ props }">
              <v-list-item
                v-bind="props"
                title="Sair"
                aria-label="Sair"
                prepend-icon="mdi-logout"
                to="/"
                @click="logout"
              />
            </template>
          </v-tooltip>
        </v-list>
      </template>
    </v-navigation-drawer>

    <v-main>
      <v-container
        :fluid="$route.name === 'home'"
        :class="{ 'workspace-container': $route.name === 'home' }"
      >
        <DevelopmentSession
          v-if="development"
          compact
          :class="{ 'mb-5': $route.name !== 'home' }"
        />
        <RouterView :key="`${sessionUser?.id}-${sessionUser?.userType}`" />
      </v-container>
    </v-main>

    <!-- Barra de progresso do envio, visível em qualquer tela -->
    <div v-if="isUploadInProgress" class="upload-bar">
      <div class="upload-bar-info">
        <span class="text-body-2">
          Enviando "{{ currentFileName }}" — {{ completedFiles }} de {{ totalFiles }}
        </span>
        <v-btn size="small" variant="text" color="error" @click="cancelUpload">Cancelar</v-btn>
      </div>
      <v-progress-linear :model-value="overallProgress" color="primary" height="6" />
    </div>

    <v-snackbar v-model="uploadSnackbarVisible" :timeout="4000">
      {{ uploadSnackbarMessage }}
    </v-snackbar>
  </v-app>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import DevelopmentSession from '@/components/DevelopmentSession.vue'
import { selectPreviewUser } from '@/access/developmentSession'
import { useWorkspaceStore } from '@/stores/workspace'
import { useRoute, useRouter } from 'vue-router'
import { allowedNavigation, sessionUser, setSessionUser, can } from '@/access/session'
import {
  isUploadInProgress,
  currentFileName,
  completedFiles,
  totalFiles,
  overallProgress,
  cancelUpload,
  uploadSnackbarVisible,
  uploadSnackbarMessage,
} from '@/composables/uploadLock'

function logout() {
  if (import.meta.env.DEV) selectPreviewUser(null)
  setSessionUser(null)
}

const workspace = useWorkspaceStore()
const route = useRoute(),
  router = useRouter()
watch(
  () => sessionUser.value,
  () => {
    cancelUpload()
    workspace.reset()
    if (route.meta.permission && !can(route.meta.permission))
      void router.replace(allowedNavigation()[0]?.to ?? '/access-required')
  },
)
const development = import.meta.env.DEV
const sidebarCollapsed = ref(false)
const sessionLabel = computed(() =>
  sessionUser.value ? `${sessionUser.value.name} — ${sessionUser.value.userType}` : 'Sem sessão',
)
const menuItems = computed(allowedNavigation)
</script>

<style scoped>
.workspace-container {
  height: calc(100dvh - var(--v-layout-top, 0px) - var(--v-layout-bottom, 0px));
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Aplica margem e espaçamento nas bordas apenas para as outras views (que não são a home) */
.v-container:not(.workspace-container) {
  padding: 32px !important; 
  max-width: 1400px; 
}

.custom-drawer {
  background-color: #080605 !important;
}

.navigation-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 64px;
  padding: 12px 16px;
}

.navigation-heading--collapsed {
  justify-content: center;
  padding: 12px 8px;
}

.navigation-brand {
  color: #ffb066;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

.upload-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 3000;
  background: rgba(15, 11, 10, 0.8);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
  backdrop-filter: blur(20px) saturate(140%);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  color: white;
  padding: 8px 16px 0;
}

.upload-bar-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
