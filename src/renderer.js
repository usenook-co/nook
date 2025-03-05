import { createApp } from 'vue'
import App from './App.vue'
import GifSelectorWindow from './components/GifSelectorWindow.vue'
import WhiteboardWindow from './components/WhiteboardWindow.vue'

// Check which window we're in
const isGifSelector = window.location.hash === '#gif-selector'
const isWhiteboard = window.location.hash === '#whiteboard'

// Log the window mode
console.log(
  `Initializing ${isWhiteboard ? 'whiteboard' : isGifSelector ? 'GIF selector' : 'main'} window.`,
  'electron object available:',
  !!window.electron
)

if (isWhiteboard) {
  // Configure whiteboard window styles for transparency
  document.documentElement.classList.add('whiteboard-page')
  document.documentElement.style.background = 'transparent'
  document.body.style.margin = '0'
  document.body.style.padding = '0'
  document.body.style.overflow = 'hidden'
  document.body.style.height = '100vh'
  document.body.style.width = '100vw'
  document.body.style.backgroundColor = 'transparent'
  document.body.style.cursor = 'default'
  
  // Add a debug message element that will show for a few seconds
  const debugDiv = document.createElement('div')
  debugDiv.style.position = 'fixed'
  debugDiv.style.top = '10px'
  debugDiv.style.left = '10px'
  debugDiv.style.padding = '5px'
  debugDiv.style.backgroundColor = 'rgba(255,255,255,0.8)'
  debugDiv.style.color = 'black'
  debugDiv.style.borderRadius = '5px'
  debugDiv.style.zIndex = '10000'
  debugDiv.style.fontSize = '12px'
  debugDiv.textContent = 'Whiteboard initialized - Press Command+D to toggle drawing mode'
  document.body.appendChild(debugDiv)
  
  // Remove the debug element after 5 seconds
  setTimeout(() => {
    debugDiv.style.opacity = '0'
    debugDiv.style.transition = 'opacity 1s'
    setTimeout(() => debugDiv.remove(), 1000)
  }, 5000)
  
  // Mount the whiteboard app
  const app = createApp(WhiteboardWindow)
  app.mount('#app')
  
  console.log('Whiteboard window mounted')
} else if (isGifSelector) {
  // Add special styles to the GIF selector window
  document.documentElement.classList.add('gif-selector-page')
  document.body.style.margin = '0'
  document.body.style.padding = '0'
  document.body.style.overflow = 'hidden'
  document.body.style.height = '100vh'
  document.body.style.width = '100vw'
  document.body.style.backgroundColor = '#121212'

  // Create a direct communication method without relying on window.electron
  window.selectGif = gifUrl => {
    console.log('Using direct IPC for GIF selection:', gifUrl)
    // Use a direct message approach with postMessage
    window.opener.postMessage({ type: 'gifSelected', gifUrl }, '*')
    window.close()
  }

  window.closeGifSelector = () => {
    window.close()
  }

  // Mount the app
  const app = createApp(GifSelectorWindow)
  app.mount('#app')
} else {
  // Mount the main app
  const app = createApp(App)
  app.mount('#app')

  // Listen for messages from the GIF selector window
  window.addEventListener('message', event => {
    if (event.data && event.data.type === 'gifSelected') {
      console.log('Received GIF selection via postMessage:', event.data.gifUrl)
      // Handle the selected GIF
      if (window.electron && window.electron.onGifSelected) {
        const callback = app.config.globalProperties.$_gifSelectedCallback
        if (callback) callback(event.data.gifUrl)
      }
    }
  })
}

// Log for debugging
console.log(`${isWhiteboard ? 'Whiteboard' : isGifSelector ? 'GIF selector' : 'Main app'} initialized`)
