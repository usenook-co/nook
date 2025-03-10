<script setup>
import './polyfills'
import './reset.css'
import { ref, onMounted, onUnmounted, watch, provide } from 'vue'
import Video from 'twilio-video'

// Keep Twilio objects outside of Vue's reactivity
let twilioRoom = null
let twilioLocalParticipant = null
let twilioScreenTrack = null
let twilioDataTrack = null // Add this for GIF sharing

// Vue refs for UI state only
const localVideo = ref(null)
const isConnected = ref(false)
const showOverlay = ref(true)
const error = ref('')
const roomName = ref('')
const identity = ref(`user-${Math.random().toString(36).substring(7)}`)
const isCreatingRoom = ref(false)
const participants = ref(new Map())
const participantGifs = ref(new Map()) // Add this to store GIFs for each participant
const isScreenSharing = ref(false)
const joinRoomInput = ref('')
const isJoiningRoom = ref(false)
const participantCount = ref(1)
const wrapper = ref(null)
const localStream = ref(null)
const hasRemoteScreenShare = ref(false)
const selectedGif = ref(null)
const chatMessage = ref('')
const chatMessages = ref([])

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

  if (twilioDataTrack) {
    twilioDataTrack.removeAllListeners()
    twilioDataTrack = null
  }

  isConnected.value = false
  showOverlay.value = true
  roomName.value = ''
  joinRoomInput.value = ''
  participantGifs.value.clear() // Clear participant GIFs
  chatMessages.value = [] // Clear chat messages
}

async function getBestVideoDevice() {
  const devices = await navigator.mediaDevices.enumerateDevices()
  const videoDevices = devices.filter(device => device.kind === 'videoinput')

  if (videoDevices.length === 0) {
    console.log('No video devices found') // Changed this to silent error, because it should be possible to join a room without a camera
    return null
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
    const serverUrl = import.meta.env.VITE_NGROK_URL

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

async function createAndPublishDataTrack() {
  try {
    twilioDataTrack = new Video.LocalDataTrack()

    if (twilioLocalParticipant) {
      await twilioLocalParticipant.publishTrack(twilioDataTrack)
      console.log('Data track published successfully')
    }
  } catch (err) {
    console.error('Error publishing data track:', err)
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
      video: deviceId
        ? {
            deviceId: { exact: deviceId },
            width: { ideal: 320 },
            height: { ideal: 320 },
            aspectRatio: { ideal: 1 }
          }
        : false,
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

    // Create and publish data track for GIF sharing
    await createAndPublishDataTrack()

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

  // Handle participant's existing tracks
  Array.from(participant.tracks.values()).forEach(publication => {
    if (publication.track) {
      if (publication.kind === 'video') {
        handleTrackSubscribed(publication.track, participant)
      } else if (publication.kind === 'data') {
        handleDataTrackSubscribed(publication.track, participant)
      }
    }
  })

  // Handle participant's new track publications
  participant.on('trackSubscribed', track => {
    if (track.kind === 'video') {
      handleTrackSubscribed(track, participant)
    } else if (track.kind === 'audio') {
      // Just attach audio without visual element
      track.attach()
    } else if (track.kind === 'data') {
      handleDataTrackSubscribed(track, participant)
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
    // We need to wait for Vue to render the element
    // Use nextTick or setTimeout to ensure the element exists
    setTimeout(() => {
      const container = document.getElementById(participant.sid)
      if (!container) return

      const videoEl = container.querySelector('video')
      if (videoEl) {
        track.attach(videoEl)
      }
    }, 100)
  }
}

function handleDataTrackSubscribed(track, participant) {
  console.log('Data track subscribed from participant:', participant.identity)

  track.on('message', data => {
    try {
      const message = JSON.parse(data)
      if (message.type === 'gif') {
        console.log('Received GIF from participant:', participant.identity, message.url)
        participantGifs.value.set(participant.sid, message.url)
      } else if (message.type === 'chat') {
        console.log('Received chat message:', message)
        chatMessages.value.push(message)
      }
    } catch (err) {
      console.error('Error parsing data track message:', err)
    }
  })
}

function handleTrackUnsubscribed(track) {
  if (track.kind === 'video' && track.name === 'screen') {
    hasRemoteScreenShare.value = false
    const video = document.getElementById(`screen-${track.sid}`)
    if (video) {
      video.remove()
    }
    // Reset aspect ratio based on participant count
    if (window?.electron?.setAspectRatio) {
      window.electron.setAspectRatio(Math.max(participantCount.value, 2))
    }
  }

  // Only call detach for media tracks (audio and video)
  if (track.kind === 'audio' || track.kind === 'video') {
    track.detach()
  }
}

function handleParticipantDisconnected(participant) {
  console.log('Participant disconnected:', participant.identity)
  // Skip if this is the local participant
  if (participant.identity === identity.value) {
    console.log('Skipping local participant cleanup')
    return
  }

  participants.value.delete(participant.sid)
  participantGifs.value.delete(participant.sid) // Remove participant's GIF
  participantCount.value = participants.value.size + 1 // +1 for local participant
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

function handleDirectGifSelection(gifUrl) {
  console.log('Received direct GIF selection:', gifUrl)
  selectedGif.value = gifUrl

  // Share the GIF with other participants
  if (twilioDataTrack) {
    twilioDataTrack.send(JSON.stringify({ type: 'gif', url: gifUrl }))
  }
}

function sendChatMessage() {
  if (!chatMessage.value.trim() || !twilioDataTrack) return

  const messageData = {
    type: 'chat',
    message: chatMessage.value,
    sender: identity.value,
    timestamp: Date.now()
  }

  twilioDataTrack.send(JSON.stringify(messageData))

  // Add message to local chat
  chatMessages.value.push(messageData)

  // Clear input
  chatMessage.value = ''
}

onMounted(() => {
  // Don't auto-initialize video, wait for user action
  showOverlay.value = true
  // Set initial aspect ratio to 2:1
  if (window?.electron?.setAspectRatio) {
    window.electron.setAspectRatio(2)
  }

  // Add window message listener for direct GIF selection
  window.addEventListener('message', event => {
    if (event.data && event.data.type === 'gifSelected') {
      console.log('Received GIF via postMessage:', event.data.gifUrl)
      handleDirectGifSelection(event.data.gifUrl)
    }
  })

  // Listen for GIF selection from the separate window
  window.electron.onGifSelected(gifUrl => {
    selectedGif.value = gifUrl
  })
})

onUnmounted(() => {
  // Remove message listener
  window.removeEventListener('message', event => {
    if (event.data && event.data.type === 'gifSelected') {
      handleDirectGifSelection(event.data.gifUrl)
    }
  })

  leaveRoom()
})

function handleAvatarClick() {
  if (selectedGif.value) {
    selectedGif.value = null
    // Send null GIF to other participants
    if (twilioDataTrack) {
      twilioDataTrack.send(JSON.stringify({ type: 'gif', url: null }))
    }
  } else {
    openGifSelectorWindow()
  }
}

function openGifSelectorWindow() {
  const url = window.location.href.split('#')[0] + '#gif-selector'
  const width = 400
  const height = 600
  const left = (window.screen.width - width) / 2
  const top = (window.screen.height - height) / 2

  const features = `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`

  const gifWindow = window.open(url, 'gifSelector', features)

  if (gifWindow) {
    console.log('GIF selector window opened directly')
  } else {
    console.error('Failed to open GIF selector window')
    // Fallback to electron method if available
    if (window.electron?.openGifSelector) {
      window.electron.openGifSelector()
    }
  }
}
</script>

<template>
  <div class="app">
    <div class="wrapper" ref="wrapper" @mousedown="startDrag" @mouseup="stopDrag" @mouseleave="stopDrag">
      <div class="bg" @mouseenter="showOverlay = true" @mouseleave="showOverlay = false"></div>
      <div class="container">
        <div class="avatar-group">
          <!-- Local participant -->
          <div class="avatar-container local-avatar" @click="handleAvatarClick">
            <video v-show="!selectedGif" ref="localVideo" class="avatar" autoplay playsinline muted></video>
            <img v-show="selectedGif" :src="selectedGif" class="avatar gif-avatar" alt="Selected GIF" />
            <div v-show="selectedGif" class="remove-gif-indicator">×</div>
          </div>

          <!-- Remote participants -->
          <div v-for="[sid, participant] in participants" :key="sid" :id="sid" class="avatar-container">
            <video v-show="!participantGifs.get(sid)" class="avatar" autoplay playsinline></video>
            <img
              v-show="participantGifs.get(sid)"
              :src="participantGifs.get(sid)"
              class="avatar gif-avatar"
              alt="Participant GIF"
            />
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

      <!-- Chat UI -->
      <div v-if="isConnected" class="chat-container">
        <div class="chat-messages">
          <div v-for="(msg, index) in chatMessages" :key="index" class="chat-message">
            <span class="chat-sender">{{ msg.sender }}:</span>
            <span class="chat-text">{{ msg.message }}</span>
          </div>
        </div>
        <div class="chat-input">
          <input v-model="chatMessage" @keyup.enter="sendChatMessage" placeholder="Type a message..." type="text" />
          <button @click="sendChatMessage">Send</button>
        </div>
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

.local-avatar {
  position: relative;
  cursor: pointer;
}

.gif-avatar {
  object-fit: cover;
}

.remove-gif-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.5);
  color: white;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  opacity: 0;
  transition: opacity 0.2s;
}

.local-avatar:hover .remove-gif-indicator {
  opacity: 1;
}

.chat-container {
  position: fixed;
  right: 16px;
  bottom: 16px;
  min-width: 200px;
  min-height: 200px;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  z-index: 1000;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chat-message {
  color: white;
  font-size: 14px;
}

.chat-sender {
  font-weight: bold;
  color: #4caf50;
  margin-right: 8px;
}

.chat-input {
  padding: 16px;
  display: flex;
  gap: 8px;
}

.chat-input input {
  flex: 1;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.chat-input button {
  background: #4caf50;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}

.chat-input button:hover {
  background: #45a049;
}
</style>
