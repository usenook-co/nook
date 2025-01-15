<script setup>
import './polyfills'
import './reset.css'
import { ref, onMounted, onUnmounted } from 'vue'

const localVideo = ref(null)
const peerConnection = ref(null)
const localStream = ref(null)
const connectionData = ref('')
const peerData = ref('')
const isConnected = ref(false)
const showOverlay = ref(false)
const isInitiator = ref(window.location.hash === '#init')
const error = ref('')
const iceCandidates = ref([])
const isIceGatheringComplete = ref(false)

async function getBestVideoDevice() {
  const devices = await navigator.mediaDevices.enumerateDevices()
  const videoDevices = devices.filter(device => device.kind === 'videoinput')

  if (videoDevices.length === 0) {
    throw new Error('No video devices found')
  }

  // Prefer external cameras (usually better quality)
  // They often have 'USB' or 'External' in their label
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

  // Fall back to the last device in the list (often the best quality on desktops)
  console.log('Using default camera:', videoDevices[videoDevices.length - 1].label)
  return videoDevices[videoDevices.length - 1].deviceId
}

const config = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // Add a free TURN server - you might want to replace this with your own TURN server in production
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ],
  iceCandidatePoolSize: 10,
  iceTransportPolicy: 'all'
}

async function initializeWebRTC() {
  try {
    console.log('Initializing WebRTC...')

    // Get local video stream
    console.log('Requesting media access...')
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
    console.log('Got local stream:', localStream.value.getTracks())

    if (localVideo.value) {
      localVideo.value.srcObject = localStream.value
      console.log('Set local video source')
    }

    // Create peer connection
    peerConnection.value = new RTCPeerConnection(config)
    console.log('Created peer connection')

    // Add ICE connection monitoring
    peerConnection.value.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', peerConnection.value.iceConnectionState)
      if (peerConnection.value.iceConnectionState === 'failed') {
        console.log('ICE Connection failed - attempting restart...')
        peerConnection.value.restartIce()
      }
    }

    // Monitor ICE gathering state
    peerConnection.value.onicegatheringstatechange = () => {
      console.log('ICE gathering state:', peerConnection.value.iceGatheringState)
    }

    // Enhanced ICE candidate handling
    peerConnection.value.onicecandidate = event => {
      if (event.candidate) {
        console.log('New ICE candidate:', event.candidate.type)
        iceCandidates.value.push(event.candidate)

        // If we're the initiator, include the candidate in the connection data
        if (isInitiator.value) {
          connectionData.value = JSON.stringify({
            type: peerConnection.value.localDescription.type,
            sdp: peerConnection.value.localDescription.sdp,
            candidates: iceCandidates.value
          })
        }
      } else {
        console.log('ICE gathering completed')
        isIceGatheringComplete.value = true
        const desc = peerConnection.value.localDescription
        console.log('Final local description:', desc)

        // Final connection data with all candidates
        connectionData.value = JSON.stringify({
          type: desc.type,
          sdp: desc.sdp,
          candidates: iceCandidates.value
        })
      }
    }

    // Add local stream
    localStream.value.getTracks().forEach(track => {
      peerConnection.value.addTrack(track, localStream.value)
    })

    // Handle incoming streams
    peerConnection.value.ontrack = event => {
      console.log('Received remote stream')
      const container = document.createElement('div')
      container.className = 'avatar-container'

      const videoEl = document.createElement('video')
      videoEl.className = 'avatar'
      videoEl.srcObject = event.streams[0]
      videoEl.autoplay = true
      videoEl.playsInline = true

      container.appendChild(videoEl)
      document.querySelector('.avatar-group').appendChild(container)
    }

    // Handle connection state changes
    peerConnection.value.onconnectionstatechange = () => {
      const state = peerConnection.value.connectionState
      console.log('Connection state:', state)
      if (state === 'connected') {
        isConnected.value = true
        showOverlay.value = false
      } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        error.value = `Connection ${state}`
        isConnected.value = false
      }
    }

    // If initiator, create offer
    if (isInitiator.value) {
      const offer = await peerConnection.value.createOffer()
      await peerConnection.value.setLocalDescription(offer)
    }
  } catch (error) {
    console.error('Error initializing WebRTC:', error)
    error.value = error.message
  }
}

async function connectWithPeer() {
  try {
    if (!peerConnection.value || !peerData.value) {
      throw new Error('No peer connection available')
    }

    const data = JSON.parse(peerData.value)
    console.log('Connecting with peer data:', data)

    if (data.type === 'offer') {
      console.log('Setting remote description (offer)')
      await peerConnection.value.setRemoteDescription(
        new RTCSessionDescription({
          type: data.type,
          sdp: data.sdp
        })
      )

      // Add received ICE candidates
      if (data.candidates) {
        console.log('Adding received ICE candidates')
        for (const candidate of data.candidates) {
          try {
            await peerConnection.value.addIceCandidate(new RTCIceCandidate(candidate))
            console.log('Added ICE candidate')
          } catch (e) {
            console.warn('Error adding ICE candidate:', e)
          }
        }
      }

      console.log('Creating answer')
      const answer = await peerConnection.value.createAnswer()
      console.log('Setting local description (answer)')
      await peerConnection.value.setLocalDescription(answer)

      // Wait for ICE gathering to complete or timeout after 5 seconds
      await Promise.race([
        new Promise(resolve => {
          const checkComplete = () => {
            if (isIceGatheringComplete.value) {
              resolve()
            } else {
              setTimeout(checkComplete, 100)
            }
          }
          checkComplete()
        }),
        new Promise(resolve => setTimeout(resolve, 5000))
      ])
    } else if (data.type === 'answer') {
      console.log('Setting remote description (answer)')
      await peerConnection.value.setRemoteDescription(
        new RTCSessionDescription({
          type: data.type,
          sdp: data.sdp
        })
      )

      // Add received ICE candidates
      if (data.candidates) {
        console.log('Adding received ICE candidates')
        for (const candidate of data.candidates) {
          try {
            await peerConnection.value.addIceCandidate(new RTCIceCandidate(candidate))
            console.log('Added ICE candidate')
          } catch (e) {
            console.warn('Error adding ICE candidate:', e)
          }
        }
      }
    }
  } catch (err) {
    console.error('Error connecting with peer:', err)
    error.value = `Connection error: ${err.message}`
  }
}

async function copyConnectionData() {
  if (window?.electron?.writeToClipboard) {
    try {
      console.log('Connection data to copy:', connectionData.value)
      const result = await window.electron.writeToClipboard(connectionData.value)
      if (result.success) {
        console.log('Successfully copied connection data to clipboard')
      } else {
        error.value = 'Failed to copy connection data: ' + (result.error || 'Unknown error')
      }
    } catch (err) {
      console.error('Error copying to clipboard:', err)
      error.value = 'Failed to copy connection data'
    }
  } else {
    console.error('Clipboard API not available')
    error.value = 'Failed to copy connection data'
  }
}

onMounted(() => {
  console.log('Component mounted, initializing WebRTC...')
  initializeWebRTC()
})

onUnmounted(() => {
  // Cleanup
  localStream.value?.getTracks().forEach(track => track.stop())
  peerConnection.value?.close()
})

function startDrag() {
  window.electron.startDrag()
}

function stopDrag() {
  window.electron.stopDrag()
}

function openLink(url, event) {
  event.preventDefault()
  window.electron.openExternal(url)
}

function createInitiatorWindow() {
  if (window?.electron?.createInitiatorWindow) {
    window.electron.createInitiatorWindow()
  } else {
    console.error('Electron API not available')
  }
}
</script>

<template>
  <div class="wrapper" @mousedown="startDrag" @mouseup="stopDrag" @mouseleave="stopDrag">
    <div class="bg" @mouseenter="showOverlay = true" @mouseleave="showOverlay = false"></div>
    <div class="container">
      <div class="avatar-group">
        <div class="avatar-container">
          <video ref="localVideo" class="avatar" autoplay playsinline muted />
        </div>
      </div>
    </div>

    <div v-if="showOverlay || !isConnected" class="connection-overlay">
      <div v-if="error" class="error-message">{{ error }}</div>
      <div v-if="isInitiator" class="connection-box">
        <button @click="copyConnectionData" class="action-button">Copy Connection Data</button>
        <div class="connection-data" v-if="connectionData">
          {{ connectionData }}
        </div>
        <div class="status-text">Share this with your peer</div>
      </div>
      <div v-else class="connection-box">
        <button @click="createInitiatorWindow" class="action-button secondary">Create New Call</button>
        <div class="status-text">or</div>
        <input v-model="peerData" placeholder="Paste connection data here" class="connection-input" />
        <button @click="connectWithPeer" class="action-button">Join Call</button>
      </div>
    </div>
  </div>
</template>

<style>
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
  background: rgba(0, 0, 0, 0.1);
}

.bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  transition: background-color 0.3s ease;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.wrapper:hover .bg {
  background: rgba(255, 255, 255, 0.15);
}

.container {
  position: relative;
  padding: 20px;
  z-index: 1;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-group {
  display: flex;
  gap: min(20px, 4vw);
  justify-content: center;
  width: 100%;
  padding: 0 20px;
  height: 100%;
}

.avatar-container {
  position: relative;
  width: calc((100vw - 60px) / 2);
  aspect-ratio: 1/1;
}

.avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  position: relative;
  background-color: rgba(0, 0, 0, 0.2);
  overflow: hidden;
  object-fit: cover;
}

.armagan {
  background-image: url('https://s.arm.ag/2019%20bw.jpg');
}

.dogukan {
  background-image: url('https://avatars.githubusercontent.com/u/38019578?v=4');
}

.green-ring {
  position: absolute;
  top: -5px;
  left: -5px;
  right: -5px;
  bottom: -5px;
  border: 3px solid #4caf50;
  border-radius: 50%;
}

.link {
  text-decoration: none;
  background: rgba(0, 0, 0, 0.8);
  padding: 8px 16px;
  border-radius: 20px;
  color: white;
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
  letter-spacing: -0.1px;
  white-space: nowrap;
  position: absolute;
  bottom: 0;
}

.link-content {
  display: flex;
  align-items: center;
  gap: 6px;
}

.github-icon {
  display: flex;
  align-items: center;
}

.link:hover {
  background: rgba(0, 0, 0, 0.9);
}

.connection-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.8);
  padding: 20px;
  border-radius: 12px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 300px;
}

.connection-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
}

.connection-input {
  width: 100%;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.3);
  color: white;
  font-size: 14px;
}

.connection-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.action-button {
  padding: 8px 16px;
  border-radius: 6px;
  background: #4caf50;
  color: white;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s ease;
}

.action-button:hover {
  background: #45a049;
}

.status-text {
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
}

.action-button.secondary {
  background: rgba(255, 255, 255, 0.1);
}

.action-button.secondary:hover {
  background: rgba(255, 255, 255, 0.15);
}

.error-message {
  color: #ff4444;
  background: rgba(255, 0, 0, 0.1);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 14px;
  margin-bottom: 10px;
}

.connection-data {
  background: rgba(0, 0, 0, 0.3);
  padding: 8px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  word-break: break-all;
  margin: 10px 0;
  max-height: 100px;
  overflow-y: auto;
}
</style>
