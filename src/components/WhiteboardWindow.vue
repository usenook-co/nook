<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

// Canvas and drawing variables
const canvas = ref(null)
const ctx = ref(null)
const isDrawing = ref(false)
let lastPos = { x: 0, y: 0 }
let lastMidPoint = { x: 0, y: 0 }

// New reactive variable for drawing mode (toggled via Electron)
const drawingMode = ref(false)

const strokeColor = ref('#FF0000')
const strokeWidth = ref(5)

// Preset colors for the picker
const presetColors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#000000', '#FFA500']

// Fade-out variables
let fadeTimeout = null
let fadeAnimationId = null
let fadeStartTime = null
const fadeDuration = 1000 // fade over 1 second
let fadeBuffer = null // offscreen canvas buffer

function initCanvas() {
  const c = canvas.value
  const ratio = window.devicePixelRatio || 1
  c.width = window.innerWidth * ratio
  c.height = window.innerHeight * ratio
  c.style.width = window.innerWidth + 'px'
  c.style.height = window.innerHeight + 'px'

  ctx.value = c.getContext('2d')
  // Scale so that drawing coordinates are in CSS pixels
  ctx.value.scale(ratio, ratio)

  ctx.value.strokeStyle = strokeColor.value
  ctx.value.fillStyle = strokeColor.value
  ctx.value.lineWidth = strokeWidth.value
  ctx.value.lineCap = 'round'
  ctx.value.lineJoin = 'round'
}

function clearCanvas() {
  // Clears the canvas in CSS coordinate space
  ctx.value.clearRect(0, 0, window.innerWidth, window.innerHeight)
}

function resetInactivityTimer() {
  cancelFadeOut()
  if (fadeTimeout) clearTimeout(fadeTimeout)
  fadeTimeout = setTimeout(() => startFadeOut(), 1000)
}

function cancelFadeOut() {
  if (fadeAnimationId) {
    cancelAnimationFrame(fadeAnimationId)
    fadeAnimationId = null
  }
  fadeBuffer = null
  fadeStartTime = null
}

function startFadeOut() {
  // Capture the current canvas into an offscreen buffer.
  const offscreen = document.createElement('canvas')
  offscreen.width = canvas.value.width
  offscreen.height = canvas.value.height
  offscreen.getContext('2d').drawImage(canvas.value, 0, 0)
  fadeBuffer = offscreen

  fadeStartTime = performance.now()
  fadeAnimationId = requestAnimationFrame(fadeStep)
}

function fadeStep(timestamp) {
  const progress = (timestamp - fadeStartTime) / fadeDuration
  if (progress < 1) {
    clearCanvas()
    ctx.value.save()
    ctx.value.globalAlpha = 1 - progress
    ctx.value.drawImage(
      fadeBuffer,
      0, 0, fadeBuffer.width, fadeBuffer.height,
      0, 0, window.innerWidth, window.innerHeight
    )
    ctx.value.restore()
    fadeAnimationId = requestAnimationFrame(fadeStep)
  } else {
    clearCanvas()
    fadeAnimationId = null
    fadeBuffer = null
  }
}

function startDrawing(e) {
  cancelFadeOut()
  if (fadeTimeout) {
    clearTimeout(fadeTimeout)
    fadeTimeout = null
  }
  isDrawing.value = true
  lastPos = { x: e.clientX, y: e.clientY }
  lastMidPoint = { x: e.clientX, y: e.clientY }

  ctx.value.beginPath()
  ctx.value.arc(e.clientX, e.clientY, strokeWidth.value / 2, 0, Math.PI * 2)
  ctx.value.fill()

  resetInactivityTimer()
}

function draw(e) {
  if (!isDrawing.value) return

  const currentPos = { x: e.clientX, y: e.clientY }
  const currentMidPoint = {
    x: (lastPos.x + currentPos.x) / 2,
    y: (lastPos.y + currentPos.y) / 2
  }

  ctx.value.beginPath()
  ctx.value.moveTo(lastMidPoint.x, lastMidPoint.y)
  ctx.value.quadraticCurveTo(lastPos.x, lastPos.y, currentMidPoint.x, currentMidPoint.y)
  ctx.value.stroke()

  lastPos = currentPos
  lastMidPoint = currentMidPoint

  resetInactivityTimer()
}

function stopDrawing(e) {
  if (!isDrawing.value) return

  ctx.value.beginPath()
  ctx.value.moveTo(lastMidPoint.x, lastMidPoint.y)
  ctx.value.lineTo(e.clientX, e.clientY)
  ctx.value.stroke()

  isDrawing.value = false
  resetInactivityTimer()
}

function handleResize() {
  // Save current drawing.
  const tempCanvas = document.createElement('canvas')
  const ratio = window.devicePixelRatio || 1
  tempCanvas.width = canvas.value.width
  tempCanvas.height = canvas.value.height
  const tempCtx = tempCanvas.getContext('2d')
  tempCtx.drawImage(canvas.value, 0, 0)

  // Update canvas dimensions based on new window size.
  canvas.value.width = window.innerWidth * ratio
  canvas.value.height = window.innerHeight * ratio
  canvas.value.style.width = window.innerWidth + 'px'
  canvas.value.style.height = window.innerHeight + 'px'

  ctx.value = canvas.value.getContext('2d')
  ctx.value.scale(ratio, ratio)
  // Redraw the saved image scaled to CSS pixels.
  ctx.value.drawImage(
    tempCanvas,
    0, 0, tempCanvas.width, tempCanvas.height,
    0, 0, window.innerWidth, window.innerHeight
  )

  ctx.value.strokeStyle = strokeColor.value
  ctx.value.fillStyle = strokeColor.value
  ctx.value.lineWidth = strokeWidth.value
  ctx.value.lineCap = 'round'
  ctx.value.lineJoin = 'round'
}

function updateContextColor() {
  if (ctx.value) {
    ctx.value.strokeStyle = strokeColor.value
    ctx.value.fillStyle = strokeColor.value
  }
}

function changeColor(color) {
  strokeColor.value = color
  updateContextColor()
}

function handleCustomColor(e) {
  strokeColor.value = e.target.value
  updateContextColor()
}

onMounted(() => {
  initCanvas()
  window.addEventListener('resize', handleResize)
  canvas.value.addEventListener('mousedown', startDrawing)
  
  // Named mousemove handler so it can be properly removed.
  const mouseMoveHandler = (e) => {
    if (isDrawing.value) {
      draw(e)
    }
    resetInactivityTimer()
  }
  canvas.value.addEventListener('mousemove', mouseMoveHandler)
  canvas.value.addEventListener('mouseup', stopDrawing)
  canvas.value.addEventListener('mouseout', stopDrawing)
  
  // Save the handler reference for removal
  canvas.value._mouseMoveHandler = mouseMoveHandler

  // Listen for drawing mode toggle from Electron.
  if (window.electron && window.electron.onToggleDrawing) {
    window.electron.onToggleDrawing((enabled) => {
      drawingMode.value = enabled
      // End any current drawing if drawing mode is turned off.
      if (!enabled && isDrawing.value) {
        isDrawing.value = false
      }
    })
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  canvas.value.removeEventListener('mousedown', startDrawing)
  canvas.value.removeEventListener('mousemove', canvas.value._mouseMoveHandler)
  canvas.value.removeEventListener('mouseup', stopDrawing)
  canvas.value.removeEventListener('mouseout', stopDrawing)
})
</script>

<template>
  <div>
    <canvas ref="canvas"></canvas>
    <!-- Color picker shows only when drawing mode is active -->
    <div v-if="drawingMode" class="color-picker">
      <div class="color-options">
        <div v-for="color in presetColors" :key="color"
          class="color-circle"
          :style="{ backgroundColor: color }"
          @click="changeColor(color)">
        </div>
      </div>
      <input type="color" :value="strokeColor" @input="handleCustomColor" class="custom-color-picker" />
    </div>
  </div>
</template>

<style>
canvas {
  display: block;
  border: none;
  outline: none;
}

/* Color picker container */
.color-picker {
  position: fixed;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  /* Black transparent background with blur effect */
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
  padding: 8px 12px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  /* Subtle jump and fade in animation */
  animation: jumpIn 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}

@keyframes jumpIn {
  0% {
    opacity: 0;
    transform: translateX(-50%) translateY(8px) scale(0.97);
  }
  60% {
    opacity: 0.7;
    transform: translateX(-50%) translateY(0) scale(1.02);
  }
  100% {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}

/* Preset color circles */
.color-options {
  display: flex;
}
.color-circle {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  margin: 0 5px;
  cursor: pointer;
  transition: transform 0.2s ease;
}
.color-circle:active {
  transform: scale(1.2);
}

/* Custom color picker styling */
.custom-color-picker {
  margin-left: 10px;
  border: none;
  background: transparent;
  cursor: pointer;
  width: 30px;
  height: 30px;
  padding: 0;
}
</style>
