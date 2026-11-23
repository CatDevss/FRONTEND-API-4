<template>
  <v-row align="center" justify="center" style="min-height: 80vh">
    <v-col cols="12" sm="8" md="4">
      <v-card class="pa-6">
        <v-card-title class="text-h5 text-center">GeoRural DataHub</v-card-title>
        <v-card-text>
          <p class="text-center mb-6">Acesse com o seu usuário institucional.</p>
          <v-alert v-if="authError" type="error" variant="tonal" class="mb-4" role="alert">
            {{ authError }}
          </v-alert>
          <v-btn
            color="primary"
            block
            size="large"
            prepend-icon="mdi-login"
            :loading="!authReady"
            @click="signIn"
            >Entrar</v-btn
          >
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { authError, authReady, keycloakEnabled, login } from '@/access/keycloak'

const router = useRouter()

function signIn() {
  // Com o Keycloak, abre a tela de login dele; sem ele, segue com a prévia de cargo.
  if (keycloakEnabled) void login()
  else void router.push('/home')
}
</script>
