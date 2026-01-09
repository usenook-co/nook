<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const canvas = ref(null)
const canvasContainer = ref(null)
const ctx = ref(null)
const isDrawing = ref(false)
const drawingMode = ref(false)

const strokeColor = ref('#FF00CC')
const strokeWidth = ref(5)
const presetColors = [
  '#FF00CC','#00FFDD','#AAFF00','#FF3300',
  '#4D4DFF','#FFCC00','#00FF66','#9900FF'
]

const remoteDrawers = ref(new Map())
const myDrawerId = ref('')
const knownDrawerIds = ref(new Set())
let fadeTimeout = null
const fadeDelay = 1000
let fadeOutInProgress = false
const activeFadeouts = ref(new Set())
const fadingCanvases = ref(new Map())
const CURSOR_INACTIVITY_TIMEOUT = 3000
let lastPos = { x: 0, y: 0 }
let lastMidPoint = { x: 0, y: 0 }
let lastMousePos = null

function generateRandomName() {
  const adjectives = [
    'Curious','Wandering','Creative','Playful','Cheerful','Sleepy',
    'Dancing','Sneaky','Hungry','Dazzling','Clever','Mystic',
    'Fluffy','Bouncy','Sparkly','Gentle','Brave','Silly',
    'Dreamy','Cosmic','Witty','Daring','Peaceful','Radiant',
    'Whimsical','Vibrant','Nimble','Cozy','Quirky','Majestic',
    'Fuzzy','Glowing','Mellow','Jazzy','Snuggly','Zesty'
  ]
  const animals = [
    'Kangaroo','Panda','Fox','Raccoon','Koala','Dolphin',
    'Tiger','Penguin','Sloth','Hedgehog','Elephant','Owl',
    'Otter','Capybara','Axolotl','Narwhal','Alpaca','Quokka',
    'Lemur','Platypus','Lynx','Meerkat','Wombat','Chameleon',
    'Armadillo','Chinchilla','Ocelot','Manatee','Mongoose','Tapir',
    'Fennec','Okapi','Pangolin','Loris','Walrus','Gibbon'
  ]
  const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)]
  const randomAnimal = animals[Math.floor(Math.random() * animals.length)]
  return `${randomAdjective} ${randomAnimal}`
}

function withCtx(callback) {
  ctx.value.save()
  callback()
  ctx.value.restore()
}

function initCanvas() {
  const c = canvas.value
  const ratio = window.devicePixelRatio || 1
  c.width = window.innerWidth * ratio
  c.height = window.innerHeight * ratio
  c.style.width = window.innerWidth + 'px'
  c.style.height = window.innerHeight + 'px'
  c.className = 'active-canvas'
  ctx.value = c.getContext('2d')
  ctx.value.scale(ratio, ratio)
  updateContextColor()
  ctx.value.lineWidth = strokeWidth.value
  ctx.value.lineCap = 'round'
  ctx.value.lineJoin = 'round'
}

function clearCanvas() {
  ctx.value.clearRect(0, 0, window.innerWidth, window.innerHeight)
}

function handleResize() {
  const tempCanvas = document.createElement('canvas')
  const ratio = window.devicePixelRatio || 1
  tempCanvas.width = canvas.value.width
  tempCanvas.height = canvas.value.height
  const tempCtx = tempCanvas.getContext('2d')
  tempCtx.drawImage(canvas.value, 0, 0)
  canvas.value.width = window.innerWidth * ratio
  canvas.value.height = window.innerHeight * ratio
  canvas.value.style.width = window.innerWidth + 'px'
  canvas.value.style.height = window.innerHeight + 'px'
  ctx.value = canvas.value.getContext('2d')
  ctx.value.scale(ratio, ratio)
  ctx.value.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, 0, 0, window.innerWidth, window.innerHeight)
  updateContextColor()
  ctx.value.lineWidth = strokeWidth.value
  ctx.value.lineCap = 'round'
  ctx.value.lineJoin = 'round'
}

function updateContextColor() {
  if (ctx.value) {
    ctx.value.strokeStyle = strokeColor.value
    ctx.value.fillStyle = strokeColor.value
  }
  if (remoteDrawers.value.has(myDrawerId.value)) {
    const drawer = remoteDrawers.value.get(myDrawerId.value)
    drawer.color = strokeColor.value
    updateCursorColor(drawer.cursorElement, strokeColor.value)
  }
}

function updateAllRemoteCursors() {
  remoteDrawers.value.forEach((drawer, id) => {
    if (id !== myDrawerId.value) {
      if (drawer.cursorElement) {
        drawer.cursorElement.style.opacity = '1'
        if (drawer.cursorTimeout) clearTimeout(drawer.cursorTimeout)
        drawer.cursorTimeout = setTimeout(() => {
          if (drawer.cursorElement) drawer.cursorElement.style.opacity = '0'
        }, CURSOR_INACTIVITY_TIMEOUT)
      }
    }
  })
}

function resetInactivityTimer() {
  if (fadeOutInProgress || !drawingMode.value) return
  if (fadeTimeout) clearTimeout(fadeTimeout)
  fadeTimeout = setTimeout(startFadeOut, fadeDelay)
}

function startFadeOut() {
  fadeOutInProgress = true
  const activeCanvas = canvas.value
  const ratio = window.devicePixelRatio || 1
  const fadingCanvas = document.createElement('canvas')
  fadingCanvas.width = activeCanvas.width
  fadingCanvas.height = activeCanvas.height
  fadingCanvas.style.width = window.innerWidth + 'px'
  fadingCanvas.style.height = window.innerHeight + 'px'
  fadingCanvas.className = 'fading-canvas'
  fadingCanvas.style.setProperty('--glow-color', strokeColor.value)
  const fadingCtx = fadingCanvas.getContext('2d')
  fadingCtx.scale(ratio, ratio)
  fadingCtx.drawImage(activeCanvas, 0, 0, activeCanvas.width, activeCanvas.height, 0, 0, window.innerWidth, window.innerHeight)
  canvasContainer.value.appendChild(fadingCanvas)
  clearCanvas()
  const activeDrawerIds = new Set([...remoteDrawers.value.keys(), myDrawerId.value])
  activeDrawerIds.forEach(id => {
    activeFadeouts.value.add(id)
    if (!fadingCanvases.value.has(id)) {
      fadingCanvases.value.set(id, [])
    }
    fadingCanvases.value.get(id).push(fadingCanvas)
  })
  fadingCanvas._associatedDrawerIds = [...activeDrawerIds]
  fadingCanvas.addEventListener('animationend', () => cleanupCanvas(fadingCanvas))
  updateAllRemoteCursors()
}

function cleanupCanvas(fadeCanvas) {
  fadeCanvas._associatedDrawerIds.forEach(id => {
    if (fadingCanvases.value.has(id)) {
      const arr = fadingCanvases.value.get(id)
      const idx = arr.indexOf(fadeCanvas)
      if (idx !== -1) arr.splice(idx, 1)
      if (arr.length === 0) activeFadeouts.value.delete(id)
    }
  })
  fadeCanvas.parentNode?.removeChild(fadeCanvas)
  if (activeFadeouts.value.size === 0) {
    fadeOutInProgress = false
    resetInactivityTimer()
    if (drawingMode.value) updateAllRemoteCursors()
  }
}

function startDrawing(e) {
  if (e.target !== canvas.value) return
  fadeOutInProgress = false
  if (fadeTimeout) { clearTimeout(fadeTimeout); fadeTimeout = null }
  isDrawing.value = true
  lastPos = { x: e.clientX, y: e.clientY }
  lastMidPoint = { ...lastPos }
  withCtx(() => {
    ctx.value.beginPath()
    ctx.value.arc(e.clientX, e.clientY, strokeWidth.value / 2, 0, Math.PI * 2)
    ctx.value.fill()
  })
  sendDrawingEvent('start', lastPos)
  sendCursorPosition(lastPos)
  resetInactivityTimer()
}

function draw(e) {
  if (!isDrawing.value) return
  const currentPos = { x: e.clientX, y: e.clientY }
  const currentMidPoint = { x: (lastPos.x + currentPos.x) / 2, y: (lastPos.y + currentPos.y) / 2 }
  withCtx(() => {
    ctx.value.beginPath()
    ctx.value.moveTo(lastMidPoint.x, lastMidPoint.y)
    ctx.value.quadraticCurveTo(lastPos.x, lastPos.y, currentMidPoint.x, currentMidPoint.y)
    ctx.value.stroke()
  })
  sendDrawingEvent('move', currentPos)
  sendCursorPosition(currentPos)
  lastPos = currentPos
  lastMidPoint = currentMidPoint
  resetInactivityTimer()
}

function stopDrawing(e) {
  if (!isDrawing.value) return
  withCtx(() => {
    ctx.value.beginPath()
    ctx.value.moveTo(lastMidPoint.x, lastMidPoint.y)
    ctx.value.lineTo(e.clientX, e.clientY)
    ctx.value.stroke()
  })
  sendDrawingEvent('stop', { x: e.clientX, y: e.clientY })
  sendCursorPosition({ x: e.clientX, y: e.clientY })
  isDrawing.value = false
  resetInactivityTimer()
}

function updateRemoteDrawer(drawer, drawerId, position, color) {
  drawer.lastPos = position
  updateCursorPosition(drawer.cursorElement, position)
  if (drawer.color !== color) {
    drawer.color = color
    updateCursorColor(drawer.cursorElement, color)
  }
  drawer.lastActivity = Date.now()
  if (drawer.cursorTimeout) clearTimeout(drawer.cursorTimeout)
  drawer.cursorElement.style.opacity = '1'
  drawer.cursorTimeout = setTimeout(() => {
    if (drawer.cursorElement) drawer.cursorElement.style.opacity = '0'
  }, CURSOR_INACTIVITY_TIMEOUT)
}

function handleRemoteDrawingEvent(event) {
  const { drawerId, type, position, color, width } = event
  knownDrawerIds.value.add(drawerId)
  if (type !== 'cursorMove') resetInactivityTimer()
  if (!drawingMode.value) return
  if (drawerId === myDrawerId.value && type === 'cursorMove') {
    if (remoteDrawers.value.has(drawerId)) {
      const drawer = remoteDrawers.value.get(drawerId)
      updateRemoteDrawer(drawer, drawerId, position, color)
    }
    return
  }
  if (!remoteDrawers.value.has(drawerId)) {
    const newCursor = createCursorElement(drawerId, color)
    remoteDrawers.value.set(drawerId, {
      lastPos: position,
      lastMidPoint: position,
      color,
      width,
      isDrawing: type === 'start',
      cursorElement: newCursor,
      lastActivity: Date.now(),
      cursorTimeout: null
    })
  }
  const drawer = remoteDrawers.value.get(drawerId)
  updateRemoteDrawer(drawer, drawerId, position, color)
  if (type === 'start') {
    drawer.isDrawing = true
    drawer.lastMidPoint = position
    withCtx(() => {
      ctx.value.fillStyle = color
      ctx.value.beginPath()
      ctx.value.arc(position.x, position.y, width / 2, 0, Math.PI * 2)
      ctx.value.fill()
    })
  } else if (type === 'move' && drawer.isDrawing) {
    const currentPos = position
    const currentMidPoint = { x: (drawer.lastPos.x + currentPos.x) / 2, y: (drawer.lastPos.y + currentPos.y) / 2 }
    withCtx(() => {
      ctx.value.strokeStyle = drawer.color
      ctx.value.lineWidth = drawer.width
      ctx.value.beginPath()
      ctx.value.moveTo(drawer.lastMidPoint.x, drawer.lastMidPoint.y)
      ctx.value.quadraticCurveTo(drawer.lastPos.x, drawer.lastPos.y, currentMidPoint.x, currentMidPoint.y)
      ctx.value.stroke()
    })
    drawer.lastPos = currentPos
    drawer.lastMidPoint = currentMidPoint
  } else if (type === 'stop') {
    if (drawer.isDrawing) {
      withCtx(() => {
        ctx.value.strokeStyle = drawer.color
        ctx.value.lineWidth = drawer.width
        ctx.value.beginPath()
        ctx.value.moveTo(drawer.lastMidPoint.x, drawer.lastMidPoint.y)
        ctx.value.lineTo(position.x, position.y)
        ctx.value.stroke()
      })
    }
    drawer.isDrawing = false
  }
}

function createCursorElement(drawerId, color) {
  const cursor = document.createElement('div')
  cursor.className = 'remote-cursor'
  cursor.dataset.drawerId = drawerId
  const pointer = document.createElement('div')
  pointer.className = 'cursor-pointer'
  pointer.style.backgroundColor = color
  const label = document.createElement('div')
  label.className = 'cursor-label'
  label.textContent = drawerId === myDrawerId.value ? `${drawerId} (You)` : drawerId
  if (drawerId === myDrawerId.value) label.classList.add('own-cursor')
  cursor.appendChild(pointer)
  cursor.appendChild(label)
  canvasContainer.value.appendChild(cursor)
  cursor.style.opacity = '0'
  return cursor
}

function updateCursorPosition(cursorElement, position) {
  if (cursorElement) {
    cursorElement.style.left = `${position.x}px`
    cursorElement.style.top = `${position.y}px`
  }
}

function updateCursorColor(cursorElement, color) {
  const pointer = cursorElement?.querySelector('.cursor-pointer')
  if (pointer) pointer.style.backgroundColor = color
}

function handleColorChange(newColor) {
  const currentPos = remoteDrawers.value.get(myDrawerId.value)?.lastPos
  strokeColor.value = newColor
  updateContextColor()
  if (remoteDrawers.value.has(myDrawerId.value)) {
    updateCursorColor(remoteDrawers.value.get(myDrawerId.value).cursorElement, newColor)
  }
  if (drawingMode.value && currentPos) sendCursorPosition(currentPos)
  if (window.electron?.setWhiteboardColor) {
    window.electron.setWhiteboardColor(newColor).catch(err => console.error('Error', err))
  }
}
const changeColor = handleColorChange

function handleCustomColor(e) {
  handleColorChange(e.target.value)
}

function showDrawingCursors() {
  if (!remoteDrawers.value.has(myDrawerId.value)) {
    const newCursor = createCursorElement(myDrawerId.value, strokeColor.value)
    remoteDrawers.value.set(myDrawerId.value, {
      lastPos: { x: 0, y: 0 },
      lastMidPoint: { x: 0, y: 0 },
      color: strokeColor.value,
      width: strokeWidth.value,
      isDrawing: false,
      cursorElement: newCursor,
      lastActivity: Date.now(),
      cursorTimeout: null
    })
  } else if (!remoteDrawers.value.get(myDrawerId.value).cursorElement) {
    const newCursor = createCursorElement(myDrawerId.value, strokeColor.value)
    remoteDrawers.value.get(myDrawerId.value).cursorElement = newCursor
  }
  if (lastMousePos) {
    const myDrawer = remoteDrawers.value.get(myDrawerId.value)
    myDrawer.lastPos = lastMousePos
    updateCursorPosition(myDrawer.cursorElement, lastMousePos)
    myDrawer.cursorElement.style.opacity = '1'
  }
  updateAllRemoteCursors()
}

function hideDrawingCursors() {
  remoteDrawers.value.forEach(drawer => {
    if (drawer.cursorTimeout) {
      clearTimeout(drawer.cursorTimeout)
      drawer.cursorTimeout = null
    }
    if (drawer.cursorElement?.parentNode) {
      drawer.cursorElement.parentNode.removeChild(drawer.cursorElement)
      drawer.cursorElement = null
    }
  })
  document.querySelectorAll('.remote-cursor').forEach(el => el.parentNode?.removeChild(el))
}

function toggleDrawingMode(enabled) {
  drawingMode.value = enabled
  document.body.classList.toggle('drawing-mode', enabled)
  document.documentElement.classList.toggle('drawing-mode', enabled)
  if (enabled) {
    showDrawingCursors()
  } else {
    hideDrawingCursors()
    if (isDrawing.value) isDrawing.value = false
  }
}

function sendDrawingEvent(eventType, position) {
  if (drawingMode.value && window.electron?.sendDrawingEvent) {
    window.electron.sendDrawingEvent({
      type: eventType,
      position,
      color: strokeColor.value,
      width: strokeWidth.value,
      drawerId: myDrawerId.value
    })
  }
}

function sendCursorPosition(position) {
  if (drawingMode.value && window.electron?.sendDrawingEvent) {
    const cursorEvent = {
      type: 'cursorMove',
      position,
      color: strokeColor.value,
      width: strokeWidth.value,
      drawerId: myDrawerId.value
    }
    window.electron.sendDrawingEvent(cursorEvent)
    const myDrawer = remoteDrawers.value.get(myDrawerId.value)
    if (!myDrawer || !myDrawer.cursorElement) {
      handleRemoteDrawingEvent(cursorEvent)
    } else {
      updateRemoteDrawer(myDrawer, myDrawerId.value, position, strokeColor.value)
    }
  }
}

onMounted(() => {
  initCanvas()
  const cursors = document.querySelectorAll('.remote-cursor')
  const map = new Map()
  cursors.forEach(el => {
    const id = el.dataset.drawerId
    if (!id) return
    if (!map.has(id)) map.set(id, [])
    map.get(id).push(el)
  })
  map.forEach((els, id) => {
    if (els.length > 1) {
      for (let i = 1; i < els.length; i++) {
        els[i].parentNode?.removeChild(els[i])
      }
    }
  })
  remoteDrawers.value.clear()
  knownDrawerIds.value.clear()
  myDrawerId.value = generateRandomName()
  knownDrawerIds.value.add(myDrawerId.value)
  if (window.electron?.getWhiteboardColor) {
    window.electron.getWhiteboardColor().then(savedColor => {
      if (savedColor) {
        strokeColor.value = savedColor
        updateContextColor()
      }
    }).catch(err => console.error('Error', err))
  }
  window.addEventListener('resize', handleResize)
  canvas.value.addEventListener('mousedown', startDrawing)
  const mouseMoveHandler = (e) => {
    if (isDrawing.value) draw(e)
    lastMousePos = { x: e.clientX, y: e.clientY }
    resetInactivityTimer()
  }
  canvas.value.addEventListener('mousemove', mouseMoveHandler)
  canvas.value.addEventListener('mouseup', stopDrawing)
  canvas.value.addEventListener('mouseout', stopDrawing)
  canvas.value._mouseMoveHandler = mouseMoveHandler
  if (window.electron?.onToggleDrawing) {
    window.electron.onToggleDrawing(toggleDrawingMode)
  }
  if (window.electron?.onRemoteDrawingEvent) {
    window.electron.onRemoteDrawingEvent((event) => {
      handleRemoteDrawingEvent(event)
    })
  }
  const cursorMoveHandler = (e) => {
    lastMousePos = { x: e.clientX, y: e.clientY }
    if (drawingMode.value) sendCursorPosition({ x: e.clientX, y: e.clientY })
  }
  window.addEventListener('mousemove', cursorMoveHandler)
  window._cursorMoveHandler = cursorMoveHandler
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  canvas.value.removeEventListener('mousedown', startDrawing)
  canvas.value.removeEventListener('mousemove', canvas.value._mouseMoveHandler)
  canvas.value.removeEventListener('mouseup', stopDrawing)
  canvas.value.removeEventListener('mouseout', stopDrawing)
  document.body.classList.remove('drawing-mode')
  document.documentElement.classList.remove('drawing-mode')
  hideDrawingCursors()
  window.removeEventListener('mousemove', window._cursorMoveHandler)
  fadingCanvases.value.forEach(arr => arr.forEach(c => c.parentNode?.removeChild(c)))
  fadingCanvases.value.clear()
})
</script>

<template>
  <div ref="canvasContainer" class="canvas-container" :class="{ 'drawing-mode': drawingMode }">
    <canvas ref="canvas" class="active-canvas" :class="{ 'drawing-mode': drawingMode }"></canvas>
    <div v-if="drawingMode" class="color-picker" @mousedown.stop @pointerdown.stop @click.stop>
      <div class="color-options">
        <div
          v-for="color in presetColors"
          :key="color"
          class="color-circle"
          :class="{ 'selected': color === strokeColor }"
          :style="{ backgroundColor: color, color: color }"
          @mousedown.stop @pointerdown.stop @click.stop="changeColor(color)"
        ></div>
      </div>
    </div>
  </div>
</template>

<style>
:root {
  --cursor-size: 8px;
  --cursor-border-radius: 50%;
  --color-picker-bg: rgba(0, 0, 0, 0.5);
  --color-picker-padding: 8px 12px;
  --color-picker-border-radius: 20px;
  --color-picker-box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  --color-picker-animation-duration: 0.4s;
  --color-picker-animation-timing: cubic-bezier(0.25, 0.8, 0.25, 1);
}

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
.active-canvas {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 10;
}
.drawing-mode,
.drawing-mode * {
  cursor: none !important;
}
.remote-cursor {
  position: absolute;
  z-index: 9999;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s ease;
}
.cursor-pointer {
  width: var(--cursor-size);
  height: var(--cursor-size);
  border-radius: var(--cursor-border-radius);
  transform: translate(-50%, -50%);
  position: absolute;
  top: 0;
  left: 0;
}
.cursor-label {
  position: absolute;
  top: calc(var(--cursor-size) + 8px);
  left: 0;
  background-color: rgba(42, 41, 46, 0.8);
  color: white;
  border-radius: 10px;
  font-size: 12px;
  font-weight: bold;
  white-space: nowrap;
  transform: translateX(-50%);
  padding: 0.5rem 0.7rem;
}
.fading-canvas {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  pointer-events: none;
  animation: fadeOutBlur 0.8s cubic-bezier(0.2, 0, 0.4, 1) forwards;
  will-change: opacity, filter;
  backface-visibility: hidden;
  transform: translateZ(0);
}
@keyframes fadeOutBlur {
  0% { opacity: 1; filter: blur(0px) brightness(1); }
  15% { opacity: 0.6; filter: blur(2px) brightness(1.1) drop-shadow(0 0 2px var(--glow-color, currentColor)); }
  30% { opacity: 0.35; filter: blur(3px) brightness(1.05) drop-shadow(0 0 2px var(--glow-color, currentColor)); }
  50% { opacity: 0.15; filter: blur(4px) brightness(1) drop-shadow(0 0 1px var(--glow-color, currentColor)); }
  75% { opacity: 0.05; filter: blur(5px) brightness(1) drop-shadow(0 0 0 var(--glow-color, currentColor)); }
  100% { opacity: 0; filter: blur(6px) brightness(1); }
}
.color-picker {
  position: fixed;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  background: var(--color-picker-bg);
  backdrop-filter: blur(10px);
  padding: var(--color-picker-padding);
  border-radius: var(--color-picker-border-radius);
  display: flex;
  align-items: center;
  box-shadow: var(--color-picker-box-shadow);
  animation: jumpIn var(--color-picker-animation-duration) var(--color-picker-animation-timing);
}
@keyframes jumpIn {
  0% { opacity: 0; transform: translateX(-50%) translateY(8px) scale(0.97); }
  60% { opacity: 0.7; transform: translateX(-50%) translateY(0) scale(1.02); }
  100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
}
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
.color-circle:active { transform: scale(1.2); }
.color-circle.selected {
  transform: scale(1.15);
  border: 2px solid currentColor;
  box-shadow: 0 0 5px currentColor;
}
</style>
