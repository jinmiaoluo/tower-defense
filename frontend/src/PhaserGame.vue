<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type { Game, Scene } from 'phaser'
import { EventBus } from './game/EventBus'
import StartGame from './game/main'

const scene = ref<Scene>()
const game = ref<Game>()

const emit = defineEmits<{
  'current-active-scene': [scene: Scene]
}>()

onMounted(() => {
  game.value = StartGame('game-container')

  EventBus.on('current-scene-ready', (currentScene: Scene) => {
    emit('current-active-scene', currentScene)
    scene.value = currentScene
  })
})

onUnmounted(() => {
  if (game.value) {
    game.value.destroy(true)
    game.value = undefined
  }
})

defineExpose({ scene, game })
</script>

<template>
  <div id="game-container"></div>
</template>
