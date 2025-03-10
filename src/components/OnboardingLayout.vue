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
    <div class="nook-logo-bg"></div>
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
  background-color: #2a292e;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  overflow: hidden;
  user-select: none;
  cursor: default;
}

.nook-logo-bg {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 80px;
  height: 80px;
  background-image: url('/nook.svg');
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  z-index: 0;
  pointer-events: none;
  opacity: 0.9;
}

.onboarding-container {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 120px; /* Space for logo */
}

button,
input {
  cursor: pointer;
}
</style>
