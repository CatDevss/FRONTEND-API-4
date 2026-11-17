<template>
  <RouterView v-slot="{ Component, route }" :key="`${sessionUser?.id}-${sessionUser?.userType}`">
    <KeepAlive :include="pages" :max="7">
      <component
        :is="Component"
        :key="route.name ?? route.path"
        v-if="!route.meta.permission || can(route.meta.permission)"
      />
    </KeepAlive>
  </RouterView>
</template>
<script setup lang="ts">
import { can, sessionUser } from '@/access/session'

// Reutiliza a página por usuário e perfil, inclusive ao mudar os filtros.
const pages = [
  'HomeView',
  'NewLoadView',
  'FileUploadsView',
  'DictionariesView',
  'QuarantineView',
  'SourcesView',
  'DatasetsView',
]
</script>
