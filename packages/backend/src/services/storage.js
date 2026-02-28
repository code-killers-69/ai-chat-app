import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * 存储抽象层 - 支持本地/CDN/COS
 * 通过环境变量 STORAGE_TYPE 切换存储方式
 */
class StorageService {
  constructor() {
    this.storageType = process.env.STORAGE_TYPE || 'local';
    this.localPath = process.env.LOCAL_STORAGE_PATH || './uploads';
    this.baseUrl = process.env.STORAGE_BASE_URL || 'http://localhost:3000/uploads';
    
    // COS 配置
    this.cosConfig = {
      secretId: process.env.COS_SECRET_ID,
      secretKey: process.env.COS_SECRET_KEY,
      bucket: process.env.COS_BUCKET,
      region: process.env.COS_REGION,
    };
    
    // CDN 配置
    this.cdnConfig = {
      baseUrl: process.env.CDN_BASE_URL,
      uploadUrl: process.env.CDN_UPLOAD_URL,
    };
    
    // 确保本地存储目录存在
    if (this.storageType === 'local') {
      this.ensureLocalDir();
    }
  }

  ensureLocalDir() {
    const uploadDir = path.resolve(this.localPath);
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
    }
  }

  /**
   * 保存图片
   * @param {Buffer|string} data - 图片数据（Buffer 或 base64 字符串）
   * @param {string} originalName - 原始文件名
   * @param {string} mimeType - MIME 类型
   * @returns {Promise<{url: string, storageType: string, size: number}>}
   */
  async saveImage(data, originalName, mimeType) {
    // 兜底：如果 MIME 类型无效或不支持，默认按 jpeg 处理
    const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!mimeType || !supportedTypes.includes(mimeType)) {
      mimeType = 'image/jpeg';
    }

    const ext = this.getExtFromMime(mimeType);
    const filename = `${uuidv4()}${ext}`;
    
    let buffer = data;
    if (typeof data === 'string') {
      // 处理 base64 数据（兼容 webp/jpeg/png 等所有格式的 data URL）
      const base64Data = data.replace(/^data:image\/[^;]+;base64,/, '');
      buffer = Buffer.from(base64Data, 'base64');
    }

    switch (this.storageType) {
      case 'local':
        return this.saveToLocal(buffer, filename, mimeType);
      case 'cos':
        return this.saveToCOS(buffer, filename, mimeType);
      case 'cdn':
        return this.saveToCDN(buffer, filename, mimeType);
      default:
        return this.saveToLocal(buffer, filename, mimeType);
    }
  }

  async saveToLocal(buffer, filename, mimeType) {
    const filePath = path.join(path.resolve(this.localPath), filename);
    await fs.writeFile(filePath, buffer);
    
    return {
      url: `${this.baseUrl}/${filename}`,
      storageType: 'local',
      size: buffer.length,
      filename
    };
  }

  async saveToCOS(buffer, filename, mimeType) {
    // TODO: 实现 COS 上传
    // 需要安装 cos-nodejs-sdk-v5
    // const COS = require('cos-nodejs-sdk-v5');
    // const cos = new COS({...this.cosConfig});
    // await cos.putObject({...});
    
    // 暂时回退到本地存储
    console.warn('COS storage not implemented, falling back to local');
    return this.saveToLocal(buffer, filename, mimeType);
  }

  async saveToCDN(buffer, filename, mimeType) {
    // TODO: 实现 CDN 上传
    // 根据具体 CDN 服务商实现
    
    // 暂时回退到本地存储
    console.warn('CDN storage not implemented, falling back to local');
    return this.saveToLocal(buffer, filename, mimeType);
  }

  /**
   * 删除图片
   * @param {string} url - 图片 URL
   * @param {string} storageType - 存储类型
   */
  async deleteImage(url, storageType) {
    if (storageType === 'local') {
      const filename = path.basename(url);
      const filePath = path.join(path.resolve(this.localPath), filename);
      await fs.access(filePath).then(() => fs.unlink(filePath)).catch(() => {});
    }
    // TODO: 实现 COS/CDN 删除
  }

  getExtFromMime(mimeType) {
    const map = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
    };
    return map[mimeType] || '.jpg';
  }
}

export const storageService = new StorageService();
