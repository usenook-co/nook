import { app, BrowserWindow, ipcMain, clipboard, screen } from 'electron'
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
let gifSelectorWindow = null

// Use a single preload script for all windows
const preloadPath = path.join(__dirname, 'preload.js')

// Mouse tracker setup - only create one mouse tracker for the entire app
let mouseTracker = null
let mouseTrackerInitialized = false

const DEFAULT_WINDOW_CONFIG = {
  frame: false,
  backgroundColor: 'black',
  transparent: false,
  hasShadow: false
}

// Route-based window configuration
const ROUTE_WINDOW_CONFIG = {
  // Root and onboarding routes
  '/': {
    minWidth: 350,
    minHeight: 400,
    alwaysOnTop: false,
    width: 380,
    height: 480
  },
  // Also apply to other onboarding routes
  '/permission-check': {
    minWidth: 350,
    minHeight: 400,
    alwaysOnTop: false,
    width: 380,
    height: 580
  },
  '/room-selection': {
    transparent: true,
    hasShadow: true,
    minWidth: 350,
    minHeight: 400,
    alwaysOnTop: false,
    width: 380,
    height: 480
  },
  // Call route
  '/call': {
    transparent: true,
    frame: false,
    backgroundColor: '#00000000',
    hasShadow: false,
    minWidth: 400,
    minHeight: 200,
    alwaysOnTop: true,
    width: 600,
    height: 300
  }
}

// Default route for initial window configuration
const DEFAULT_ROUTE = '/'
let currentRoute = DEFAULT_ROUTE

function initializeMouseTracker() {
  if (mouseTrackerInitialized) return

  mouseTracker = spawn('./mouse_tracker')

  mouseTracker.stdout.on('data', data => {
    try {
      // Convert buffer to string and clean up whitespace
      const dataStr = data.toString().trim()

      // Skip empty data
      if (!dataStr) return

      // Split the data and validate format
      const parts = dataStr.split(',')
      if (parts.length !== 3) {
        console.warn('Invalid mouse tracker data format:', dataStr)
        return
      }

      const [eventType, xStr, yStr] = parts
      const mouseX = parseFloat(xStr)
      const mouseY = parseFloat(yStr)

      // Validate numbers
      if (isNaN(mouseX) || isNaN(mouseY)) {
        console.warn('Invalid mouse coordinates:', xStr, yStr)
        return
      }

      if (isDragging && (eventType === 'move' || eventType === 'drag')) {
        const deltaX = mouseX - lastMousePos.x
        const deltaY = mouseY - lastMousePos.y

        lastMousePos.x = mouseX
        lastMousePos.y = mouseY

        // Move main window if it exists and is not destroyed
        try {
          if (mainWindow && !mainWindow.isDestroyed()) {
            windowPos.x += deltaX
            windowPos.y += deltaY
            mainWindow.setPosition(Math.round(windowPos.x), Math.round(windowPos.y))
          }
        } catch (error) {
          console.error('Error moving window:', error)
          // If we get an error, reset the dragging state
          isDragging = false
        }
      }
    } catch (error) {
      console.error('Error processing mouse data:', error)
    }
  })

  mouseTracker.stderr.on('data', data => {
    console.error(`Mouse tracker stderr: ${data}`)
  })

  mouseTracker.on('close', code => {
    console.log(`Mouse tracker process exited with code ${code}`)
    mouseTrackerInitialized = false
  })

  mouseTrackerInitialized = true
}

// Handle dragging events
ipcMain.on('startDrag', () => {
  isDragging = true

  // Update last mouse position
  const mousePos = screen.getCursorScreenPoint()
  lastMousePos = { x: mousePos.x, y: mousePos.y }
})

ipcMain.on('stopDrag', () => {
  isDragging = false
})

// Create or update window based on route
function createOrUpdateWindow(route = null, url = null) {
  // Save current route
  if (route) {
    // Make sure route starts with '/' for lookup
    const routePath = route.startsWith('/') ? route : `/${route}`
    currentRoute = routePath
  }

  try {
    // Get current position and state
    let currentPosition = null
    let shouldFocus = false
    let currentHash = null

    if (mainWindow && !mainWindow.isDestroyed()) {
      currentPosition = mainWindow.getBounds()
      shouldFocus = mainWindow.isFocused()

      // Extract hash from current URL if available
      if (url) {
        const hashMatch = url.match(/#(.*)$/)
        if (hashMatch) {
          currentHash = hashMatch[1]
        }
      }

      // Clean up the old window
      mainWindow.removeAllListeners()
      mainWindow.close()
      mainWindow = null
    }

    // Get screen dimensions
    const primaryDisplay = screen.getPrimaryDisplay()
    const { workArea } = primaryDisplay

    // Get window config based on route, with fallback to default
    const config = ROUTE_WINDOW_CONFIG[currentRoute] || ROUTE_WINDOW_CONFIG[DEFAULT_ROUTE]

    // Calculate position - default to center screen or use previous position
    const x = currentPosition ? currentPosition.x : Math.round(workArea.x + (workArea.width - config.width) / 2)
    const y = currentPosition ? currentPosition.y : Math.round(workArea.y + (workArea.height - config.height) / 2)

    // Create config with correct position and webPreferences
    const windowConfig = {
      ...DEFAULT_WINDOW_CONFIG,
      ...config,
      x,
      y,
      frame: false,
      webPreferences: {
        preload: preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: true,
        webSecurity: true,
        spellcheck: false,
        sandbox: false
      }
    }

    // Create the window
    mainWindow = new BrowserWindow(windowConfig)

    // Initialize position tracking
    windowPos = { x: windowConfig.x, y: windowConfig.y }

    // Setup console logging
    setupWindowLogs(mainWindow, 'MainWindow')

    // Save window position when it moves
    mainWindow.on('moved', () => {
      const position = mainWindow.getBounds()
      windowPos = { x: position.x, y: position.y }
      store.set('windowPosition', { x: position.x, y: position.y })
    })

    // Set permissions for media access
    mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
      const allowedPermissions = ['media', 'clipboard-read', 'clipboard-write', 'screen', 'desktop-capture']
      if (allowedPermissions.includes(permission)) {
        callback(true)
      } else {
        callback(false)
      }
    })

    // Enable remote module
    remote.enable(mainWindow.webContents)

    // If in call mode, set aspect ratio
    if (currentRoute === '/call') {
      mainWindow.setAspectRatio(2)
    }

    // Enable mouse tracking
    initializeMouseTracker()

    // Load the URL
    if (!url) {
      url = MAIN_WINDOW_VITE_DEV_SERVER_URL
        ? MAIN_WINDOW_VITE_DEV_SERVER_URL
        : `file://${MAIN_WINDOW_VITE_DIST_DIRECTORY}/index.html`
    }

    // Handle URL construction with hash
    if (currentHash) {
      // If we have a hash from previous URL, use it
      url = url.split('#')[0] + '#' + currentHash
      console.log(`Using existing hash: ${currentHash}`)
    } else if (currentRoute !== DEFAULT_ROUTE && !url.includes('#')) {
      // If no hash but we have a specific route, add it
      // For Vue Router, a route of '/call' should become '#/call'
      url = `${url}#${currentRoute}`
      console.log(`Created new hash for route: ${currentRoute}`)
    }

    console.log('Loading URL:', url)
    mainWindow.loadURL(url)

    // Focus if needed
    if (shouldFocus) {
      mainWindow.focus()
    }

    return mainWindow
  } catch (error) {
    console.error('Error creating/updating window:', error)
    return null
  }
}

// IPC handlers for window route changes - now uses event-driven approach
ipcMain.handle('setWindowForRoute', async (event, route) => {
  try {
    // Ensure the route has a leading slash for consistency
    const normalizedRoute = route.startsWith('/') ? route : `/${route}`
    console.log(`setWindowForRoute called with route: ${normalizedRoute}`)

    // Skip recreation if already in the requested route
    if (currentRoute === normalizedRoute && mainWindow && !mainWindow.isDestroyed()) {
      console.log(`Window already in ${normalizedRoute} route, skipping recreation`)
      return true
    }

    // Request route change in renderer first
    // The renderer will call 'route-navigated' when navigation is complete
    return requestRouteChange(normalizedRoute)
  } catch (error) {
    console.error('Error setting window for route:', error)
    return false
  }
})

// Get current route
ipcMain.handle('getCurrentRoute', () => {
  return currentRoute
})

ipcMain.handle('setAspectRatio', async (event, ratio) => {
  if (!mainWindow || mainWindow.isDestroyed()) return false

  try {
    if (currentRoute === '/call') {
      mainWindow.setAspectRatio(ratio)
      return true
    }
    return false
  } catch (error) {
    console.error('Error setting aspect ratio:', error)
    return false
  }
})

ipcMain.handle('setWindowSize', async (event, width, height, maintainCenter = false) => {
  if (!mainWindow || mainWindow.isDestroyed()) return false

  try {
    const bounds = mainWindow.getBounds()

    let newX = bounds.x
    let newY = bounds.y

    if (maintainCenter) {
      newX = Math.round(bounds.x + (bounds.width - width) / 2)
      newY = Math.round(bounds.y + (bounds.height - height) / 2)
    }

    mainWindow.setBounds({ x: newX, y: newY, width, height })
    return true
  } catch (error) {
    console.error('Error setting window size:', error)
    return false
  }
})

// Handle clipboard access
ipcMain.handle('writeToClipboard', async (event, text) => {
  try {
    clipboard.writeText(text)
    return true
  } catch (error) {
    console.error('Error writing to clipboard:', error)
    return false
  }
})

// Setup GIF selector window
function openGifSelectorWindow() {
  if (gifSelectorWindow && !gifSelectorWindow.isDestroyed()) {
    gifSelectorWindow.focus()
    return true
  }

  // Create GIF selector window
  const parentBounds = mainWindow.getBounds()

  gifSelectorWindow = new BrowserWindow({
    width: 400,
    height: 600,
    x: parentBounds.x + parentBounds.width + 20,
    y: parentBounds.y,
    frame: false,
    parent: mainWindow,
    modal: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Setup console logging for this window
  setupWindowLogs(gifSelectorWindow, 'GifSelector')

  // Enable remote module access for this window
  remote.enable(gifSelectorWindow.webContents)

  // Determine URL based on environment
  const url = MAIN_WINDOW_VITE_DEV_SERVER_URL
    ? MAIN_WINDOW_VITE_DEV_SERVER_URL + '#/gif-selector'
    : `file://${MAIN_WINDOW_VITE_DIST_DIRECTORY}/index.html#/gif-selector`

  // Load the GIF selector
  gifSelectorWindow.loadURL(url)

  // Close GIF selector when it loses focus
  gifSelectorWindow.on('blur', () => {
    if (gifSelectorWindow && !gifSelectorWindow.isDestroyed()) {
      gifSelectorWindow.close()
      gifSelectorWindow = null
    }
  })

  return true
}

// Handle IPC events for the GIF selector
ipcMain.handle('openGifSelector', async () => {
  return openGifSelectorWindow()
})

ipcMain.handle('closeGifSelector', async (event, gifUrl) => {
  // Send the selected GIF data to main window
  if (gifUrl && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('gifSelected', gifUrl)
  }

  // Close the GIF selector window
  if (gifSelectorWindow && !gifSelectorWindow.isDestroyed()) {
    gifSelectorWindow.close()
    gifSelectorWindow = null
  }

  return true
})

ipcMain.handle('selectGif', async (event, gifUrl) => {
  // Send the selected GIF data to main window
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('gifSelected', gifUrl)
  }

  // Close the GIF selector window
  if (gifSelectorWindow && !gifSelectorWindow.isDestroyed()) {
    gifSelectorWindow.close()
    gifSelectorWindow = null
  }

  return true
})

// Add setAlwaysOnTop handler
ipcMain.handle('setAlwaysOnTop', async (event, value) => {
  if (!mainWindow || mainWindow.isDestroyed()) return false

  try {
    mainWindow.setAlwaysOnTop(value)
    return true
  } catch (error) {
    console.error('Error setting always on top:', error)
    return false
  }
})

// Set up window console logging
function setupWindowLogs(window, windowName) {
  window.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levels = ['verbose', 'info', 'warning', 'error']
    const prefix = `[${windowName}] `

    switch (level) {
      case 0:
        console.log(prefix + message)
        break
      case 1:
        console.info(prefix + message)
        break
      case 2:
        console.warn(prefix + message)
        break
      case 3:
        console.error(prefix + message)
        break
    }
  })
}

// Main app initialization
app.whenReady().then(() => {
  try {
    // Initialize mouse tracker
    initializeMouseTracker()

    // Create initial window in onboarding state
    createOrUpdateWindow(currentRoute)

    // Listen for window activation events (macOS dock clicks)
    app.on('activate', function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) {
        createOrUpdateWindow(currentRoute)
      } else if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show()
      }
    })
  } catch (error) {
    console.error('Error during app initialization:', error)
    // Try to create fallback window if something goes wrong
    try {
      createOrUpdateWindow(currentRoute)
    } catch (e) {
      console.error('Failed to create fallback window:', e)
    }
  }
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

// IPC handlers for route navigation coordination
ipcMain.on('route-navigated', (event, route) => {
  try {
    console.log(`App navigated to route: ${route}, updating window configuration`)

    // Normalize route format
    const normalizedRoute = route.startsWith('/') ? route : `/${route}`

    // Now we can safely update the window configuration after the navigation happened
    createOrUpdateWindow(normalizedRoute)
  } catch (error) {
    console.error('Error handling route navigation:', error)
  }
})

// This allows requesting a route change from main to renderer
function requestRouteChange(route) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log(`Requesting route change to: ${route}`)
    mainWindow.webContents.send('route-change-requested', route)
    return true
  }
  return false
}
