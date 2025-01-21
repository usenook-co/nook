// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer, shell } = require('electron')
const { desktopCapturer } = require('@electron/remote')

contextBridge.exposeInMainWorld('electron', {
  startDrag: () => ipcRenderer.send('startDrag'),
  stopDrag: () => ipcRenderer.send('stopDrag'),
  startResize: () => ipcRenderer.send('startResize'),
  stopResize: () => ipcRenderer.send('stopResize'),
  openExternal: url => shell.openExternal(url),
  createInitiatorWindow: () => ipcRenderer.send('createInitiatorWindow'),
  writeToClipboard: text => ipcRenderer.invoke('writeToClipboard', text),
  setWindowSize: (width, height, maintainCenter = false) =>
    ipcRenderer.invoke('setWindowSize', width, height, maintainCenter),
  setAspectRatio: ratio => ipcRenderer.invoke('setAspectRatio', ratio),
  setAlwaysOnTop: value => ipcRenderer.invoke('setAlwaysOnTop', value),
  getScreenSources: async () => {
    try {
      return await desktopCapturer.getSources({ types: ['screen', 'window'] })
    } catch (err) {
      console.error('Error getting screen sources:', err)
      throw err
    }
  },
  openGifSelector: () => ipcRenderer.invoke('openGifSelector'),
  onGifSelected: callback => {
    // Remove any existing listeners to avoid duplicates
    ipcRenderer.removeAllListeners('gifSelected')
    // Add the new callback
    ipcRenderer.on('gifSelected', (event, gifUrl) => {
      console.log('GIF selected event received in preload:', gifUrl)
      callback(gifUrl)
    })
  }
})

console.log('Main window preload script completed')
