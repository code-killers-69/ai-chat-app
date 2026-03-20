// 全局复用的 Canvas 实例和 Context (用于主线程或 Worker 顶层)
let sharedCanvas = null;
let sharedCtx = null;

// 辅助函数：初始化或重置复用的 Canvas
// NOTE: 每次重新赋值 width 和 height 会隐式清空画布并重置内部所有状态，确保"干爽"交接
const getSharedCanvas = (width, height) => {
  if (!sharedCanvas) {
    if (
      typeof OffscreenCanvas !== 'undefined' &&
      typeof document === 'undefined'
    ) {
      // Web Worker 环境
      sharedCanvas = new OffscreenCanvas(width, height);
      sharedCtx = sharedCanvas.getContext('2d');
    } else {
      // 主线程环境
      sharedCanvas = document.createElement('canvas');
      sharedCtx = sharedCanvas.getContext('2d');
    }
  }

  // 核心操作：这步会自动清理掉上一次画过的像素和状态
  sharedCanvas.width = width;
  sharedCanvas.height = height;

  return { canvas: sharedCanvas, ctx: sharedCtx };
};

const imgCompressor = async (file, Type = 'image/webp', quality) => {
  // 1. 处理数组逻辑：改为【串行】执行，以确保复用单例时不发生并发竞态导致画面错乱
  if (Array.isArray(file)) {
    if (file.length === 0) return [];
    const results = [];
    for (const f of file) {
      try {
        const result = await imgCompressor(f, Type, quality);
        if (result) results.push(result);
      } catch (error) {
        console.error('数组成员压缩错误:', error);
      }
    }
    return results;
  }

  let img = null;
  try {
    // 异步创建一个canvas元数据，用于重绘
    img = await createImageBitmap(file);

    // 核心逻辑：根据文件大小（KB）动态设置压缩参数
    const fileSizeKB = file.size / 1024;

    let maxWidth = 1920;
    let targetQuality = quality || 0.8;

    if (fileSizeKB > 1000) {
      maxWidth = 1024;
      targetQuality = quality || 0.7;
    } else if (fileSizeKB > 500) {
      maxWidth = 1280;
      targetQuality = quality || 0.75;
    } else if (fileSizeKB > 300) {
      maxWidth = 1440;
      targetQuality = quality || 0.8;
    }

    let canvasHeight = img.height;
    let canvasWidth = img.width;

    // 计算缩放因子
    if (img.height > maxWidth || img.width > maxWidth) {
      const ratio = Math.min(maxWidth / img.height, maxWidth / img.width);
      // 必须转为整数，避免小数点造成的锯齿或报错
      canvasHeight = Math.floor(canvasHeight * ratio);
      canvasWidth = Math.floor(canvasWidth * ratio);
    }

    // 获取复用实例并重置尺寸
    const { canvas, ctx } = getSharedCanvas(canvasWidth, canvasHeight);

    // 准备重绘，第一次压缩
    ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

    // 释放源图像内存
    img.close();
    img = null;

    // canvas转码blob，第二次压缩
    if (canvas.convertToBlob) {
      // 适用于 OffscreenCanvas (Web Worker 环境)
      const blob = await canvas.convertToBlob({
        type: Type,
        quality: targetQuality,
      });
      return blob;
    } else {
      // 适用于 普通 HTMLCanvasElement (主线程)
      return await new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas toBlob return null'));
          },
          Type,
          targetQuality,
        );
      });
    }
  } catch (error) {
    console.error('图片压缩错误:', error);
    // 确保出错时也能回收 img bitmap 内存
    if (img && typeof img.close === 'function') {
      img.close();
    }
    throw error;
  }
};

export default imgCompressor;
