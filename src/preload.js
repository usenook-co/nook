// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer, shell } = require('electron')

// Expose protected methods that allow the renderer process to use
contextBridge.exposeInMainWorld('electron', {
  startDrag: () => ipcRenderer.send('startDrag'),
  stopDrag: () => ipcRenderer.send('stopDrag'),
  startResize: () => ipcRenderer.send('startResize'),
  stopResize: () => ipcRenderer.send('stopResize'),
  openExternal: url => shell.openExternal(url),
  createInitiatorWindow: () => ipcRenderer.send('createInitiatorWindow'),
  writeToClipboard: text => ipcRenderer.invoke('writeToClipboard', text)
})
