<script>
export default {
  props: {
    messages: {
      type: Array,
      required: true,
      default: () => []
    }
  }
}
</script>

<template>
  <div class="chat-messages">
    <div v-for="(msg, index) in messages" :key="index" class="chat-message">
      <span class="chat-sender">{{ msg.sender }}:</span>
      <span class="chat-text">{{ msg.message }}</span>
    </div>
  </div>
</template>

<style>
.chat-messages {
  max-height: 50vh;
  overflow-y: auto;
  margin-bottom: 8px;
}

.chat-message {
  color: white;
  margin-bottom: 4px;
}

.chat-sender {
  font-weight: bold;
  color: #4caf50;
  margin-right: 4px;
}
</style>
