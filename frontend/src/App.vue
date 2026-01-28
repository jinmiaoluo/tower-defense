<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import PhaserGame from './PhaserGame.vue'
import GameOverModal from './components/GameOverModal.vue'
import LeaderboardView from './components/LeaderboardView.vue'
import StartGuide from './components/StartGuide.vue'
import ThemeToggle from './components/ThemeToggle.vue'
import LocaleToggle from './components/LocaleToggle.vue'
import LeaderboardButton from './components/LeaderboardButton.vue'
import HelpButton from './components/HelpButton.vue'
import { EventBus } from './game/EventBus'
import { gameApi, ApiError } from './api'
import { WakeLockManager } from './utils/WakeLockManager'
import { isMobileDevice } from './utils/device'
import type { Scene } from 'phaser'
import type { WaveResult, BuildingSnapshot, Action, AttackEvent } from './types'

interface GameOverData {
  score: number
  wavesCompleted: number
  sessionId: string
  isEarlyEnd: boolean
}

const gameOverModalRef = ref<InstanceType<typeof GameOverModal>>()
const leaderboardRef = ref<InstanceType<typeof LeaderboardView>>()

const showGameOver = ref(false)
const showLeaderboard = ref(false)
const showGuide = ref(StartGuide.shouldShowGuide())
const gameOverData = ref<GameOverData | null>(null)

// Screen wake lock manager (mobile only)
const wakeLockManager = isMobileDevice() ? new WakeLockManager() : null

// Store last wave data for submission
const lastWaveData = ref<{
  waveNumber: number
  actions: Action[]
  attacks: AttackEvent[]
  result: WaveResult
  buildings: BuildingSnapshot[]
} | null>(null)

const currentScene = (_scene: Scene) => {
  // Acquire screen wake lock when scene is ready
  wakeLockManager?.acquire()
}

async function handleSubmitScore(nickname: string) {
  if (!gameOverData.value) return

  try {
    // Include lastWave data only if not an early end
    const endRequest = gameOverData.value.isEarlyEnd
      ? {
          sessionId: gameOverData.value.sessionId,
          nickname,
        }
      : {
          sessionId: gameOverData.value.sessionId,
          nickname,
          lastWave: lastWaveData.value
            ? {
                waveNumber: lastWaveData.value.waveNumber,
                actions: lastWaveData.value.actions,
                attacks: lastWaveData.value.attacks,
                result: lastWaveData.value.result,
                buildings: lastWaveData.value.buildings,
              }
            : undefined,
        }

    const response = await gameApi.endGame(endRequest)

    if (response.verified && response.ranking) {
      gameOverModalRef.value?.setRankingResult(response.ranking)
    } else {
      // Handle SESSION_NOT_FOUND in mock mode
      if (response.error?.code === 'SESSION_NOT_FOUND') {
        gameOverModalRef.value?.setError('Session expired. Please restart the game.')
      } else {
        gameOverModalRef.value?.setError(response.error?.message || 'Verification failed')
      }
    }
  } catch (error) {
    // Error handling for real API mode
    if (error instanceof ApiError) {
      if (error.code === 'SESSION_NOT_FOUND') {
        gameOverModalRef.value?.setError('Session expired. Please restart the game.')
      } else {
        // Show specific error message from the server
        gameOverModalRef.value?.setError(error.message)
      }
    } else {
      // Network error or other unknown errors
      gameOverModalRef.value?.setError('Network error')
    }
  }
}

function handleViewLeaderboard() {
  showGameOver.value = false
  showLeaderboard.value = true
  leaderboardRef.value?.refresh()
}

function handleCloseLeaderboard() {
  showLeaderboard.value = false
}

function handleOpenLeaderboard() {
  showLeaderboard.value = true
  leaderboardRef.value?.refresh()
}

function handleCloseGuide() {
  showGuide.value = false
}

function handleOpenGuide() {
  showGuide.value = true
}

function handleCloseGameOver() {
  showGameOver.value = false
}

function handleRestart() {
  showGameOver.value = false
  gameOverData.value = null
  lastWaveData.value = null
  gameOverModalRef.value?.resetState()

  // Notify Game scene to restart via EventBus
  EventBus.emit('restart-game')
}

onMounted(() => {
  // Listen to game-over event
  EventBus.on('game-over', (data: {
    score: number
    wavesCompleted: number
    sessionId: string
    isEarlyEnd: boolean
    lastWaveActions?: Action[]
    lastWaveAttacks?: AttackEvent[]
    lastWaveResult?: WaveResult
    buildings?: BuildingSnapshot[]
  }) => {
    gameOverData.value = {
      score: data.score,
      wavesCompleted: data.wavesCompleted,
      sessionId: data.sessionId,
      isEarlyEnd: data.isEarlyEnd,
    }

    // Only set lastWaveData when not an early end
    // Note: waveNumber is the current wave number (wavesCompleted + 1) for API submission
    if (!data.isEarlyEnd && data.lastWaveActions && data.lastWaveResult && data.buildings) {
      lastWaveData.value = {
        waveNumber: data.wavesCompleted + 1,
        actions: data.lastWaveActions,
        attacks: data.lastWaveAttacks || [],
        result: data.lastWaveResult,
        buildings: data.buildings,
      }
    } else {
      lastWaveData.value = null
    }

    // Release screen wake lock when game ends
    wakeLockManager?.release()

    showGameOver.value = true
  })

  // Listen to show-leaderboard event (triggered from game UI button)
  EventBus.on('show-leaderboard', () => {
    showLeaderboard.value = true
    leaderboardRef.value?.refresh()
  })

  // Listen to game-restarted event and reacquire screen wake lock
  EventBus.on('game-restarted', () => {
    wakeLockManager?.acquire()
  })
})

onUnmounted(() => {
  EventBus.off('game-over')
  EventBus.off('show-leaderboard')
  EventBus.off('game-restarted')
  // Release screen wake lock when component unmounts
  wakeLockManager?.release()
})
</script>

<template>
  <div class="toolbar-container">
    <HelpButton @click="handleOpenGuide" />
    <LeaderboardButton @click="handleOpenLeaderboard" />
    <LocaleToggle />
    <ThemeToggle />
  </div>

  <PhaserGame @current-active-scene="currentScene" />

  <GameOverModal
    ref="gameOverModalRef"
    :visible="showGameOver"
    :game-data="gameOverData"
    @submit="handleSubmitScore"
    @view-leaderboard="handleViewLeaderboard"
    @close="handleCloseGameOver"
    @restart="handleRestart"
  />

  <LeaderboardView
    ref="leaderboardRef"
    :visible="showLeaderboard"
    @close="handleCloseLeaderboard"
  />

  <StartGuide
    :visible="showGuide"
    @close="handleCloseGuide"
  />
</template>

<style scoped>
.toolbar-container {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 1000;
  display: flex;
  gap: 8px;
}

@media (max-width: 480px) {
  .toolbar-container {
    top: max(8px, env(safe-area-inset-top, 8px));
    right: max(8px, env(safe-area-inset-right, 8px));
    gap: 6px;
  }
}
</style>
