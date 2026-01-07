<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import type { RankingInfo } from '@/types'

interface GameOverData {
  score: number
  wavesCompleted: number
  sessionId: string
}

const props = defineProps<{
  visible: boolean
  gameData: GameOverData | null
}>()

const nicknameInput = ref<HTMLInputElement | null>(null)
const isSubmitted = ref(false)

watch([() => props.visible, isSubmitted], ([newVisible, submitted]) => {
  if (newVisible && !submitted) {
    nextTick(() => {
      nicknameInput.value?.focus()
    })
  }
}, { immediate: true })

const emit = defineEmits<{
  submit: [nickname: string]
  viewLeaderboard: []
  close: []
  restart: []
}>()

const nickname = ref('')
const isSubmitting = ref(false)
const rankingInfo = ref<RankingInfo | null>(null)
const errorMessage = ref('')

const canSubmit = computed(() => {
  const trimmed = nickname.value.trim()
  return trimmed.length >= 1 && trimmed.length <= 32 && !isSubmitting.value
})

async function handleSubmit() {
  if (!canSubmit.value) return

  isSubmitting.value = true
  errorMessage.value = ''

  try {
    emit('submit', nickname.value.trim())
  } catch {
    errorMessage.value = 'Failed to submit score'
    isSubmitting.value = false
  }
}

function handleViewLeaderboard() {
  emit('viewLeaderboard')
}

function handlePlayAgain() {
  emit('restart')
}

function setRankingResult(ranking: RankingInfo) {
  rankingInfo.value = ranking
  isSubmitted.value = true
  isSubmitting.value = false
}

function setError(message: string) {
  errorMessage.value = message
  isSubmitting.value = false
  nextTick(() => {
    nicknameInput.value?.focus()
  })
}

function resetState() {
  nickname.value = ''
  isSubmitting.value = false
  isSubmitted.value = false
  rankingInfo.value = null
  errorMessage.value = ''
}

defineExpose({
  setRankingResult,
  setError,
  resetState,
})
</script>

<template>
  <div v-if="visible" class="modal-overlay">
    <div class="modal-content">
      <h2 class="modal-title">GAME OVER</h2>

      <div v-if="gameData" class="game-stats">
        <div class="stat-item">
          <span class="stat-label">Final Score</span>
          <span class="stat-value">{{ gameData.score }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Waves Completed</span>
          <span class="stat-value">{{ gameData.wavesCompleted }}</span>
        </div>
      </div>

      <div v-if="!isSubmitted" class="submit-section">
        <div class="input-group">
          <label for="nickname">Enter your nickname:</label>
          <input
            id="nickname"
            ref="nicknameInput"
            v-model="nickname"
            type="text"
            maxlength="32"
            placeholder="Your name"
            :disabled="isSubmitting"
            @keyup.enter="handleSubmit"
          >
        </div>

        <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>

        <button
          class="btn btn-primary"
          :disabled="!canSubmit"
          @click="handleSubmit"
        >
          {{ isSubmitting ? 'Submitting...' : 'Submit Score' }}
        </button>
      </div>

      <div v-else class="result-section">
        <div v-if="rankingInfo" class="ranking-info">
          <p class="rank-text">
            Your Rank: <span class="rank-number">#{{ rankingInfo.rank }}</span>
            <span class="rank-total">/ {{ rankingInfo.total }}</span>
          </p>
          <p v-if="rankingInfo.isNewRecord" class="new-record">New Record!</p>
        </div>

        <div class="button-group">
          <button class="btn btn-secondary" @click="handleViewLeaderboard">
            View Leaderboard
          </button>
          <button class="btn btn-primary" @click="handlePlayAgain">
            Play Again
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--color-background);
  border: 2px solid var(--color-border);
  border-radius: 12px;
  padding: 32px;
  width: 90%;
  max-width: 400px;
  text-align: center;
}

.modal-title {
  color: var(--color-danger);
  font-size: 36px;
  font-weight: bold;
  margin: 0 0 24px 0;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
}

.game-stats {
  display: flex;
  justify-content: center;
  gap: 32px;
  margin-bottom: 24px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  color: var(--color-text-muted);
  font-size: 14px;
}

.stat-value {
  color: var(--color-text);
  font-size: 28px;
  font-weight: bold;
}

.submit-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-group label {
  color: var(--color-text-secondary);
  font-size: 14px;
  text-align: left;
}

.input-group input {
  padding: 12px 16px;
  font-size: 16px;
  border: 2px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-background-secondary);
  color: var(--color-text);
  outline: none;
  transition: border-color 0.2s;
}

.input-group input:focus {
  border-color: var(--color-border-light);
}

.input-group input:disabled {
  opacity: 0.6;
}

.error-message {
  color: var(--color-danger);
  font-size: 14px;
  margin: 0;
}

.result-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.ranking-info {
  background: var(--color-background-secondary);
  border-radius: 8px;
  padding: 16px;
}

.rank-text {
  color: var(--color-text);
  font-size: 18px;
  margin: 0;
}

.rank-number {
  color: var(--color-warning);
  font-size: 24px;
  font-weight: bold;
}

.rank-total {
  color: var(--color-text-muted);
  font-size: 16px;
}

.new-record {
  color: var(--color-success);
  font-size: 20px;
  font-weight: bold;
  margin: 8px 0 0 0;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.button-group {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.btn {
  padding: 12px 24px;
  font-size: 16px;
  font-weight: bold;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-primary);
  color: var(--color-text);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-secondary {
  background: var(--color-border);
  color: var(--color-text);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-border-light);
}

@media (max-width: 480px) {
  .modal-content {
    padding: 24px 16px;
    border-radius: 8px;
  }

  .modal-title {
    font-size: 28px;
    margin-bottom: 16px;
  }

  .game-stats {
    gap: 24px;
    margin-bottom: 16px;
  }

  .stat-value {
    font-size: 24px;
  }

  .button-group {
    flex-direction: column;
    gap: 10px;
  }

  .btn {
    width: 100%;
    min-height: 44px;
    padding: 12px 16px;
  }

  .input-group input {
    min-height: 44px;
  }
}
</style>
