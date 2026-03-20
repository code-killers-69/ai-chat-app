import imgCompressor from './imgCompressor';

onmessage = async (event) => {
  try {
    const { buffers, types } = event.data;
    //  拼接blob
    const files = buffers.map(
      (buf, i) => new Blob([buf], { type: types[i] || 'image/jpeg' }),
    );

    // 1. 优先处理 webp 压缩
    const webpResult = await imgCompressor(files, 'image/webp', 0.8);
    const webpOutBuffers = await Promise.all(
      webpResult.map((f) => f.arrayBuffer()),
    );
    postMessage(
      { status: 'webp_success', data: webpOutBuffers },
      webpOutBuffers,
    );

    // 2. 接着处理 jpeg 压缩 (用于兜底)
    const jpegResult = await imgCompressor(files, 'image/jpeg', 0.8);
    const jpegOutBuffers = await Promise.all(
      jpegResult.map((f) => f.arrayBuffer()),
    );
    postMessage(
      { status: 'jpeg_success', data: jpegOutBuffers },
      jpegOutBuffers,
    );
  } catch (error) {
    console.error('Worker压缩失败:', error);
    postMessage({ status: 'error', error: error.message });
  }
};
