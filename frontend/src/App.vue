<script setup lang="ts">
import { ref } from 'vue'
import PhaserGame from './PhaserGame.vue'
import type { Scene } from 'phaser'

const phaserRef = ref<InstanceType<typeof PhaserGame>>()

const currentScene = (_scene: Scene) => {
  // 场景切换时的回调
}
</script>

<template>
  <PhaserGame ref="phaserRef" @current-active-scene="currentScene" />
</template>
