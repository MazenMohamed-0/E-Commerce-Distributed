<template>
    <v-app-bar
      :color="isDark ? 'rgb(17, 24, 39)' : 'white'"
      :elevation="2"
      class="px-3"
    >
      <!-- Back button -->
      <v-btn
        icon
        variant="text"
        @click="goBack"
        v-if="showBackButton"
      >
        <v-icon>mdi-arrow-left</v-icon>
      </v-btn>
  
      <!-- Logo -->
      <div class="d-flex align-center">
        <v-icon size="32" color="primary" class="mr-2">mdi-alpha-s-box</v-icon>
        <span class="text-h6 font-weight-bold" :class="isDark ? 'text-white' : ''">Solid</span>
      </div>
  
      <v-spacer></v-spacer>
  
      <!-- Theme toggle -->
      <v-btn
        icon
        variant="text"
        @click="toggleTheme"
        :color="isDark ? 'white' : 'black'"
      >
        <v-icon>{{ isDark ? 'mdi-weather-sunny' : 'mdi-weather-night' }}</v-icon>
      </v-btn>
    </v-app-bar>
  </template>
  
  <script setup>
  import { computed } from 'vue'
  import { useRouter } from 'vue-router'
  import { useTheme } from 'vuetify'
  
  const props = defineProps({
    showBackButton: {
      type: Boolean,
      default: true
    }
  })
  
  const router = useRouter()
  const theme = useTheme()
  
  const isDark = computed(() => theme.global.current.value.dark)
  
  const toggleTheme = () => {
    theme.global.name.value = isDark.value ? 'light' : 'dark'
  }
  
  const goBack = () => {
    router.push('/')
  }
  </script> 