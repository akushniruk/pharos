<template>
  <Teleport to="body">
    <Transition name="tm-fade">
      <div v-if="isOpen" class="tm-backdrop" @click="close">
        <div class="tm-modal" @click.stop>
          <div class="tm-header">
            <span class="tm-title">Appearance</span>
            <button @click="close" class="tm-close">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                <path d="M1 1l10 10M11 1l-10 10" />
              </svg>
            </button>
          </div>
          <div class="tm-list">
            <button
              v-for="theme in predefinedThemes"
              :key="theme.name"
              @click="selectTheme(theme.name)"
              :class="['tm-option', { 'tm-option--active': currentTheme === theme.name }]"
            >
              <div class="tm-swatch">
                <div
                  class="tm-swatch-color"
                  :style="{ backgroundColor: theme.preview.primary }"
                ></div>
                <div
                  class="tm-swatch-color"
                  :style="{ backgroundColor: theme.preview.secondary }"
                ></div>
                <div
                  class="tm-swatch-color"
                  :style="{ backgroundColor: theme.preview.accent }"
                ></div>
              </div>
              <div class="tm-option-info">
                <span class="tm-option-name">{{ theme.displayName }}</span>
                <span class="tm-option-desc">{{ theme.description }}</span>
              </div>
              <svg v-if="currentTheme === theme.name" class="tm-check" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 7.5l3 3 7-7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useThemes } from '../composables/useThemes';

defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

// Theme management
const { state, predefinedThemes, setTheme } = useThemes();

// Computed properties
const currentTheme = computed(() => state.value.currentTheme);

// Methods
const selectTheme = (themeName: string) => {
  setTheme(themeName);
  close();
};

const close = () => {
  emit('close');
};
</script>

<style scoped>
.tm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.tm-modal {
  background: #18181b;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  width: 360px;
  max-width: 90vw;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.tm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.tm-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
}

.tm-close {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.3);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.tm-close:hover {
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.06);
}

.tm-list {
  padding: 8px;
  overflow-y: auto;
  max-height: calc(80vh - 50px);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tm-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: none;
  background: transparent;
  border-radius: 5px;
  cursor: pointer;
  transition: background 0.12s ease;
  width: 100%;
  text-align: left;
  font-family: inherit;
}

.tm-option:hover {
  background: rgba(255, 255, 255, 0.04);
}

.tm-option--active {
  background: rgba(251, 191, 36, 0.06);
}

.tm-swatch {
  display: flex;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.tm-swatch-color {
  width: 14px;
  height: 22px;
}

.tm-option-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.tm-option-name {
  font-size: 12px;
  font-weight: 550;
  color: rgba(255, 255, 255, 0.8);
}

.tm-option-desc {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
}

.tm-check {
  flex-shrink: 0;
}

.tm-fade-enter-active {
  transition: opacity 0.15s ease;
}

.tm-fade-leave-active {
  transition: opacity 0.1s ease;
}

.tm-fade-enter-from,
.tm-fade-leave-to {
  opacity: 0;
}
</style>
