<template>
  <v-app>
    <v-app-bar v-if="route.name !== 'login'" title="GeoRural DataHub" />

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
</script>