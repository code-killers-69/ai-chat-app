<template>
  <div class="questionBar">
    <div class="imageContainers">
      <ImageContainer
        v-for="(image, index) in images"
        :key="image.imageUrl"
        :image-url="image.imageUrl"
        @onImageLoaded="onPreviewImageLoaded"
        :enable-loading-animation="true"
        size="80px"
        style="margin: 0 2px;"
        :enable-delete-btn="true"
        @on-image-deleted="onImageDeleted(index)"
      />
    </div>
    <div class="inputArea">
      <div
        ref="inputRef"
        class="inputMessage"
        contenteditable="true"
        :class="{ disabled: isLoading }"
        @keydown.enter.exact.prevent="handleSend"
        @paste="handlePaste"
        data-placeholder="请输入文本"
      ></div>
      <input
        type="file"
        ref="fileInput"
        multiple
        accept="image/*"
        style="display: none;"
        @change="handleFileChange"
      />
      <Transition>
        <button @click="fileInput.click()" class="addBtn" :disabled="isLoading">+</button>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ImageContainer from './ImageContainer.vue'
import { MessageImage } from '../models/Message'
import { compressImage } from '../composables/useImageCompress'

defineProps<{
  isLoading: boolean
}>()

const emit = defineEmits<{
  send: [payload: { content: string; images: MessageImage[] }]
}>()

const inputRef = ref<HTMLDivElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const images = ref<MessageImage[]>([])

let previewImageCount = 0

const onPreviewImageLoaded = () => {
  if (++previewImageCount === images.value.length) {
    previewImageCount = 0
  }
}

const addCompressedImage = async (file: File | Blob) => {
  try {
    const { file: compressed, url, originalFile } = await compressImage(file)
    images.value.push(new MessageImage({ imageUrl: url, file: compressed, originalFile }))
  } catch (err) {
    console.error('图片压缩失败:', err)
  }
}

const handleFileChange = async (e: Event) => {
  const files = (e.target as HTMLInputElement).files
  if (!files || files.length === 0) return
  for (const file of files) {
    await addCompressedImage(file)
  }
  ;(e.target as HTMLInputElement).value = ''
}

const handlePaste = async (e: ClipboardEvent) => {
  const files = e.clipboardData?.files
  if (!files || files.length === 0) return
  for (const file of files) {
    if (file.type.startsWith('image/')) {
      e.preventDefault()
      await addCompressedImage(file)
    }
  }
}

const onImageDeleted = (index: number) => {
  images.value.splice(index, 1)
}

const handleSend = () => {
  if (!inputRef.value) return
  const content = inputRef.value.textContent.trim()
  if (content === '' && images.value.length === 0) return

  emit('send', { content, images: [...images.value] })

  // 清空输入
  inputRef.value.textContent = ''
  images.value = []
}

defineExpose({
  focus: () => inputRef.value?.focus(),
})
</script>

<style scoped>
.questionBar {
  display: flex;
  flex-direction: column;
  margin: 0 auto;
  width: 80%;
  background-color: whitesmoke;
  padding: 20px;
  border-radius: 15px;
  flex-shrink: 0;
  margin-bottom: 20px;
}

.imageContainers {
  display: flex;
  width: 100%;
  overflow: scroll;
  scrollbar-width: none;
}

.inputArea {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}

.inputMessage {
  width: 100%;
  outline: none;
  border: none;
  background-color: whitesmoke;
  min-height: 24px;
  max-height: 150px;
  overflow-y: auto;
  line-height: 1.5;
  word-break: break-word;
}

.inputMessage:empty::before {
  content: attr(data-placeholder);
  color: #999;
}

.inputMessage.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.addBtn {
  height: 30px;
  width: 30px;
  flex-shrink: 0;
  background-color: rgb(223, 223, 223);
  border: none;
  border-radius: 5px;
  font-weight: 700;
}

.addBtn:hover {
  background-color: rgb(192, 192, 192);
}

.addBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.v-enter-active {
  transition: opacity 1s ease;
}

.v-leave-active {
  transition: opacity 0.5s ease;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}
</style>
