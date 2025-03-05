<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

// Refs for the main canvas and its container
const canvas = ref(null)
const canvasContainer = ref(null)
const ctx = ref(null)
const isDrawing = ref(false)
let lastPos = { x: 0, y: 0 }
let lastMidPoint = { x: 0, y: 0 }

// New reactive variable for drawing mode (toggled via Electron)
const drawingMode = ref(false)

// Change default color to pink
const strokeColor = ref('#FF00CC')
const strokeWidth = ref(5)

// Preset colors for the picker
const presetColors = [
  '#FF00CC', // electric pink
  '#00FFDD', // bright turquoise
  '#AAFF00', // lime green
  '#FF3300', // bright red-orange
  '#4D4DFF', // royal blue
  '#FFCC00', // golden yellow
  '#00FF66', // neon green
  '#9900FF'  // deep purple
]

// Fade-out variables
let fadeTimeout = null
const fadeDuration = 1000 // fade over 1 second

function initCanvas() {
  const c = canvas.value
  const ratio = window.devicePixelRatio || 1
  c.width = window.innerWidth * ratio
  c.height = window.innerHeight * ratio
  c.style.width = window.innerWidth + 'px'
  c.style.height = window.innerHeight + 'px'
  // Ensure the active canvas is absolutely positioned on top.
  c.style.position = 'absolute'
  c.style.top = '0'
  c.style.left = '0'
  c.style.zIndex = '10'

  ctx.value = c.getContext('2d')
  // Scale so that drawing coordinates are in CSS pixels.
  ctx.value.scale(ratio, ratio)
  ctx.value.strokeStyle = strokeColor.value
  ctx.value.fillStyle = strokeColor.value
  ctx.value.lineWidth = strokeWidth.value
  ctx.value.lineCap = 'round'
  ctx.value.lineJoin = 'round'
}

function clearCanvas() {
  // Clears the canvas in CSS coordinate space.
  ctx.value.clearRect(0, 0, window.innerWidth, window.innerHeight)
}

function resetInactivityTimer() {
  if (fadeTimeout) clearTimeout(fadeTimeout)
  fadeTimeout = setTimeout(() => startFadeOut(), 1000)
}

function startFadeOut() {
  const activeCanvas = canvas.value
  const ratio = window.devicePixelRatio || 1

  // Create a clone canvas to serve as the fading layer.
  const fadingCanvas = document.createElement('canvas')
  fadingCanvas.width = activeCanvas.width
  fadingCanvas.height = activeCanvas.height
  fadingCanvas.style.width = window.innerWidth + 'px'
  fadingCanvas.style.height = window.innerHeight + 'px'
  fadingCanvas.style.position = 'absolute'
  fadingCanvas.style.top = '0'
  fadingCanvas.style.left = '0'
  // Place it behind the active canvas.
  fadingCanvas.style.zIndex = '1'
  fadingCanvas.style.pointerEvents = 'none'

  const fadingCtx = fadingCanvas.getContext('2d')
  // Maintain high resolution.
  fadingCtx.scale(ratio, ratio)
  fadingCtx.drawImage(
    activeCanvas,
    0, 0, activeCanvas.width, activeCanvas.height,
    0, 0, window.innerWidth, window.innerHeight
  )

  // Append the fading canvas into the container.
  canvasContainer.value.appendChild(fadingCanvas)

  // Clear the active canvas so new drawing happens on a blank slate.
  clearCanvas()

  // Fade out the clone via CSS transition.
  fadingCanvas.style.transition = `opacity ${fadeDuration}ms linear`
  // Force reflow so the transition applies.
  void fadingCanvas.offsetWidth
  fadingCanvas.style.opacity = '0'

  // Remove the fading canvas after the transition.
  setTimeout(() => {
    if (fadingCanvas.parentNode) {
      fadingCanvas.parentNode.removeChild(fadingCanvas)
    }
  }, fadeDuration)
}

function startDrawing(e) {
  // Only start drawing if the event target is the active canvas.
  if (e.target !== canvas.value) return

  // Cancel any scheduled fade-out (but let any already fading canvases continue).
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

  // Update canvas dimensions based on the new window size.
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
  // Save the handler reference for removal.
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
  <div ref="canvasContainer" class="canvas-container">
    <canvas ref="canvas"></canvas>
    <!-- Color picker shows only when drawing mode is active -->
    <div 
      v-if="drawingMode" 
      class="color-picker" 
      @mousedown.stop 
      @pointerdown.stop 
      @click.stop
    >
      <div class="color-options">
        <div 
          v-for="color in presetColors" 
          :key="color"
          class="color-circle"
          :class="{ 'selected': color === strokeColor }"
          :style="{ backgroundColor: color, color: color }"
          @mousedown.stop 
          @pointerdown.stop 
          @click.stop="changeColor(color)"
        ></div>
      </div>
    </div>
  </div>
</template>

<style>
.canvas-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

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
  z-index: 1000;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
  padding: 8px 12px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
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
  width: 36px;
  height: 36px;
  border-radius: 50%;
  margin: 0 5px;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.3s ease;
  border: 2px solid transparent;
}
.color-circle:active {
  transform: scale(1.2);
}
.color-circle.selected {
  transform: scale(1.15);
  border: 2px solid currentColor;
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
}
</style>
