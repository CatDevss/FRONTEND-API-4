<template>
  <v-card class="pa-6"
    ><h1 class="text-h5 mb-3">Acesso indisponível</h1>
    <p>
      {{
        sessionUser
          ? 'Seu cargo não tem acesso à página solicitada.'
          : 'O usuário e o cargo da sessão ainda não foram fornecidos pelo login.'
      }}
    </p>
    <v-btn v-if="firstPage" :to="firstPage" class="mt-4">Abrir página disponível</v-btn></v-card
  >
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { sessionUser, allowedNavigation } from '@/access/session'
const firstPage = computed(() => allowedNavigation()[0]?.to)
</script>
