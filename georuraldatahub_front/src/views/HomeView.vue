<template>
  <v-app>
    <v-navigation-drawer v-if="route.name !== 'login'" permanent color="#2D2D2D" theme="dark">
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
  </v-app>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()

const menuItems = [
  { title: 'Início', icon: 'mdi-home-outline', to: '/home', disabled: false },
  { title: 'Acompanhar carga', icon: 'mdi-progress-clock', to: '/load-tracking', disabled: true },
  { title: 'Reconciliar esquema', icon: 'mdi-swap-horizontal', to: '/reconciliation', disabled: true },
  { title: 'Quarentena', icon: 'mdi-alert-outline', to: '/quarantine', disabled: true },
]
</script>