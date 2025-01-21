<script setup>
import { onMounted, onUnmounted } from 'vue'
import GifSelector from './GifSelector.vue'

function handleSelectGif(gifUrl) {
  // Send the selected GIF URL to the opener window
  if (window.opener) {
    window.opener.postMessage({ type: 'gifSelected', gifUrl }, '*')
    window.close()
  } else if (window.electron?.selectGif) {
    // Fall back to electron method if available
    window.electron.selectGif(gifUrl).finally(() => handleClose())
  } else {
    handleClose()
  }
}

function handleClose() {
  try {
    window.close()
  } catch (err) {
    // Fall back to electron if available
    window.electron?.closeGifSelector?.()
  }
}

// Add keyboard event handler for Escape key to close
function handleKeydown(e) {
  if (e.key === 'Escape') {
    handleClose()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="gif-selector-window">
    <div class="window-header">
      <div class="window-title">Select a GIF</div>
      <button class="window-close" @click="handleClose" title="Close window">×</button>
    </div>
    <div class="window-content">
      <GifSelector @select="handleSelectGif" @close="handleClose" />
    </div>
  </div>
</template>

<style>
body {
  margin: 0;
  padding: 0;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

.gif-selector-window {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background: #121212;
  border-radius: 8px;
}

.window-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background: #1a1a1a;
  -webkit-app-region: drag;
  border-bottom: 1px solid #333;
}

.window-title {
  color: white;
  font-weight: 500;
  -webkit-app-region: drag;
}

.window-close {
  -webkit-app-region: no-drag;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: white;
  font-size: 20px;
  cursor: pointer;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.window-close:hover {
  background: rgba(255, 0, 0, 0.3);
}

.window-content {
  flex: 1;
  overflow: hidden;
  padding: 0;
}

.window-content .gif-selector {
  height: 100%;
  border-radius: 0;
  padding: 16px;
}
</style>
