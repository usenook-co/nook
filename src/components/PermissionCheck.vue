<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// Permission states
const cameraPermission = ref('checking')
const microphonePermission = ref('checking')
const allPermissionsGranted = ref(false)

// Check if all permissions are granted
async function checkPermissions() {
  try {
    // Reset permission states
    cameraPermission.value = 'checking'
    microphonePermission.value = 'checking'

    // Check if permissions are granted
    const devices = await navigator.mediaDevices.enumerateDevices()

    // Find camera and microphone devices with permission info
    const hasCamera = devices.some(device => device.kind === 'videoinput' && device.label)
    const hasMicrophone = devices.some(device => device.kind === 'audioinput' && device.label)

    // Update permission states based on device label availability
    // If label is available, permission is granted
    cameraPermission.value = hasCamera ? 'granted' : 'denied'
    microphonePermission.value = hasMicrophone ? 'granted' : 'denied'

    // Update all permissions granted flag
    allPermissionsGranted.value = hasCamera && hasMicrophone

    // Auto-navigate to room selection if all permissions granted
    if (allPermissionsGranted.value) {
      router.push('/room-selection')
    }
  } catch (error) {
    console.error('Error checking permissions:', error)
    cameraPermission.value = 'denied'
    microphonePermission.value = 'denied'
    allPermissionsGranted.value = false
  }
}

// Request camera and microphone permissions
async function requestPermissions() {
  try {
    // Request camera and microphone access
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })

    // Stop tracks to release devices
    stream.getTracks().forEach(track => track.stop())

    // Check permissions again after request
    await checkPermissions()
  } catch (error) {
    console.error('Error requesting permissions:', error)
    // Update permissions based on error
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      cameraPermission.value = 'denied'
      microphonePermission.value = 'denied'
    }
  }
}

// Handle continue button click
function handleContinue() {
  if (allPermissionsGranted.value) {
    // Ensure the window is in onboarding state before navigating
    // No need to change window state since we're staying in onboarding mode
    router.push('/room-selection')
  }
}

// Check permissions on component mount
onMounted(() => {
  // Only set window configuration if needed
  if (window?.electron?.getCurrentRoute && window?.electron?.setWindowForRoute) {
    window.electron
      .getCurrentRoute()
      .then(currentRoute => {
        if (currentRoute !== '/' && currentRoute !== '/permission-check') {
          window.electron.setWindowForRoute('/').catch(err => console.error('Error setting window for route:', err))
        }
      })
      .catch(err => console.error('Error getting current route:', err))
  }

  checkPermissions()
})
</script>

<template>
  <div class="permission-check">
    <div class="permission-content">
      <h2>Nook needs your permissions</h2>
      <p>To use Nook for video calls, please allow access to your camera and microphone.</p>

      <div class="permission-list">
        <div class="permission-item" :class="cameraPermission">
          <div class="permission-icon">
            <svg v-if="cameraPermission === 'granted'" class="check-icon" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
            <svg v-else-if="cameraPermission === 'denied'" class="denied-icon" viewBox="0 0 24 24">
              <path
                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
              />
            </svg>
            <div v-else class="loading-circle"></div>
          </div>
          <div class="permission-label">Camera</div>
        </div>

        <div class="permission-item" :class="microphonePermission">
          <div class="permission-icon">
            <svg v-if="microphonePermission === 'granted'" class="check-icon" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
            <svg v-else-if="microphonePermission === 'denied'" class="denied-icon" viewBox="0 0 24 24">
              <path
                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
              />
            </svg>
            <div v-else class="loading-circle"></div>
          </div>
          <div class="permission-label">Microphone</div>
        </div>
      </div>

      <div class="action-buttons">
        <button
          v-if="cameraPermission === 'denied' || microphonePermission === 'denied'"
          @click="requestPermissions"
          class="request-button"
        >
          Request Permissions
        </button>

        <button @click="handleContinue" class="continue-button" :disabled="!allPermissionsGranted"> Continue </button>
      </div>
    </div>
  </div>
</template>

<style>
.permission-check {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 2rem;
}

.permission-content {
  max-width: 400px;
  width: 100%;
  text-align: center;
}

.permission-content h2 {
  font-size: 1.5rem;
  margin-bottom: 1rem;
  color: white;
  font-weight: bold;
}

.permission-content p {
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 2rem;
  font-size: 0.9rem;
  line-height: 1.5;
}

.permission-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;
}

.permission-item {
  display: flex;
  align-items: center;
  padding: 1rem;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.permission-item.granted {
  border-left: 4px solid #4caf50;
}

.permission-item.denied {
  border-left: 4px solid #f44336;
}

.permission-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 1rem;
}

.check-icon {
  fill: #4caf50;
  width: 24px;
  height: 24px;
}

.denied-icon {
  fill: #f44336;
  width: 24px;
  height: 24px;
}

.loading-circle {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.permission-label {
  font-size: 1rem;
  color: white;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
}

.request-button,
.continue-button {
  padding: 0.8rem 1.5rem;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  border: none;
  color: white;
  width: 100%;
  font-size: 0.9rem;
}

.continue-button {
  background: linear-gradient(90deg, #f22950 0%, #f85d3b 100%);
}

.continue-button:hover:not(:disabled) {
  opacity: 0.9;
}

.continue-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
