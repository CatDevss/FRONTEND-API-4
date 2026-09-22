<template>
  <v-dialog v-model="model" max-width="480">
    <v-card :title="title">
      <v-card-text>{{ message }}</v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn @click="model = false">Cancelar</v-btn>
        <v-btn color="primary" variant="flat" @click="confirm">Confirmar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
defineProps<{ title: string; message: string }>()
const emit = defineEmits<{ confirm: [] }>()
const model = defineModel<boolean>({ default: false })

function confirm() {
  model.value = false
  emit('confirm')
}
</script>