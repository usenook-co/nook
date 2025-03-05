const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  // Basic window controls
  closeWhiteboard: () => ipcRenderer.invoke('closeWhiteboard'),
  
  // Drawing mode toggling
  onToggleDrawing: (callback) => {
    ipcRenderer.removeAllListeners('toggleDrawing')
    ipcRenderer.on('toggleDrawing', (_, enabled) => {
      console.log('Drawing mode toggled:', enabled)
      callback(enabled)
    })
  },
  
  // Add notification handler
  onShowNotification: (callback) => {
    ipcRenderer.removeAllListeners('showNotification')
    ipcRenderer.on('showNotification', (event, data) => {
      console.log('Notification received:', data)
      callback(data)
    })
  },
  
  // Improve the mouse event handler to normalize events
  onMouseEvent: (callback) => {
    console.log('Registering mouseEvent listener');
    ipcRenderer.removeAllListeners('mouseEvent')
    ipcRenderer.on('mouseEvent', (event, data) => {
      // Normalize event type to handle potential inconsistencies
      let normalizedType = data.type.toLowerCase();
      
      // Make sure we're using consistent event types
      if (normalizedType === 'drag') normalizedType = 'move';
      
      // Create a more consistent event object
      const normalizedEvent = {
        type: normalizedType,
        x: data.x,
        y: data.y,
        timestamp: Date.now()
      };
      
      callback(normalizedEvent);
    })
  },
  
  // Methods to save drawings (can be implemented later)
  saveDrawing: (dataUrl) => ipcRenderer.invoke('saveDrawing', dataUrl),
  
  // Add this to your exposed electron APIs
  setCursor: (cursorType) => {
    console.log(`Setting cursor to: ${cursorType}`);
    // First try to set it through IPC
    ipcRenderer.invoke('setCursor', cursorType).catch(err => {
      console.warn('Error setting cursor via IPC:', err);
      // Fallback to direct DOM setting if IPC fails
      document.documentElement.style.cursor = cursorType;
      document.body.style.cursor = cursorType;
    });
  },
  
  // Add drawing synchronization methods
  sendDrawingEvent: (drawingData) => {
    ipcRenderer.invoke('sendDrawingEvent', drawingData)
  },
  
  onRemoteDrawingEvent: (callback) => {
    ipcRenderer.on('remoteDrawingEvent', (_, data) => {
      callback(data)
    })
  },
  
  // Add methods to get and set the whiteboard color preference
  getWhiteboardColor: () => ipcRenderer.invoke('getWhiteboardColor'),
  setWhiteboardColor: (color) => ipcRenderer.invoke('setWhiteboardColor', color)
})

console.log('Whiteboard preload script loaded')

// Add this to your preload.js file
ipcRenderer.on('applyCursor', (event, cursorType) => {
  const styleEl = document.getElementById('electron-cursor-style') || document.createElement('style');
  styleEl.id = 'electron-cursor-style';
  styleEl.textContent = `* { cursor: ${cursorType} !important; }`;
  
  if (!styleEl.parentNode) {
    document.head.appendChild(styleEl);
  }
}); 