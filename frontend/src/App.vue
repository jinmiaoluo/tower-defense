<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import PhaserGame from './PhaserGame.vue'
import GameOverModal from './components/GameOverModal.vue'
import LeaderboardView from './components/LeaderboardView.vue'
import ThemeToggle from './components/ThemeToggle.vue'
import LocaleToggle from './components/LocaleToggle.vue'
import LeaderboardButton from './components/LeaderboardButton.vue'
import { EventBus } from './game/EventBus'
import { gameApi, ApiError } from './api'
import type { Scene } from 'phaser'
import type { WaveResult, BuildingSnapshot, Action, AttackEvent } from './types'

interface GameOverData {
  score: number
  wave: number
  sessionId: string
  isEarlyEnd: boolean
}

const phaserRef = ref<InstanceType<typeof PhaserGame>>()
const gameOverModalRef = ref<InstanceType<typeof GameOverModal>>()
const leaderboardRef = ref<InstanceType<typeof LeaderboardView>>()

const showGameOver = ref(false)
const showLeaderboard = ref(false)
const gameOverData = ref<GameOverData | null>(null)

// 存储最后一波的数据，用于提交
const lastWaveData = ref<{
  waveNumber: number
  actions: Action[]
  attacks: AttackEvent[]
  result: WaveResult
  buildings: BuildingSnapshot[]
} | null>(null)

const currentScene = (_scene: Scene) => {
  // 场景切换时的回调
}

async function handleSubmitScore(nickname: string) {
  if (!gameOverData.value) return

  try {
    // 根据是否提前结束决定是否包含 lastWave 数据
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
      // Mock 模式下的 SESSION_NOT_FOUND 处理
      if (response.error?.code === 'SESSION_NOT_FOUND') {
        gameOverModalRef.value?.setError('Session expired. Please restart the game.')
      } else {
        gameOverModalRef.value?.setError(response.error?.message || 'Verification failed')
      }
    }
  } catch (error) {
    // 真实 API 模式下的错误处理
    if (error instanceof ApiError && error.code === 'SESSION_NOT_FOUND') {
      gameOverModalRef.value?.setError('Session expired. Please restart the game.')
    } else {
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

function handleCloseGameOver() {
  showGameOver.value = false
}

function handleRestart() {
  showGameOver.value = false
  gameOverData.value = null
  lastWaveData.value = null
  gameOverModalRef.value?.resetState()

  // 通过 EventBus 通知 Game 场景重新开始
  EventBus.emit('restart-game')
}

onMounted(() => {
  // 监听游戏结束事件
  EventBus.on('game-over', (data: {
    score: number
    wave: number
    sessionId: string
    isEarlyEnd: boolean
    lastWaveActions?: Action[]
    lastWaveAttacks?: AttackEvent[]
    lastWaveResult?: WaveResult
    buildings?: BuildingSnapshot[]
  }) => {
    gameOverData.value = {
      score: data.score,
      wave: data.wave,
      sessionId: data.sessionId,
      isEarlyEnd: data.isEarlyEnd,
    }

    // 只有非提前结束时才设置 lastWaveData
    if (!data.isEarlyEnd && data.lastWaveActions && data.lastWaveResult && data.buildings) {
      lastWaveData.value = {
        waveNumber: data.wave,
        actions: data.lastWaveActions,
        attacks: data.lastWaveAttacks || [],
        result: data.lastWaveResult,
        buildings: data.buildings,
      }
    } else {
      lastWaveData.value = null
    }

    showGameOver.value = true
  })

  // 监听显示排行榜事件（从游戏界面按钮触发）
  EventBus.on('show-leaderboard', () => {
    showLeaderboard.value = true
    leaderboardRef.value?.refresh()
  })
})

onUnmounted(() => {
  EventBus.off('game-over')
  EventBus.off('show-leaderboard')
})
</script>

<template>
  <div class="toolbar-container">
    <LeaderboardButton @click="handleOpenLeaderboard" />
    <LocaleToggle />
    <ThemeToggle />
  </div>

  <PhaserGame ref="phaserRef" @current-active-scene="currentScene" />

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
