<script setup>
import { onMounted } from 'vue'

// Handle window drag
function startDrag(event) {
  // Only enable drag on the wrapper area, not on controls
  if (event.target.closest('button, input')) {
    return
  }

  if (window?.electron?.startDrag) {
    window.electron.startDrag()
  }
}

function stopDrag() {
  if (window?.electron?.stopDrag) {
    window.electron.stopDrag()
  }
}
</script>

<template>
  <div class="onboarding-wrapper" @mousedown="startDrag" @mouseup="stopDrag" @mouseleave="stopDrag">
    <div class="logo-container">
      <div class="nook-logo"></div>
      <div class="logo-text">nook</div>
    </div>
    <div class="onboarding-container">
      <router-view></router-view>
    </div>
  </div>
</template>

<style>
.onboarding-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  overflow: hidden;
  user-select: none;
  cursor: default;
  padding-top: 2rem;
}

.logo-container {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.nook-logo {
  width: 90px;
  height: 95px;
  background-image: url('/nook.svg');
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  pointer-events: none;
  filter: drop-shadow(0 0 5px color-mix(in srgb, var(--gradient-end) 30%, transparent));
}

.logo-text {
  font-family: 'Anja', sans-serif;
  font-size: 1.5rem;
  text-align: center;
  margin-top: -1rem;
  letter-spacing: 1px;
  color: var(--gradient-end);
}

.onboarding-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}
</style>
