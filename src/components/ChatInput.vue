<script>
export default {
  props: {
    modelValue: {
      type: String,
      required: true
    },
    onFocus: {
      type: Function,
      required: true
    },
    onBlur: {
      type: Function,
      required: true
    }
  },
  emits: ['update:modelValue', 'keyup:enter']
}
</script>

<template>
  <div class="chat-input">
    <input
      :value="modelValue"
      @input="e => emit('update:modelValue', e.target.value)"
      @keyup.enter="$emit('keyup:enter')"
      @focus="onFocus"
      @blur="onBlur"
      placeholder="Type a message..."
      type="text"
    />
  </div>
</template>

<style>
.chat-input {
  display: flex;
  gap: 8px;
}

.chat-input input {
  flex: 1;
  padding: 4px 12px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 14px;
  min-width: 150px;
}
</style>
