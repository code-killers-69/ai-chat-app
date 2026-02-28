import { aiService, AVAILABLE_MODELS } from '../services/ai.js';
import { messageService } from '../services/message.js';
import { storageService } from '../services/storage.js';

/**
 * 统一处理图片：同时兼容 multipart 上传和 JSON base64 两种方式
 *
 * - multipart：图片在 req.files（multer memoryStorage 解析的 Buffer）
 * - JSON：图片在 req.body.images（base64 data URL 字符串数组）
 *
 * 无论哪种方式，都返回统一格式：
 * @param {Object} req - Express 请求对象
 * @returns {{ imageDataList: Array, base64Images: Array }}
 *   - imageDataList: 用于存储服务（Buffer/string + 元数据）
 *   - base64Images: 用于 AI 接口（data URL 字符串）
 */
function extractImages(req) {
  const imageDataList = [];
  const base64Images = [];

  // 优先使用 multipart 上传的文件（只有主图，无 fallback）
  const mainFiles = req.files?.images || [];

  if (mainFiles.length > 0) {
    for (const file of mainFiles) {
      imageDataList.push({
        data: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
      });
      const base64 = file.buffer.toString('base64');
      base64Images.push(`data:${file.mimetype};base64,${base64}`);
    }
    return { imageDataList, base64Images };
  }

  // 兼容旧方式：JSON body 里的 base64 图片数组
  const bodyImages = req.body?.images;
  if (Array.isArray(bodyImages) && bodyImages.length > 0) {
    for (const dataUrl of bodyImages) {
      if (typeof dataUrl !== 'string') continue;

      base64Images.push(dataUrl);

      const mimeMatch = dataUrl.match(/^data:(image\/[^;]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const extMap = { 'image/webp': '.webp', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif' };
      const ext = extMap[mimeType] || '.jpg';
      imageDataList.push({
        data: dataUrl,
        originalName: `image${ext}`,
        mimeType,
      });
    }
  }

  return { imageDataList, base64Images };
}

/**
 * 流式聊天（SSE）
 * 支持匿名和登录用户，登录用户自动持久化会话和消息
 */
export async function streamChat(req, res) {
  const { message, conversationId, model } = req.body;
  const userId = req.user?.userId;
  const { imageDataList, base64Images } = extractImages(req);

  // 设置 SSE 头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  let dbConversationId = conversationId;

  try {
    let savedImageIds = [];

    // 如果用户已登录，进行持久化
    if (userId) {
      if (!dbConversationId) {
        const conv = await messageService.createConversation(userId, (message || '').slice(0, 50) || '新对话');
        dbConversationId = conv.id;
        res.write(`data: ${JSON.stringify({ type: 'conversation', conversationId: dbConversationId })}\n\n`);
      }

      const savedMsg = await messageService.saveUserMessage(dbConversationId, message, imageDataList);
      savedImageIds = (savedMsg.images || []).map(img => img.id);
    }

    let fullResponse = '';

    await aiService.streamChat({
      conversationId: dbConversationId || 'anonymous',
      userId: userId || 'anonymous',
      message,
      images: base64Images,
      model,
      onChunk: (chunk) => {
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
      },
      onComplete: async (response) => {
        if (userId && dbConversationId) {
          await messageService.saveAssistantMessage(dbConversationId, response);
        }
        const doneData = { type: 'done', content: response };
        if (savedImageIds.length > 0) {
          doneData.imageIds = savedImageIds;
        }
        res.write(`data: ${JSON.stringify(doneData)}\n\n`);
        res.end();
      },
    });
  } catch (error) {
    console.error('Stream chat error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  }
}

/**
 * 普通聊天（非流式）
 */
export async function sendMessage(req, res) {
  const { message, conversationId, model } = req.body;
  const userId = req.user?.userId;
  const { imageDataList, base64Images } = extractImages(req);

  try {
    let dbConversationId = conversationId;
    let savedImageIds = [];

    if (userId) {
      if (!dbConversationId) {
        const conv = await messageService.createConversation(userId, (message || '').slice(0, 50) || '新对话');
        dbConversationId = conv.id;
      }

      const savedMsg = await messageService.saveUserMessage(dbConversationId, message, imageDataList);
      savedImageIds = (savedMsg.images || []).map(img => img.id);
    }

    let fullResponse = '';

    await aiService.streamChat({
      conversationId: dbConversationId || 'anonymous',
      userId: userId || 'anonymous',
      message,
      images: base64Images,
      model,
      onChunk: (chunk) => {
        fullResponse += chunk;
      },
      onComplete: async () => {
        if (userId && dbConversationId) {
          await messageService.saveAssistantMessage(dbConversationId, fullResponse);
        }
      },
    });

    const responseData = {
      content: fullResponse,
      conversationId: dbConversationId,
      timestamp: new Date().toISOString(),
    };
    if (savedImageIds.length > 0) {
      responseData.imageIds = savedImageIds;
    }

    res.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
}

/**
 * 获取可用模型列表（图标缓存到本地文件，避免前端跨域 + 避免重复请求）
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';

const ICON_CACHE_DIR = join(process.cwd(), '.icon-cache');

// 内存缓存（避免每次读磁盘）
const iconCache = new Map();

function getIconCachePath(url) {
  const hash = createHash('md5').update(url).digest('hex');
  const ext = url.match(/\.(png|svg|ico|jpg|jpeg|webp)/)?.[1] || 'png';
  return join(ICON_CACHE_DIR, `${hash}.${ext}`);
}

async function fetchIconAsDataUrl(url) {
  if (iconCache.has(url)) return iconCache.get(url);

  // 确保缓存目录存在
  if (!existsSync(ICON_CACHE_DIR)) {
    mkdirSync(ICON_CACHE_DIR, { recursive: true });
  }

  const cachePath = getIconCachePath(url);

  // 本地文件缓存命中
  if (existsSync(cachePath)) {
    try {
      const buffer = readFileSync(cachePath);
      const ext = cachePath.split('.').pop();
      const mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', ico: 'image/x-icon', webp: 'image/webp' };
      const contentType = mimeMap[ext] || 'image/png';
      const dataUrl = `data:${contentType};base64,${buffer.toString('base64')}`;
      iconCache.set(url, dataUrl);
      return dataUrl;
    } catch {
      // 文件读取失败，走网络重新下载
    }
  }

  // 网络下载并存到本地
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'image/png';

    // 写入本地缓存
    writeFileSync(cachePath, buffer);

    const dataUrl = `data:${contentType};base64,${buffer.toString('base64')}`;
    iconCache.set(url, dataUrl);
    return dataUrl;
  } catch {
    return url;
  }
}

export async function getModels(req, res) {
  try {
    const uniqueIcons = [...new Set(AVAILABLE_MODELS.map(m => m.icon))];
    await Promise.all(uniqueIcons.map(url => fetchIconAsDataUrl(url)));

    const data = AVAILABLE_MODELS.map(m => ({
      ...m,
      icon: iconCache.get(m.icon) || m.icon,
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('getModels error:', error.message);
    res.json({ success: true, data: AVAILABLE_MODELS });
  }
}

/**
 * 健康检查
 */
export function healthCheck(req, res) {
  res.json({ status: 'ok' });
}

/**
 * 上传兜底图（独立接口，不阻塞 AI 响应）
 * 前端在聊天请求完成后异步调用，按 imageId 更新 fallback_url
 *
 * Body: multipart/form-data
 *   - imageIds: JSON 字符串，如 '["id1","id2"]'
 *   - fallbacks: file[]（与 imageIds 按索引一一对应）
 */
export async function uploadFallbacks(req, res) {
  try {
    const imageIds = JSON.parse(req.body?.imageIds || '[]');
    const fallbackFiles = req.files?.fallbacks || [];

    if (imageIds.length === 0 || fallbackFiles.length === 0) {
      return res.status(400).json({ success: false, error: '缺少 imageIds 或 fallbacks' });
    }

    const results = [];
    for (let i = 0; i < imageIds.length; i++) {
      const imageId = imageIds[i];
      const file = fallbackFiles[i];
      if (!file) continue;

      const { url } = await storageService.saveImage(
        file.buffer,
        file.originalname || 'fallback.jpg',
        file.mimetype || 'image/jpeg'
      );

      await messageService.updateImageFallback(imageId, url);
      results.push({ imageId, fallbackUrl: url });
    }

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Upload fallbacks error:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
}
