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
import { useI18n } from './i18n'

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

// -- i18n --

const { t } = useI18n()

// -- Template refs --

const gameOverModalRef = ref<InstanceType<typeof GameOverModal>>()
const leaderboardRef = ref<InstanceType<typeof LeaderboardView>>()

// -- State --

const showGameOver = ref(false)
const showLeaderboard = ref(false)
const showGuide = ref(StartGuide.shouldShowGuide())
const gameOverData = ref<GameOverData | null>(null)

// Screen wake lock manager (mobile only)
const wakeLockManager = isMobileDevice() ? new WakeLockManager() : null

const lastWaveData = ref<{
  waveNumber: number
  actions: Action[]
  attacks: AttackEvent[]
  result: WaveResult
  buildings: BuildingSnapshot[]
} | null>(null)

// -- Helpers --

function buildEndRequest(data: GameOverData, nickname: string) {
  if (data.isEarlyEnd) {
    return { sessionId: data.sessionId, nickname }
  }

  return {
    sessionId: data.sessionId,
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
}

// -- Event handlers --

function handleSceneReady(_scene: Scene) {
  wakeLockManager?.acquire()
}

async function handleSubmitScore(nickname: string) {
  if (!gameOverData.value) return

  try {
    const response = await gameApi.endGame(buildEndRequest(gameOverData.value, nickname))

    if (response.verified && response.ranking) {
      gameOverModalRef.value?.setRankingResult(response.ranking)
    } else {
      gameOverModalRef.value?.setError('Verification failed')
    }
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.isSessionNotFound()) {
        gameOverModalRef.value?.setError(t('error_session_expired'))
        setTimeout(() => {
          handleRestart()
        }, 2000)
      } else if (error.code === 'VALIDATION_FAILED') {
        gameOverModalRef.value?.setError(t('error_validation_failed'))
      } else {
        gameOverModalRef.value?.setError(error.message || t('error_network'))
      }
    } else {
      gameOverModalRef.value?.setError(t('error_network'))
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
  EventBus.emit('restart-game')
}

// -- Lifecycle --

onMounted(() => {
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

    // waveNumber is the current wave number (wavesCompleted + 1) for API submission
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

    wakeLockManager?.release()
    showGameOver.value = true
  })

  // Triggered from in-game UI button
  EventBus.on('show-leaderboard', () => {
    showLeaderboard.value = true
    leaderboardRef.value?.refresh()
  })

  EventBus.on('game-restarted', () => {
    wakeLockManager?.acquire()
  })
})

onUnmounted(() => {
  EventBus.off('game-over')
  EventBus.off('show-leaderboard')
  EventBus.off('game-restarted')
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

  <PhaserGame @current-active-scene="handleSceneReady" />

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
