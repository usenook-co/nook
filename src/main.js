import { app, BrowserWindow, ipcMain, clipboard } from 'electron'
import path from 'node:path'
import { spawn } from 'child_process'
import started from 'electron-squirrel-startup'
require('@electron/remote/main').initialize()

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
  const mainWindow = new BrowserWindow({
    width: 440,
    height: 300,
    transparent: true,
    frame: false,
    backgroundColor: '#00000000',
    hasShadow: false,
    alwaysOnTop: true,
    minWidth: 440,
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

  // Enable screen capture
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'clipboard-read', 'clipboard-write']
    console.log('Permission requested:', permission)
    if (allowedPermissions.includes(permission)) {
      callback(true)
    } else {
      callback(false)
    }
  })

  // Set default media permissions
  mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission) => {
    const allowedPermissions = ['media', 'clipboard-read', 'clipboard-write']
    console.log('Permission check:', permission)
    return allowedPermissions.includes(permission)
  })

  // Request media access by default
  mainWindow.webContents.session.setDevicePermissionHandler(details => {
    console.log('Device permission requested:', details)
    return true
  })

  // Enable media permissions
  mainWindow.webContents.session.setDisplayMediaRequestHandler((request, callback) => {
    console.log('Display media requested')
    callback(true)
  })

  // Set 2:1 aspect ratio
  mainWindow.setAspectRatio(2)

  require('@electron/remote/main').enable(mainWindow.webContents)

  const bounds = mainWindow.getBounds()
  windowPos = { x: bounds.x, y: bounds.y }

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
          mainWindow.setPosition(Math.round(windowPos.x), Math.round(windowPos.y))
        }

        lastMousePos = { x: mouseX, y: mouseY }
      }
    } catch (error) {
      console.error('Error processing mouse data:', error)
    }
  })

  mainWindow.on('closed', () => {
    mouseTracker.kill()
  })

  const url = MAIN_WINDOW_VITE_DEV_SERVER_URL
    ? MAIN_WINDOW_VITE_DEV_SERVER_URL + hash
    : path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)

  console.log('Loading URL:', url, 'with hash:', hash)

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(url)
  } else {
    mainWindow.loadFile(url, { hash })
  }

  return mainWindow
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
