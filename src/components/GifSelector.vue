<script setup>
import { ref, onMounted } from 'vue'

const props = defineProps({
  onSelect: Function,
  onClose: Function
})

const serverUrl = 'http://localhost:3000'
const gifs = ref([])
const searchQuery = ref('')
const loading = ref(false)
const error = ref('')
const offset = ref(0)
const totalCount = ref(0)

async function fetchTrending() {
  try {
    loading.value = true
    const response = await fetch(`${serverUrl}/api/gifs/trending?offset=${offset.value}&limit=20`)
    const { data, pagination } = await response.json()
    gifs.value = offset.value === 0 ? data : [...gifs.value, ...data]
    totalCount.value = pagination.total_count
  } catch (err) {
    error.value = 'Failed to load GIFs'
    console.error(err)
  } finally {
    loading.value = false
  }
}

async function searchGifs() {
  if (!searchQuery.value) {
    offset.value = 0
    return fetchTrending()
  }

  try {
    loading.value = true
    const response = await fetch(
      `${serverUrl}/api/gifs/search?q=${encodeURIComponent(searchQuery.value)}&offset=${offset.value}&limit=20`
    )
    const { data, pagination } = await response.json()
    gifs.value = offset.value === 0 ? data : [...gifs.value, ...data]
    totalCount.value = pagination.total_count
  } catch (err) {
    error.value = 'Failed to search GIFs'
    console.error(err)
  } finally {
    loading.value = false
  }
}

function loadMore() {
  if (!loading.value && gifs.value.length < totalCount.value) {
    offset.value += 20
    if (searchQuery.value) {
      searchGifs()
    } else {
      fetchTrending()
    }
  }
}

function handleScroll(e) {
  const bottom = e.target.scrollHeight - e.target.scrollTop === e.target.clientHeight
  if (bottom) {
    loadMore()
  }
}

onMounted(fetchTrending)
</script>

<template>
  <div class="gif-selector" @scroll="handleScroll">
    <div class="gif-selector-header">
      <input
        v-model="searchQuery"
        @input="
          () => {
            offset.value = 0
            searchGifs()
          }
        "
        placeholder="Search GIFs..."
        class="gif-search-input"
      />
      <button class="close-button" @click="onClose">×</button>
    </div>

    <div class="gif-grid" v-if="!loading || offset > 0">
      <div v-for="gif in gifs" :key="gif.id" class="gif-item" @click="onSelect(gif.images.fixed_height.url)">
        <img :src="gif.images.fixed_height_small.url" :alt="gif.title" loading="lazy" />
      </div>
    </div>

    <div v-if="loading && offset === 0" class="loading">Loading...</div>
    <div v-if="loading && offset > 0" class="loading-more">Loading more...</div>
    <div v-if="error" class="error">{{ error }}</div>
  </div>
</template>

<style scoped>
.gif-selector {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.9);
  border-radius: 12px;
  padding: 16px;
  width: 300px;
  max-height: 400px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
}

.gif-selector::-webkit-scrollbar {
  width: 6px;
}

.gif-selector::-webkit-scrollbar-track {
  background: transparent;
}

.gif-selector::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.gif-selector-header {
  position: sticky;
  top: 0;
  background: rgba(0, 0, 0, 0.9);
  padding-bottom: 16px;
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
}

.gif-item:hover {
  transform: scale(1.05);
}

.gif-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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
