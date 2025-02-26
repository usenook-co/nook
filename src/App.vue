<script setup>
import './polyfills'
import './reset.css'
import { ref, onMounted, onUnmounted, watch } from 'vue'
import Video from 'twilio-video'

// Keep Twilio objects outside of Vue's reactivity
let twilioRoom = null
let twilioLocalParticipant = null
let twilioScreenTrack = null

// Vue refs for UI state only
const localVideo = ref(null)
const isConnected = ref(false)
const showOverlay = ref(true)
const error = ref('')
const roomName = ref('')
const identity = ref(`user-${Math.random().toString(36).substring(7)}`)
const isCreatingRoom = ref(false)
const participants = ref(new Map())
const isScreenSharing = ref(false)
const screenContainer = ref(null)
const joinRoomInput = ref('')
const isJoiningRoom = ref(false)
const participantCount = ref(1)
const wrapper = ref(null)
const localStream = ref(null)
const hasRemoteScreenShare = ref(false)

function startDrag() {
  if (window?.electron?.startDrag) {
    window.electron.startDrag()
  }
}

function stopDrag() {
  if (window?.electron?.stopDrag) {
    window.electron.stopDrag()
  }
}

watch(participantCount, count => {
  updateAspectRatio(count)
})

async function updateAspectRatio(count) {
  if (window?.electron?.setAspectRatio) {
    await window.electron.setAspectRatio(Math.max(count, 2))
  }
}

async function createRoom() {
  try {
    isCreatingRoom.value = true
    roomName.value = `room-${Math.random().toString(36).substring(7)}`
    await initializeVideo()

    // Copy room name to clipboard for sharing
    if (window?.electron?.writeToClipboard) {
      await window.electron.writeToClipboard(roomName.value)
      console.log('Room name copied to clipboard:', roomName.value)
    }
  } catch (err) {
    error.value = 'Failed to create room'
    console.error(err)
  } finally {
    isCreatingRoom.value = false
  }
}

async function joinRoom() {
  try {
    if (!joinRoomInput.value) {
      error.value = 'Please enter a room name'
      return
    }

    isJoiningRoom.value = true
    roomName.value = joinRoomInput.value
    await initializeVideo()
  } catch (err) {
    error.value = 'Failed to join room'
    console.error(err)
  } finally {
    isJoiningRoom.value = false
  }
}

async function leaveRoom() {
  if (isScreenSharing.value) {
    if (twilioScreenTrack) {
      twilioScreenTrack.stop()
      twilioScreenTrack = null
    }
    isScreenSharing.value = false
  }

  if (twilioRoom) {
    twilioRoom.disconnect()
    twilioRoom = null
  }

  twilioLocalParticipant = null

  if (localStream.value) {
    localStream.value.getTracks().forEach(track => track.stop())
    localStream.value = null
  }

  participants.value.clear()
  participantCount.value = 1

  const avatarGroup = document.querySelector('.avatar-group')
  const containers = avatarGroup.querySelectorAll('.avatar-container:not(:first-child)')
  containers.forEach(container => container.remove())

  isConnected.value = false
  showOverlay.value = true
  roomName.value = ''
  joinRoomInput.value = ''
}

async function getBestVideoDevice() {
  const devices = await navigator.mediaDevices.enumerateDevices()
  const videoDevices = devices.filter(device => device.kind === 'videoinput')

  if (videoDevices.length === 0) {
    throw new Error('No video devices found')
  }

  // Prefer external cameras (usually better quality)
  const externalCamera = videoDevices.find(
    device => device.label.toLowerCase().includes('usb') || device.label.toLowerCase().includes('external')
  )

  if (externalCamera) {
    console.log('Found external camera:', externalCamera.label)
    return externalCamera.deviceId
  }

  // If no external camera, prefer back camera on mobile devices
  const backCamera = videoDevices.find(
    device =>
      device.label.toLowerCase().includes('back') ||
      device.label.toLowerCase().includes('rear') ||
      device.label.toLowerCase().includes('camm')
  )

  if (backCamera) {
    console.log('Found back camera:', backCamera.label)
    return backCamera.deviceId
  }

  console.log('Using default camera:', videoDevices[videoDevices.length - 1].label)
  return videoDevices[videoDevices.length - 1].deviceId
}

async function getAccessToken() {
  try {
    const serverUrl =
      process.env.NODE_ENV === 'development'
        ? 'https://df70-94-54-24-112.ngrok-free.app' // Add your ngrok URL here that points to your local token server = the port on ngrok startup is equal to the port on the server.js file
        : 'https://df70-94-54-24-112.ngrok-free.app' // Change this in production

    const response = await fetch(`${serverUrl}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        identity: identity.value,
        room: roomName.value
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to get access token')
    }

    const data = await response.json()
    return data.token
  } catch (err) {
    console.error('Error getting access token:', err)
    error.value = err.message || 'Failed to get access token'
    throw err
  }
}

async function initializeVideo() {
  try {
    console.log('Initializing video...')

    if (!window.navigator.mediaDevices?.getUserMedia) {
      throw new Error('Media API not available')
    }

    // Get the best available camera
    const deviceId = await getBestVideoDevice()

    localStream.value = await window.navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: { exact: deviceId },
        width: { ideal: 320 },
        height: { ideal: 320 },
        aspectRatio: { ideal: 1 }
      },
      audio: true
    })

    if (localVideo.value) {
      localVideo.value.srcObject = localStream.value
    }

    const token = await getAccessToken()

    const roomOptions = {
      name: roomName.value,
      tracks: localStream.value.getTracks(),
      video: { height: 320, width: 320 },
      audio: true,
      dominantSpeaker: true
    }

    twilioRoom = await Video.connect(token, roomOptions)
    twilioLocalParticipant = twilioRoom.localParticipant

    // Set up room event listeners
    twilioRoom.on('participantConnected', participant => {
      console.log('A remote participant connected:', participant)
      handleParticipantConnected(participant)
    })

    twilioRoom.on('participantDisconnected', participant => {
      console.log('A remote participant disconnected:', participant)
      handleParticipantDisconnected(participant)
    })

    // Handle existing participants
    Array.from(twilioRoom.participants.values()).forEach(participant => {
      handleParticipantConnected(participant)
    })

    isConnected.value = true
    showOverlay.value = false
  } catch (err) {
    console.error('Error initializing video:', err)
    error.value = err.message
    throw err
  }
}

function handleParticipantConnected(participant) {
  console.log('Setting up participant:', participant.identity)
  // Skip if this is the local participant
  if (participant.identity === identity.value) {
    console.log('Skipping local participant setup')
    return
  }

  participants.value.set(participant.sid, participant)
  participantCount.value = participants.value.size + 1 // +1 for local participant

  const container = document.createElement('div')
  container.id = participant.sid
  container.className = 'avatar-container'

  const videoEl = document.createElement('video')
  videoEl.className = 'avatar'
  videoEl.autoplay = true
  videoEl.playsInline = true

  container.appendChild(videoEl)
  document.querySelector('.avatar-group').appendChild(container)

  // Handle participant's existing tracks
  Array.from(participant.tracks.values()).forEach(publication => {
    if (publication.track && publication.kind === 'video') {
      handleTrackSubscribed(publication.track, participant)
    }
  })

  // Handle participant's new track publications
  participant.on('trackSubscribed', track => {
    if (track.kind === 'video') {
      handleTrackSubscribed(track, participant)
    } else if (track.kind === 'audio') {
      // Just attach audio without visual element
      track.attach()
    }
  })

  participant.on('trackUnsubscribed', track => {
    handleTrackUnsubscribed(track)
  })
}

function handleTrackSubscribed(track, participant) {
  // Skip if this is the local participant
  if (participant.identity === identity.value) {
    console.log('Skipping local participant track')
    return
  }

  if (track.kind !== 'video') return

  // Check if this is a screen share track
  const isScreenShare = track.name === 'screen'
  console.log('Track subscribed:', {
    isScreenShare,
    name: track.name,
    kind: track.kind
  })

  if (isScreenShare) {
    hasRemoteScreenShare.value = true
    // Create screen share container as background
    const video = document.createElement('video')
    video.id = `screen-${participant.sid}`
    video.autoplay = true
    video.playsInline = true
    video.className = 'screen-share-background'
    document.querySelector('.bg').appendChild(video)
    track.attach(video)

    // Set aspect ratio based on screen share dimensions
    video.addEventListener('loadedmetadata', () => {
      const aspectRatio = video.videoWidth / video.videoHeight
      if (window?.electron?.setAspectRatio) {
        window.electron.setAspectRatio(aspectRatio)
      }
    })
  } else {
    const container = document.getElementById(participant.sid)
    if (!container) return

    const videoEl = container.querySelector('video')
    if (videoEl) {
      track.attach(videoEl)
    }
  }
}

function handleTrackUnsubscribed(track, participant) {
  if (track.kind === 'video' && track.name === 'screen') {
    hasRemoteScreenShare.value = false
    const video = document.getElementById(`screen-${participant.sid}`)
    if (video) {
      video.remove()
    }
    // Reset aspect ratio based on participant count
    if (window?.electron?.setAspectRatio) {
      window.electron.setAspectRatio(Math.max(participantCount.value, 2))
    }
  }
  track.detach()
}

function handleParticipantDisconnected(participant) {
  console.log('Participant disconnected:', participant.identity)
  // Skip if this is the local participant
  if (participant.identity === identity.value) {
    console.log('Skipping local participant cleanup')
    return
  }

  participants.value.delete(participant.sid)
  participantCount.value = participants.value.size + 1 // +1 for local participant

  const container = document.getElementById(participant.sid)
  if (container) {
    container.remove()
  }
}

function updateWindowSize(count) {
  // This is now only used for non-aspect-ratio related size changes
  const baseWidth = Math.max(count, 2) * 200
  if (window?.electron?.setWindowSize) {
    window.electron.setWindowSize(baseWidth, 200, false)
  }
}

async function toggleScreenShare() {
  try {
    if (isScreenSharing.value) {
      // Stop screen sharing
      if (twilioScreenTrack) {
        try {
          if (twilioLocalParticipant) {
            await twilioLocalParticipant.unpublishTrack(twilioScreenTrack)
          }
        } catch (e) {
          console.error('Error unpublishing track:', e)
        }

        twilioScreenTrack.stop()
        twilioScreenTrack = null
      }
      isScreenSharing.value = false
    } else {
      // Get available screen sources
      const sources = await window.electron.getScreenSources()
      console.log('Available sources:', sources)

      if (!sources || sources.length === 0) {
        throw new Error('No screen sources available')
      }

      // Get the entire screen source
      const source = sources.find(s => s.name === 'Entire Screen' || s.name === 'Screen 1') || sources[0]
      console.log('Selected source:', source)

      // Create stream using the source ID
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: source.id
          }
        }
      })

      const videoTrack = stream.getVideoTracks()[0]

      // Create Twilio track
      twilioScreenTrack = new Video.LocalVideoTrack(videoTrack, {
        name: 'screen',
        logLevel: 'off'
      })

      // Handle when user stops sharing via browser controls
      videoTrack.addEventListener('ended', () => {
        if (isScreenSharing.value) {
          toggleScreenShare()
        }
      })

      try {
        if (twilioLocalParticipant) {
          await twilioLocalParticipant.publishTrack(twilioScreenTrack)
        }
      } catch (e) {
        console.error('Error publishing track:', e)
        throw e
      }

      isScreenSharing.value = true
    }
  } catch (err) {
    console.error('Error toggling screen share:', err)
    error.value = 'Failed to toggle screen sharing: ' + err.message
  }
}

watch(hasRemoteScreenShare, async hasScreen => {
  // Update video sizes based on screen share state
  const avatarContainers = document.querySelectorAll('.avatar-container')
  avatarContainers.forEach(container => {
    container.style.width = hasScreen ? '160px' : '80vh'
    container.style.height = hasScreen ? '160px' : '80vh'
  })

  // Update container alignment
  const container = document.querySelector('.container')
  if (container) {
    container.style.alignItems = hasScreen ? 'flex-start' : 'center'
  }

  // Toggle always-on-top based on screen share state
  if (window?.electron?.setAlwaysOnTop) {
    window.electron.setAlwaysOnTop(!hasScreen)
  }

  // Update window size based on screen share state
  if (hasScreen) {
    const remote = require('@electron/remote')
    const primaryDisplay = remote.screen.getPrimaryDisplay()
    const { workArea } = primaryDisplay
    const newWidth = Math.round(workArea.width * 0.8)
    const newHeight = Math.round(workArea.height * 0.8)

    console.log('Resizing window to:', { newWidth, newHeight, workArea })

    if (window?.electron?.setWindowSize) {
      window.electron.setWindowSize(newWidth, newHeight, true)
    }
  } else {
    if (window?.electron?.setWindowSize) {
      window.electron.setWindowSize(600, 300, true)
    }
  }
})

onMounted(() => {
  // Don't auto-initialize video, wait for user action
  showOverlay.value = true
  // Set initial aspect ratio to 2:1
  if (window?.electron?.setAspectRatio) {
    window.electron.setAspectRatio(2)
  }
})

onUnmounted(() => {
  leaveRoom()
})
</script>

<template>
  <div class="app">
    <div class="wrapper" ref="wrapper" @mousedown="startDrag" @mouseup="stopDrag" @mouseleave="stopDrag">
      <div class="bg" @mouseenter="showOverlay = true" @mouseleave="showOverlay = false"></div>
      <div class="container">
        <div class="avatar-group">
          <div class="avatar-container">
            <video ref="localVideo" class="avatar" autoplay playsinline muted></video>
          </div>
        </div>
      </div>

      <div v-if="error" class="error">{{ error }}</div>

      <div v-if="showOverlay" class="overlay">
        <div class="overlay-content" v-if="!isConnected">
          <div class="room-actions">
            <button @click="createRoom" :disabled="isCreatingRoom" class="action-button">
              {{ isCreatingRoom ? 'Creating Room...' : 'Create New Room' }}
            </button>

            <div class="divider">or</div>

            <div class="join-room">
              <input
                v-model="joinRoomInput"
                placeholder="Enter room name"
                class="room-input"
                :disabled="isJoiningRoom"
              />
              <button @click="joinRoom" :disabled="isJoiningRoom || !joinRoomInput" class="action-button">
                {{ isJoiningRoom ? 'Joining...' : 'Join Room' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="isConnected" class="room-info">
        <div class="room-name">Room: {{ roomName }}</div>
        <button @click="toggleScreenShare" class="screen-share-button" :class="{ active: isScreenSharing }">
          {{ isScreenSharing ? 'Stop Sharing' : 'Share Screen' }}
        </button>
        <button @click="leaveRoom" class="leave-button">Leave Room</button>
      </div>
    </div>
  </div>
</template>

<style>
.app {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: transparent;
  position: relative;
}

.wrapper {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 400px;
  min-height: 200px;
}

.bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  transition: background-color 0.3s ease;
  backdrop-filter: blur(8px);
  border-radius: 12px;
  overflow: hidden;
}

.wrapper:hover .bg {
  background: rgba(0, 0, 0, 0.5);
}

.container {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.avatar-group {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  padding: 8px;
  height: 160px;
  justify-content: center;
  align-items: center;
}

.avatar-container {
  height: 80vh;
  width: 80vh;
  border-radius: 50%;
  overflow: hidden;
  background: #000;
  flex-shrink: 0;
  transition: all 0.3s ease;
}

.avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.error {
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 0, 0, 0.8);
  color: white;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  z-index: 1000;
}

.overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
  z-index: 100;
}

.overlay-content {
  background: rgba(0, 0, 0, 0.8);
  padding: 24px;
  border-radius: 12px;
  min-width: 300px;
  z-index: 101;
}

.room-actions {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
}

.action-button {
  background: #4caf50;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
  width: 100%;
}

.action-button:hover:not(:disabled) {
  background: #45a049;
}

.action-button:disabled {
  background: #666;
  cursor: not-allowed;
}

.divider {
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
}

.join-room {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.room-input {
  padding: 12px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 14px;
  width: 100%;
}

.room-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.room-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.room-info {
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  padding: 8px 16px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  z-index: 1000;
}

.room-name {
  color: white;
  font-size: 14px;
}

.leave-button {
  background: #ff4444;
  color: white;
  border: none;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.leave-button:hover {
  background: #ff3333;
}

.screen-share-button {
  background: #2196f3;
  color: white;
  border: none;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
  margin-right: 8px;
}

.screen-share-button:hover {
  background: #1976d2;
}

.screen-share-button.active {
  background: #ffa000;
}

.screen-share-button.active:hover {
  background: #ff8f00;
}

.screen-share-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  z-index: -1;
}

.screen-share-container {
  display: none;
}
</style>
