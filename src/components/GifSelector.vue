<script setup>
import { ref, onMounted } from 'vue'

const emit = defineEmits(['select', 'close'])

const serverUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const gifs = ref([])
const searchQuery = ref('')
const loading = ref(false)
const error = ref('')
const offset = ref(0)
const totalCount = ref(0)

function handleSelect(gif) {
  const gifUrl = gif.images.fixed_height.url
  emit('select', gifUrl)
}

async function fetchGifs(isLoadingMore = false) {
  if (!isLoadingMore) {
    offset.value = 0
  }

  try {
    loading.value = true
    const endpoint = searchQuery.value
      ? `${serverUrl}/api/gifs/search?q=${encodeURIComponent(searchQuery.value)}&offset=${offset.value}&limit=20`
      : `${serverUrl}/api/gifs/trending?offset=${offset.value}&limit=20`

    const response = await fetch(endpoint)
    const { data, pagination } = await response.json()

    // If loading more, append to existing gifs, otherwise replace
    gifs.value = isLoadingMore ? [...gifs.value, ...data] : data
    totalCount.value = pagination.total_count
  } catch (err) {
    error.value = searchQuery.value ? 'Failed to search GIFs' : 'Failed to load GIFs'
    console.error(err)
  } finally {
    loading.value = false
  }
}

function loadMore() {
  if (!loading.value && gifs.value.length < totalCount.value) {
    offset.value += 20
    fetchGifs(true)
  }
}

function handleScroll(e) {
  const container = e.target
  const reachedBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100
  if (reachedBottom) {
    loadMore()
  }
}

function handleSearch() {
  fetchGifs()
}

onMounted(() => fetchGifs())
</script>

<template>
  <div class="gif-selector">
    <div class="gif-selector-header">
      <input v-model="searchQuery" @input="handleSearch" placeholder="Search GIFs..." class="gif-search-input" />
      <button class="close-button" @click="emit('close')" title="Close">×</button>
    </div>

    <div class="gif-grid-container" @scroll="handleScroll">
      <div class="gif-grid" v-if="gifs.length > 0">
        <div
          v-for="gif in gifs"
          :key="gif.id"
          class="gif-item"
          @click="handleSelect(gif)"
          title="Click to select this GIF"
        >
          <img :src="gif.images.fixed_height_small.url" :alt="gif.title" loading="lazy" />
          <div class="gif-overlay">
            <span class="select-text">Select</span>
          </div>
        </div>
      </div>

      <div v-if="loading && offset === 0" class="loading">Loading...</div>
      <div v-if="loading && offset > 0" class="loading-more">Loading more...</div>
      <div v-if="error" class="error">{{ error }}</div>
      <div v-if="!loading && gifs.length === 0 && !error" class="no-results">No GIFs found</div>
    </div>
  </div>
</template>

<style scoped>
.gif-selector {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #121212;
  border-radius: 12px;
  overflow: hidden;
}

.gif-selector-header {
  padding: 16px;
  background: #1a1a1a;
  display: flex;
  gap: 8px;
  z-index: 1;
}

.gif-search-input {
  flex: 1;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.close-button {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.gif-grid-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  height: calc(100% - 70px);
}

.gif-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.gif-item {
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.2s;
  aspect-ratio: 1;
  position: relative;
}

.gif-item:hover {
  transform: scale(1.05);
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
}

.gif-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.gif-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.gif-item:hover .gif-overlay {
  opacity: 1;
}

.select-text {
  color: white;
  background: rgba(0, 0, 0, 0.6);
  padding: 4px 12px;
  border-radius: 4px;
  font-weight: bold;
}

.loading,
.loading-more,
.error {
  text-align: center;
  color: white;
  padding: 16px;
}

.loading-more {
  font-size: 0.9em;
  opacity: 0.7;
}
</style>
