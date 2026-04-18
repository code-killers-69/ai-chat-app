

import { ref } from 'vue'
import imgCompressor from '@/utils/imgCompress'

export const imageHandler = () => {
    const imageUrls = ref([])
    const imageMultipart = ref([])
    const fallBackBlobs = ref([])
    const isCompressing = ref(false);


    //   压缩逻辑
    const imgCompress = async (imgToComprs = []) => {
        const myWorker = new Worker(
            new URL('../utils/worker.js', import.meta.url),
            { type: 'module' },
        );

        try {

            isCompressing.value = true

            if (window.Worker) {
                //  支持worker
                const buffers = await Promise.all(imgToComprs.map(f => f.arrayBuffer()))
                const types = imgToComprs.map(f => f.type)
                myWorker.postMessage({ buffers, types }, buffers)


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
                //  不支持，走主线程
                imageMultipart.value = await imgCompressor(imgToComprs)
                fallBackBlobs.value = await imgCompressor(imgToComprs)
                isCompressing.value = false
            }
        } catch (error) {
            console.log(error);
            isCompressing.value = false
            if (myWorker) myWorker.terminate()
        }
    }
    //  本地预览逻辑
    const generatePreviewAndUpload = (files = []) => {
        if (!files || files.length === 0) return;
        
        const validFiles = Array.from(files).filter((file) =>
            file.type.includes('image'),
        );
        if (validFiles.length === 0) return;

        for (const file of validFiles) {
            imageUrls.value.push({ webpUrl: URL.createObjectURL(file) });
        }

        imgCompress(validFiles);
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
        clearImages
    }
}