// GIF Selector window preload script
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
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
  }
})
