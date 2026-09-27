<template>
  <v-app>
    <v-navigation-drawer v-if="$route.name !== 'login'" permanent color="#2D2D2D" theme="dark">
      <v-list-item title="GeoRural DataHub" class="py-4" />
      <v-divider />

      <v-list nav>
        <v-list-item
          v-for="item in menuItems"
          :key="item.title"
          :title="item.title"
          :prepend-icon="item.icon"
          :to="item.disabled ? undefined : item.to"
          :disabled="item.disabled"
        />
      </v-list>

      <template #append>
        <v-list nav>
          <v-list-item title="Sair" prepend-icon="mdi-logout" to="/" />
        </v-list>
      </template>
    </v-navigation-drawer>

    <v-main>
      <v-container>
        <RouterView />
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

const menuItems = [
  { title: 'Início', icon: 'mdi-home-outline', to: '/home', disabled: false },
  { title: 'Nova carga', icon: 'mdi-plus-circle-outline', to: '/new-load', disabled: false },
  { title: 'Arquivos enviados', icon: 'mdi-file-check-outline', to: '/file-uploads', disabled: false },
  { title: 'Acompanhar carga', icon: 'mdi-progress-clock', to: '/load-tracking', disabled: true },
  { title: 'Reconciliar esquema', icon: 'mdi-swap-horizontal', to: '/reconciliation', disabled: true },
  { title: 'Quarentena', icon: 'mdi-alert-outline', to: '/quarantine', disabled: true },
]
</script>

<style scoped>
.upload-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 3000;
  background: #2d2d2d;
  color: white;
  padding: 8px 16px 0;
}

.upload-bar-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>