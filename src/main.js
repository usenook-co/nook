import { app, BrowserWindow, ipcMain, clipboard } from 'electron'
import path from 'node:path'
import { spawn } from 'child_process'
import started from 'electron-squirrel-startup'
import Store from 'electron-store'

// Initialize remote module
const remote = require('@electron/remote/main')
remote.initialize()

const store = new Store()

let isDragging = false
let lastMousePos = { x: 0, y: 0 }
let mainWindow = null
let windowPos = { x: 0, y: 0 }

ipcMain.on('startDrag', () => {
  isDragging = true
})

ipcMain.on('stopDrag', () => {
  isDragging = false
})

ipcMain.on('startResize', () => {
  isResizing = true
  initialBounds = mainWindow.getBounds()
})

ipcMain.on('stopResize', () => {
  isResizing = false
  initialBounds = null
})

if (started) {
  app.quit()
}

function animateWindow(window, startBounds, endBounds, duration = 300) {
  const startTime = Date.now()

  const animate = () => {
    const now = Date.now()
    const elapsed = now - startTime
    const progress = Math.min(elapsed / duration, 1)

    // Ease out cubic function for smooth deceleration
    const easeOut = 1 - Math.pow(1 - progress, 3)

    const currentBounds = {
      x: Math.round(startBounds.x + (endBounds.x - startBounds.x) * easeOut),
      y: Math.round(startBounds.y + (endBounds.y - startBounds.y) * easeOut),
      width: Math.round(startBounds.width + (endBounds.width - startBounds.width) * easeOut),
      height: Math.round(startBounds.height + (endBounds.height - startBounds.height) * easeOut)
    }

    window.setBounds(currentBounds)

    if (progress < 1) {
      setTimeout(animate, 16) // roughly 60fps
    } else {
      // Animation complete, update tracking variables
      windowPos = { x: endBounds.x, y: endBounds.y }
      isDragging = false
    }
  }

  animate()
}

function createWindow(hash = '') {
  // Get saved position or use default centered position
  const savedPosition = store.get('windowPosition')
  const { width, height } = { width: 600, height: 300 }

  // Get screen dimensions to ensure window is visible
  const { screen } = require('electron')
  const primaryDisplay = screen.getPrimaryDisplay()
  const { workArea } = primaryDisplay

  // Ensure saved position is within visible screen bounds
  let x = savedPosition ? savedPosition.x : Math.round(workArea.x + (workArea.width - width) / 2)
  let y = savedPosition ? savedPosition.y : Math.round(workArea.y + (workArea.height - height) / 2)

  // Validate position is on screen
  x = Math.min(Math.max(x, workArea.x), workArea.x + workArea.width - width)
  y = Math.min(Math.max(y, workArea.y), workArea.y + workArea.height - height)

  const win = new BrowserWindow({
    width,
    height,
    x,
    y,
    transparent: true,
    frame: false,
    backgroundColor: '#00000000',
    hasShadow: false,
    alwaysOnTop: true,
    minWidth: 600,
    minHeight: 300,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: true,
      webSecurity: true,
      spellcheck: false,
      sandbox: false
    }
  })

  // Capture all console messages from the renderer process
  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levels = ['log', 'warn', 'error', 'info', 'debug']
    const prefix = sourceId ? `[${sourceId.split('/').pop()}:${line}]` : '[Renderer]'
    switch (levels[level] || 'log') {
      case 'warn':
        console.warn(prefix, message)
        break
      case 'error':
        console.error(prefix, message)
        break
      case 'info':
        console.info(prefix, message)
        break
      case 'debug':
        console.debug(prefix, message)
        break
      default:
        console.log(prefix, message)
    }
  })

  // Set 2:1 aspect ratio immediately after creation
  win.setAspectRatio(2)

  // Initialize window position tracking
  const bounds = win.getBounds()
  windowPos = { x: bounds.x, y: bounds.y }

  // Save window position when it moves
  win.on('moved', () => {
    const position = win.getBounds()
    store.set('windowPosition', { x: position.x, y: position.y })
  })

  // Enable screen capture
  win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'clipboard-read', 'clipboard-write', 'screen', 'desktop-capture']
    console.log('Permission requested:', permission)
    if (allowedPermissions.includes(permission)) {
      callback(true)
    } else {
      callback(false)
    }
  })

  // Set default media permissions
  win.webContents.session.setPermissionCheckHandler((webContents, permission) => {
    const allowedPermissions = ['media', 'clipboard-read', 'clipboard-write', 'screen', 'desktop-capture']
    console.log('Permission check:', permission)
    return allowedPermissions.includes(permission)
  })

  // Request media access by default
  win.webContents.session.setDevicePermissionHandler(details => {
    console.log('Device permission requested:', details)
    return true
  })

  // Enable media permissions
  win.webContents.session.setDisplayMediaRequestHandler((request, callback) => {
    console.log('Display media requested')
    callback(true)
  })

  // Enable remote module access for this window
  remote.enable(win.webContents)

  const mouseTracker = spawn('./mouse_tracker')

  mouseTracker.stdout.on('data', data => {
    try {
      const [eventType, x, y] = data.toString().trim().split(',')
      const mouseX = parseFloat(x)
      const mouseY = parseFloat(y)

      if (!isNaN(mouseX) && !isNaN(mouseY)) {
        if (isDragging && (eventType === 'move' || eventType === 'drag')) {
          const deltaX = mouseX - lastMousePos.x
          const deltaY = mouseY - lastMousePos.y

          windowPos.x += deltaX
          windowPos.y += deltaY
          win.setPosition(Math.round(windowPos.x), Math.round(windowPos.y))
        }

        lastMousePos = { x: mouseX, y: mouseY }
      }
    } catch (error) {
      console.error('Error processing mouse data:', error)
    }
  })

  win.on('closed', () => {
    mouseTracker.kill()
  })

  const url = MAIN_WINDOW_VITE_DEV_SERVER_URL
    ? MAIN_WINDOW_VITE_DEV_SERVER_URL + hash
    : path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)

  console.log('Loading URL:', url, 'with hash:', hash)

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    win.loadURL(url)
  } else {
    win.loadFile(url, { hash })
  }

  return win
}

// Add IPC handler for creating new windows
ipcMain.on('createInitiatorWindow', () => {
  console.log('Creating initiator window')
  createWindow('#init')
})

app.whenReady().then(() => {
  mainWindow = createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Add this with other IPC handlers
ipcMain.handle('writeToClipboard', async (event, text) => {
  try {
    clipboard.writeText(text)
    return { success: true }
  } catch (error) {
    console.error('Error writing to clipboard:', error)
    return { success: false, error: error.message }
  }
})

// Add this with other IPC handlers
ipcMain.handle('setWindowSize', async (event, width, height, maintainCenter) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (window) {
    const currentBounds = window.getBounds()
    const newWidth = Math.max(width, 400)
    const newHeight = Math.max(height, 200)

    if (maintainCenter) {
      const deltaWidth = newWidth - currentBounds.width
      const newX = currentBounds.x - deltaWidth / 2
      const endBounds = {
        x: Math.round(newX),
        y: currentBounds.y,
        width: newWidth,
        height: newHeight
      }
      animateWindow(window, currentBounds, endBounds)
    } else {
      const endBounds = {
        x: currentBounds.x,
        y: currentBounds.y,
        width: newWidth,
        height: newHeight
      }
      animateWindow(window, currentBounds, endBounds)
    }
  }
})

// Add this with other IPC handlers
ipcMain.handle('setAspectRatio', async (event, ratio) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (window) {
    // Set aspect ratio first
    window.setAspectRatio(ratio)

    // Get current bounds after aspect ratio is set
    const currentBounds = window.getBounds()
    // Calculate new width based on current height and ratio
    const newWidth = Math.max(currentBounds.height * ratio, 400)
    const deltaWidth = newWidth - currentBounds.width
    const newX = currentBounds.x - deltaWidth / 2

    const endBounds = {
      x: Math.round(newX),
      y: currentBounds.y,
      width: newWidth,
      height: currentBounds.height
    }

    animateWindow(window, currentBounds, endBounds)
  }
})

// Add this with other IPC handlers
ipcMain.handle('setAlwaysOnTop', async (event, value) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (window) {
    window.setAlwaysOnTop(value)
  }
})
