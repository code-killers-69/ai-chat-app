/**
 * 分片上传 Web Worker
 * 在独立线程中执行：文件分片 → 并行上传 → 合并
 *
 * 消息协议：
 *   请求: { file, filename, mimeType, token, apiBase, chunkSize? }
 *   进度: { type: 'progress', uploaded, total, percent }
 *   完成: { type: 'complete', success: true, data }
 *   错误: { type: 'complete', success: false, error }
 */

const DEFAULT_CHUNK_SIZE = 256 * 1024 // 256KB 每片
const MAX_CONCURRENT = 3               // 并行上传数

self.addEventListener('message', async (e) => {
  const {
    file,
    filename,
    mimeType,
    token,
    apiBase,
    chunkSize = DEFAULT_CHUNK_SIZE,
  } = e.data

  try {
    const totalChunks = Math.ceil(file.size / chunkSize)

    // 1. 初始化上传
    const initRes = await fetch(`${apiBase}/upload/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        filename,
        mimeType,
        totalChunks,
        fileSize: file.size,
      }),
    })

    if (!initRes.ok) throw new Error(`初始化失败 (${initRes.status})`)
    const initData = await initRes.json()
    if (!initData.success) throw new Error(initData.error)

    const { uploadId, receivedChunks } = initData.data
    const alreadyUploaded = new Set(receivedChunks)

    // 2. 并行分片上传
    let uploaded = alreadyUploaded.size

    // 报告初始进度
    self.postMessage({
      type: 'progress',
      uploaded,
      total: totalChunks,
      percent: Math.round(uploaded / totalChunks * 100),
    })

    // 待上传的分片索引
    const pendingChunks = []
    for (let i = 0; i < totalChunks; i++) {
      if (!alreadyUploaded.has(i)) {
        pendingChunks.push(i)
      }
    }

    // 并行上传控制器
    let cursor = 0

    async function uploadNext() {
      while (cursor < pendingChunks.length) {
        const idx = cursor++
        const chunkIndex = pendingChunks[idx]
        const start = chunkIndex * chunkSize
        const end = Math.min(start + chunkSize, file.size)
        const chunk = file.slice(start, end)

        const formData = new FormData()
        formData.append('uploadId', uploadId)
        formData.append('chunkIndex', String(chunkIndex))
        formData.append('chunk', chunk, `chunk_${chunkIndex}`)

        // 重试逻辑
        let retries = 3
        while (retries > 0) {
          try {
            const res = await fetch(`${apiBase}/upload/chunk`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` },
              body: formData,
            })
            if (!res.ok) throw new Error(`分片 ${chunkIndex} 上传失败`)
            const data = await res.json()
            if (!data.success) throw new Error(data.error)
            break
          } catch (err) {
            retries--
            if (retries === 0) throw err
            await new Promise(r => setTimeout(r, 1000))
          }
        }

        uploaded++
        self.postMessage({
          type: 'progress',
          uploaded,
          total: totalChunks,
          percent: Math.round(uploaded / totalChunks * 100),
        })
      }
    }

    // 启动并行上传
    const workers = []
    for (let i = 0; i < Math.min(MAX_CONCURRENT, pendingChunks.length); i++) {
      workers.push(uploadNext())
    }
    await Promise.all(workers)

    // 3. 合并分片
    const completeRes = await fetch(`${apiBase}/upload/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ uploadId }),
    })

    if (!completeRes.ok) throw new Error(`合并失败 (${completeRes.status})`)
    const completeData = await completeRes.json()
    if (!completeData.success) throw new Error(completeData.error)

    self.postMessage({
      type: 'complete',
      success: true,
      data: completeData.data,
    })
  } catch (error) {
    self.postMessage({
      type: 'complete',
      success: false,
      error: error.message,
    })
  }
})
