let sharedCanvas = null
let sharedCtx = null

const getSharedCanvas = (width, height) => {
    //  首次流程
    //  回退机制
    if (!sharedCanvas) {
        if (typeof OffscreenCanvas !== 'undefined' && typeof document === 'undefined') {
            sharedCanvas = new OffscreenCanvas(width, height)
            sharedCtx = sharedCanvas.getContext('2d')
        } else {
            sharedCanvas = document.createElement('canvas')
            sharedCtx = sharedCanvas.getContext('2d')
        }
    }

    //  常规流程
    sharedCanvas.width = width
    sharedCanvas.height = height

    return { canvas: sharedCanvas, ctx: sharedCtx }
}

const imgCompressor = async (file = [], type = "image/webp", quality = 0.8) => {

    //  控制台
    if (Array.isArray(file)) {
        if (file.length === 0) return []
        const results = []
        for (const f of file) {
            try {
                const result = await imgCompressor(f, type, quality)
                if (result) results.push(result)
            } catch (error) {
                console.error('数组成员压缩错误:', error);
            }
        }
        return results
    }
    //  创建img

    let img = null
    try {
        img = await createImageBitmap(file)
        const fileSizeKB = file.size / 1024
        let maxWidth = 1920
        let targetQuality = 0.8

        //  压缩系数分配

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

        //  缩放系数
        if (img.height > maxWidth || img.width > maxWidth) {
            const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
            //  手动取整
            canvasHeight = Math.floor(canvasHeight * ratio)
            canvasWidth = Math.floor(canvasWidth * ratio)
        }

        //  开始压缩
        const { canvas, ctx } = getSharedCanvas(canvasWidth, canvasHeight)
        ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight)

        img.close()
        img = null

        if (canvas.convertToBlob) {
            const blob = await canvas.convertToBlob({ type: type, quality: targetQuality })
            return blob
        } else {
            return await new Promise((resolve, reject) => {
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob)
                    else reject(new Error('Canvas toBlob return failed'))
                }, type, targetQuality)
            })
        }
    } catch (error) {
        console.error('图片压缩失败:', error);
        if (img && typeof img.close === 'function') img.close()
        throw error
    }
}

export default imgCompressor

