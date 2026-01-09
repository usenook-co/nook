<script>
import ChatMessages from './ChatMessages.vue'
import ChatInput from './ChatInput.vue'

export default {
  name: 'ChatContainer',
  components: {
    ChatMessages,
    ChatInput
  },
  props: {
    messages: {
      type: Array,
      required: true
    }
  },
  data() {
    return {
      chatMessage: '',
      isChatExpanded: false,
      isClickingInside: false
    }
  },
  methods: {
    handleChatFocus(focused) {
      this.isChatExpanded = focused
    },

    handleChatBlur() {
      // Only collapse if we're not clicking inside the container
      if (!this.isClickingInside) {
        this.isChatExpanded = false
      }
      this.isClickingInside = false
    },

    sendChatMessage() {
      if (!this.chatMessage.trim()) return

      this.$emit('send-message', this.chatMessage)
      this.chatMessage = ''
    }
  }
}
</script>

<template>
  <div class="chat-container" :class="{ 'chat-expanded': isChatExpanded }">
    <ChatMessages v-if="isChatExpanded" :messages="messages" />
    <ChatInput
      v-model="chatMessage"
      @keyup:enter="sendChatMessage"
      :onFocus="() => handleChatFocus(true)"
      :onBlur="handleChatBlur"
    />
  </div>
</template>

<style scoped>
.chat-container {
  position: relative;
  min-width: 200px;
}

.chat-container.chat-expanded {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 8px;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 12px;
  width: 300px;
  padding: 16px;
}
</style>
