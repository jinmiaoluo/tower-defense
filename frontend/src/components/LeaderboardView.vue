<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { gameApi } from '@/api'
import { useI18n, getDateLocale } from '@/i18n'
import type { LeaderboardEntry } from '@/types'

const { t, locale } = useI18n()
const dateLocale = computed(() => getDateLocale(locale.value))

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const entries = ref<LeaderboardEntry[]>([])
const isLoading = ref(false)
const hasError = ref(false)

async function fetchLeaderboard() {
  isLoading.value = true
  hasError.value = false

  try {
    const response = await gameApi.getLeaderboard()
    entries.value = response.entries
  } catch {
    hasError.value = true
  } finally {
    isLoading.value = false
  }
}

function formatDate(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleDateString(dateLocale.value, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function handleClose() {
  emit('close')
}

onMounted(() => {
  fetchLeaderboard()
})

defineExpose({
  refresh: fetchLeaderboard,
})
</script>

<template>
  <Transition name="modal">
    <div
      v-if="visible"
      class="modal-overlay"
      @click.self="handleClose"
    >
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">
            {{ t('leaderboard') }}
          </h2>
          <button
            class="close-btn"
            @click="handleClose"
          >
            &times;
          </button>
        </div>

        <div
          v-if="isLoading"
          class="loading"
        >
          {{ t('loading') }}
        </div>

        <div
          v-else-if="hasError"
          class="error"
        >
          {{ t('leaderboard_error') }}
          <button
            class="btn btn-secondary"
            @click="fetchLeaderboard"
          >
            {{ t('retry') }}
          </button>
        </div>

        <div
          v-else
          class="leaderboard-list"
        >
          <div class="list-header">
            <span class="col-rank">{{ t('rank') }}</span>
            <span class="col-name">{{ t('player') }}</span>
            <span class="col-score">{{ t('score') }}</span>
            <span class="col-waves">{{ t('waves') }}</span>
            <span class="col-date">{{ t('date') }}</span>
          </div>

          <div
            v-for="entry in entries"
            :key="entry.rank"
            class="list-item"
            :class="{ 'top-three': entry.rank <= 3 }"
          >
            <span class="col-rank">
              <span
                v-if="entry.rank === 1"
                class="medal gold"
              >1</span>
              <span
                v-else-if="entry.rank === 2"
                class="medal silver"
              >2</span>
              <span
                v-else-if="entry.rank === 3"
                class="medal bronze"
              >3</span>
              <span v-else>{{ entry.rank }}</span>
            </span>
            <span class="col-name">{{ entry.nickname }}</span>
            <span class="col-score">{{ entry.score.toLocaleString() }}</span>
            <span class="col-waves">{{ entry.wavesCompleted }}</span>
            <span class="col-date">{{ formatDate(entry.createdAt) }}</span>
          </div>

          <p
            v-if="entries.length === 0"
            class="empty-message"
          >
            {{ t('leaderboard_empty') }}
          </p>
        </div>

        <div class="modal-footer">
          <button
            class="btn btn-primary"
            @click="handleClose"
          >
            {{ t('close') }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
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
  padding: 24px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.modal-title {
  color: var(--color-warning);
  font-size: 28px;
  font-weight: bold;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 32px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: color 0.2s;
}

.close-btn:hover {
  color: var(--color-text);
}

.loading,
.error {
  text-align: center;
  color: var(--color-text-secondary);
  padding: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.leaderboard-list {
  flex: 1;
  overflow-y: auto;
}

.list-header,
.list-item {
  display: grid;
  grid-template-columns: 60px 1fr 120px 80px 120px;
  gap: 12px;
  padding: 12px 16px;
  align-items: center;
}

.list-header {
  background: var(--color-background-secondary);
  border-radius: 8px;
  color: var(--color-text-muted);
  font-size: 12px;
  text-transform: uppercase;
  font-weight: bold;
  position: sticky;
  top: 0;
}

.list-item {
  border-bottom: 1px solid var(--color-background-secondary);
  color: var(--color-text);
  transition: background 0.2s;
}

.list-item:hover {
  background: var(--color-background-secondary);
}

.list-item.top-three {
  background: rgba(255, 204, 0, 0.1);
}

.col-rank {
  text-align: center;
}

.col-score,
.col-waves {
  text-align: right;
  font-family: monospace;
}

.col-date {
  text-align: right;
  color: var(--color-text-muted);
  font-size: 14px;
}

.medal {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-weight: bold;
  font-size: 14px;
}

.medal.gold {
  background: linear-gradient(135deg, #ffd700, #ffaa00);
  color: #000;
}

.medal.silver {
  background: linear-gradient(135deg, #c0c0c0, #a0a0a0);
  color: #000;
}

.medal.bronze {
  background: linear-gradient(135deg, #cd7f32, #a05a20);
  color: #fff;
}

.empty-message {
  text-align: center;
  color: var(--color-text-muted);
  padding: 40px;
  font-style: italic;
}

.modal-footer {
  margin-top: 20px;
  display: flex;
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

.btn-primary {
  background: var(--color-primary);
  color: var(--color-text);
}

.btn-primary:hover {
  background: var(--color-primary-hover);
}

.btn-secondary {
  background: var(--color-border);
  color: var(--color-text);
}

.btn-secondary:hover {
  background: var(--color-border-light);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  opacity: 0;
  transform: scale(0.9) translateY(-20px);
}

@media (max-width: 480px) {
  .modal-content {
    padding: 16px;
    border-radius: 8px;
    max-height: 85vh;
  }

  .modal-title {
    font-size: 22px;
  }

  .close-btn {
    font-size: 28px;
    min-width: 44px;
    min-height: 44px;
  }

  .list-header,
  .list-item {
    grid-template-columns: 40px 1fr 80px 50px;
    gap: 8px;
    padding: 10px 12px;
  }

  .col-date {
    display: none;
  }

  .col-score,
  .col-waves {
    font-size: 14px;
  }

  .medal {
    width: 24px;
    height: 24px;
    font-size: 12px;
  }

  .btn {
    min-height: 44px;
    padding: 10px 20px;
  }

  .modal-footer {
    margin-top: 16px;
  }
}
</style>
