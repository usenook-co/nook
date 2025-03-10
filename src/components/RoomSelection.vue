<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const isCreatingRoom = ref(false)
const isJoiningRoom = ref(false)
const roomName = ref('')
const joinRoomInput = ref('')
const error = ref('')
const identity = ref(`user-${Math.random().toString(36).substring(7)}`)

// Create a new room
async function createRoom() {
  try {
    isCreatingRoom.value = true
    roomName.value = `room-${Math.random().toString(36).substring(7)}`

    // Store the room details for the call component
    localStorage.setItem('nook_room_name', roomName.value)
    localStorage.setItem('nook_identity', identity.value)

    // Copy room name to clipboard for sharing
    if (window?.electron?.writeToClipboard) {
      await window.electron.writeToClipboard(roomName.value)
      console.log('Room name copied to clipboard:', roomName.value)
    }

    // Navigate to call view
    await router.push('/call')

    // Notify main process that navigation is complete
    if (window?.electron?.notifyRouteNavigated) {
      window.electron.notifyRouteNavigated('/call')
    }
  } catch (err) {
    error.value = 'Failed to create room'
    console.error(err)
  } finally {
    isCreatingRoom.value = false
  }
}

// Join an existing room
async function joinRoom() {
  try {
    if (!joinRoomInput.value) {
      error.value = 'Please enter a room name'
      return
    }

    isJoiningRoom.value = true

    // Store the room details for the call component
    localStorage.setItem('nook_room_name', joinRoomInput.value)
    localStorage.setItem('nook_identity', identity.value)

    // Navigate to call view
    await router.push('/call')

    // Notify main process that navigation is complete
    if (window?.electron?.notifyRouteNavigated) {
      window.electron.notifyRouteNavigated('/call')
    }
  } catch (err) {
    error.value = 'Failed to join room'
    console.error(err)
  } finally {
    isJoiningRoom.value = false
  }
}
</script>

<template>
  <div class="room-selection">
    <div class="room-selection-content">
      <div class="room-actions">
        <button @click="createRoom" :disabled="isCreatingRoom" class="action-button create-button">
          {{ isCreatingRoom ? 'Creating Room...' : 'Create New Room' }}
        </button>

        <div class="divider">or</div>

        <div class="join-room">
          <input v-model="joinRoomInput" placeholder="Enter room name" class="room-input" :disabled="isJoiningRoom" />
          <button @click="joinRoom" :disabled="isJoiningRoom || !joinRoomInput" class="action-button join-button">
            {{ isJoiningRoom ? 'Joining...' : 'Join Room' }}
          </button>
        </div>
      </div>

      <div v-if="error" class="error-message">{{ error }}</div>
    </div>
  </div>
</template>

<style>
.room-selection {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 2rem;
}

.room-selection-content {
  max-width: 400px;
  width: 100%;
  text-align: center;
}

.room-selection-content h2 {
  font-size: 1.5rem;
  margin-bottom: 2rem;
  color: white;
  font-weight: bold;
}

.room-actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
}

.action-button {
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

.create-button,
.join-button {
  background: linear-gradient(90deg, #f22950 0%, #f85d3b 100%);
}

.create-button:hover:not(:disabled),
.join-button:hover:not(:disabled) {
  opacity: 0.9;
}

.action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.divider {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.9rem;
  margin: 0.5rem 0;
}

.join-room {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  width: 100%;
}

.room-input {
  padding: 0.8rem 1rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 0.9rem;
  width: 100%;
}

.room-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.room-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-message {
  margin-top: 1rem;
  color: #f44336;
  font-size: 0.9rem;
}
</style>
