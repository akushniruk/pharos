<template>
  <div class="fp-root">
    <div class="fp-row">
      <div class="fp-field">
        <label class="fp-label">Source</label>
        <select
          v-model="localFilters.sourceApp"
          @change="updateFilters"
          class="fp-select"
        >
          <option value="">All sources</option>
          <option v-for="app in filterOptions.source_apps" :key="app" :value="app">
            {{ app }}
          </option>
        </select>
      </div>

      <div class="fp-field">
        <label class="fp-label">Session</label>
        <select
          v-model="localFilters.sessionId"
          @change="updateFilters"
          class="fp-select"
        >
          <option value="">All sessions</option>
          <option v-for="session in filterOptions.session_ids" :key="session" :value="session">
            {{ session.slice(0, 8) }}...
          </option>
        </select>
      </div>

      <div class="fp-field">
        <label class="fp-label">Event</label>
        <select
          v-model="localFilters.eventType"
          @change="updateFilters"
          class="fp-select"
        >
          <option value="">All types</option>
          <option v-for="type in filterOptions.hook_event_types" :key="type" :value="type">
            {{ type }}
          </option>
        </select>
      </div>

      <div v-if="filterOptions.agent_types && filterOptions.agent_types.length > 0" class="fp-field">
        <label class="fp-label">Agent type</label>
        <select
          v-model="localFilters.agentType"
          @change="updateFilters"
          class="fp-select"
        >
          <option value="">All agents</option>
          <option v-for="atype in filterOptions.agent_types" :key="atype" :value="atype">
            {{ atype }}
          </option>
        </select>
      </div>

      <button
        v-if="hasActiveFilters"
        @click="clearFilters"
        class="fp-clear"
      >
        Clear all
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { FilterOptions } from '../types';
import { API_BASE_URL } from '../config';

const props = defineProps<{
  filters: {
    sourceApp: string;
    sessionId: string;
    eventType: string;
    agentType: string;
  };
}>();

const emit = defineEmits<{
  'update:filters': [filters: typeof props.filters];
}>();

const filterOptions = ref<FilterOptions>({
  source_apps: [],
  session_ids: [],
  hook_event_types: [],
  agent_ids: [],
  agent_types: []
});

const localFilters = ref({ ...props.filters });

const hasActiveFilters = computed(() => {
  return localFilters.value.sourceApp || localFilters.value.sessionId || localFilters.value.eventType || localFilters.value.agentType;
});

const updateFilters = () => {
  emit('update:filters', { ...localFilters.value });
};

const clearFilters = () => {
  localFilters.value = {
    sourceApp: '',
    sessionId: '',
    eventType: '',
    agentType: ''
  };
  updateFilters();
};

const fetchFilterOptions = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/events/filter-options`);
    if (response.ok) {
      filterOptions.value = await response.json();
    }
  } catch (error) {
    console.error('Failed to fetch filter options:', error);
  }
};

onMounted(() => {
  fetchFilterOptions();
  // Refresh filter options periodically
  setInterval(fetchFilterOptions, 10000);
});
</script>

<style scoped>
.fp-root {
  background: #111113;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  padding: 8px 16px;
}

.fp-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.fp-field {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.fp-label {
  font-size: 11px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.35);
  white-space: nowrap;
  text-transform: lowercase;
}

.fp-select {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.75);
  font-size: 12px;
  padding: 4px 8px;
  min-width: 120px;
  outline: none;
  transition: border-color 0.15s ease;
  font-family: inherit;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='rgba(255,255,255,0.3)' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  padding-right: 24px;
}

.fp-select:focus {
  border-color: rgba(251, 191, 36, 0.4);
}

.fp-select option {
  background: #1a1a1e;
  color: rgba(255, 255, 255, 0.85);
}

.fp-clear {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.3);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  padding: 4px 8px;
  transition: color 0.15s ease;
  font-family: inherit;
}

.fp-clear:hover {
  color: rgba(255, 255, 255, 0.6);
}
</style>
