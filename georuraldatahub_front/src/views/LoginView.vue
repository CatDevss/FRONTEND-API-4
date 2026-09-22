<template>
  <v-row align="center" justify="center" style="min-height: 80vh">
    <v-col cols="12" sm="8" md="4">
      <v-card class="pa-6">
        <v-card-title class="text-h5 text-center">GeoRural DataHub</v-card-title>
        <v-card-text>
          <v-text-field label="Usuário" prepend-inner-icon="mdi-account" />
          <v-text-field label="Senha" type="password" prepend-inner-icon="mdi-lock" />
          <v-btn color="primary" block size="large" @click="signIn">Entrar</v-btn>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function signIn() {
  router.push('/home')
}
</script>