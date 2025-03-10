// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer, shell } = require('electron')
const { desktopCapturer } = require('@electron/remote')

contextBridge.exposeInMainWorld('electron', {
  // Window management
  startDrag: () => ipcRenderer.send('startDrag'),
  stopDrag: () => ipcRenderer.send('stopDrag'),

  // Route-based window API
  setWindowForRoute: route => ipcRenderer.invoke('setWindowForRoute', route),
  getCurrentRoute: () => ipcRenderer.invoke('getCurrentRoute'),

  // Navigation event system
  notifyRouteNavigated: route => ipcRenderer.send('route-navigated', route),
  onRouteChangeRequested: callback => {
    // Remove any existing listeners to avoid duplicates
    ipcRenderer.removeAllListeners('route-change-requested')
    // Add the new callback
    ipcRenderer.on('route-change-requested', (event, route) => {
      callback(route)
    })
  },

  setAspectRatio: ratio => ipcRenderer.invoke('setAspectRatio', ratio),
  setWindowSize: (width, height, maintainCenter = false) =>
    ipcRenderer.invoke('setWindowSize', width, height, maintainCenter),
  setAlwaysOnTop: value => ipcRenderer.invoke('setAlwaysOnTop', value),
  writeToClipboard: text => ipcRenderer.invoke('writeToClipboard', text),

  // Screen sharing
  getScreenSources: async () => {
    try {
      return await desktopCapturer.getSources({ types: ['screen', 'window'] })
    } catch (err) {
      console.error('Error getting screen sources:', err)
      throw err
    }
  },

  // GIF selector functions
  openGifSelector: () => ipcRenderer.invoke('openGifSelector'),
  onGifSelected: callback => {
    // Remove any existing listeners to avoid duplicates
    ipcRenderer.removeAllListeners('gifSelected')
    // Add the new callback
    ipcRenderer.on('gifSelected', (event, gifUrl) => {
      console.log('GIF selected event received in preload:', gifUrl)
      callback(gifUrl)
    })
  },
  closeGifSelector: gifUrl => {
    console.log('Calling closeGifSelector from preload', gifUrl ? 'with GIF URL' : '')
    return ipcRenderer.invoke('closeGifSelector', gifUrl).catch(err => {
      console.error('Error in closeGifSelector:', err)
    })
  },
  selectGif: gifUrl => {
    console.log('Calling selectGif from preload with URL:', gifUrl)
    return ipcRenderer.invoke('selectGif', gifUrl).catch(err => {
      console.error('Error in selectGif:', err)
    })
  },

  // External link handling
  openExternal: url => shell.openExternal(url)
})

console.log('Preload script completed')
