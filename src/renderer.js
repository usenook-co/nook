import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import Root from './components/Root.vue'
import App from './App.vue'
import GifSelectorWindow from './components/GifSelectorWindow.vue'
import OnboardingLayout from './components/OnboardingLayout.vue'
import PermissionCheck from './components/PermissionCheck.vue'
import RoomSelection from './components/RoomSelection.vue'
import './reset.css'

// Check if we're in the GIF selector window
const isGifSelector = window.location.hash === '#gif-selector'

// Log the window mode and presence of electron object
console.log(
  `Initializing ${isGifSelector ? 'GIF selector' : 'main'} window.`,
  'electron object available:',
  !!window.electron
)

if (isGifSelector) {
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
  // Define routes for the main application
  const routes = [
    {
      path: '/',
      component: OnboardingLayout,
      children: [
        {
          path: '',
          name: 'permissionCheck',
          component: PermissionCheck
        },
        {
          path: 'room-selection',
          name: 'roomSelection',
          component: RoomSelection
        }
      ]
    },
    {
      path: '/call',
      name: 'call',
      component: App
    }
  ]

  // Create router instance
  const router = createRouter({
    history: createWebHashHistory(),
    routes
  })

  // Mount the main app with router
  const app = createApp(Root)
  app.use(router)
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
console.log(`${isGifSelector ? 'GIF selector' : 'Main app'} initialized`)
