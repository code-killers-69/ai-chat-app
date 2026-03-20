import { ref } from 'vue';
import imgCompressor from '@/utils/imgCompressor';

export function useImageUpload() {
  const isCompressing = ref(false);
  const imageUrls = ref([]);
  const imageMultipart = ref([]);
  const fallBackBlobs = ref([]);

  const handleImgUpload = async (targetImg) => {
    // 初始化 worker，注意相对路径
    const myWorker = new Worker(
      new URL('../utils/worker.js', import.meta.url),
      { type: 'module' },
    );
    try {
      // 开启压缩锁
      isCompressing.value = true;

      if (window.Worker) {
        // worker通信 转成二进制数据流
        const buffers = await Promise.all(
          targetImg.map((f) => f.arrayBuffer()),
        );
        const types = targetImg.map((f) => f.type);
        myWorker.postMessage({ buffers, types }, buffers);

        myWorker.onmessage = (e) => {
          if (e.data.status === 'webp_success') {
            const webpData = e.data.data;
            // 重新转化成blob (webp)
            imageMultipart.value = webpData.map(
              (Buffer) => new Blob([Buffer], { type: 'image/webp' }),
            );
            // webp 准备就绪，解锁
            isCompressing.value = false;
          } else if (e.data.status === 'jpeg_success') {
            const jpegData = e.data.data;
            // 重新转化成blob (jpeg)
            fallBackBlobs.value = jpegData.map(
              (Buffer) => new Blob([Buffer], { type: 'image/jpeg' }),
            );
            myWorker.terminate();
          } else if (e.data.status === 'error') {
            console.error('Worker处理出错:', e.data.error);
            isCompressing.value = false;
            myWorker.terminate();
          }
        };
      } else {
        // 不支持worker 直接主线程处理
        imageMultipart.value = await imgCompressor(targetImg);
        fallBackBlobs.value = await imgCompressor(targetImg, 'image/jpeg');
        isCompressing.value = false;
      }
    } catch (error) {
      console.log(error);
      isCompressing.value = false;
      if (myWorker) myWorker.terminate();
    }
  };

  // 抽取生成本地预览的公共逻辑
  const generatePreviewAndUpload = (files) => {
    if (!files || files.length === 0) return;

    const validFiles = Array.from(files).filter((file) =>
      file.type.includes('image'),
    );
    if (validFiles.length === 0) return;

    for (const file of validFiles) {
      imageUrls.value.push({ webpUrl: URL.createObjectURL(file) });
    }

    handleImgUpload(validFiles);
  };

  const clearImages = () => {
    imageUrls.value = [];
    imageMultipart.value = [];
  };

  return {
    isCompressing,
    imageUrls,
    imageMultipart,
    fallBackBlobs,
    generatePreviewAndUpload,
    clearImages,
  };
}
