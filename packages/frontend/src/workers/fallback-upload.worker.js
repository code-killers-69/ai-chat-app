/**
 * Web Worker：后台压缩兜底图（JPEG）+ 上传
 * 主线程传入原始图片文件，Worker 用 OffscreenCanvas 压缩成 jpeg，然后上传。
 * 完全不占用主线程。
 */

/**
 * 将原始图片文件压缩为 jpeg Blob
 */
async function compressToJpeg(file, options = {}) {
  const { quality = 0.7, maxWidth = 2048, maxHeight = 2048 } = options;

  const bitmap = await createImageBitmap(file);
  let w = bitmap.width;
  let h = bitmap.height;

  // 等比缩放
  if (w > maxWidth || h > maxHeight) {
    const ratio = Math.min(maxWidth / w, maxHeight / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return canvas.convertToBlob({ type: 'image/jpeg', quality });
}

self.addEventListener('message', async (e) => {
  const { imageIds, originalFiles, token, apiBase, compressOptions } = e.data;
  try {
    // 1. 压缩所有原始图片为 jpeg
    const jpegBlobs = await Promise.all(
      originalFiles.map((file) => compressToJpeg(file, compressOptions))
    );

    // 2. 构建 FormData 上传
    const formData = new FormData();
    formData.append('imageIds', JSON.stringify(imageIds));
    for (const blob of jpegBlobs) {
      formData.append('fallbacks', blob, 'fallback.jpg');
    }

    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${apiBase}/chat/upload-fallbacks`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!res.ok) {
      self.postMessage({ success: false, error: `HTTP ${res.status}` });
    } else {
      const data = await res.json();
      self.postMessage({ success: true, data });
    }
  } catch (error) {
    self.postMessage({ success: false, error: error.message });
  }
});
