import fs from 'fs/promises'
import { existsSync, mkdirSync } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import type { SaveImageResult } from '../types'

/**
 * 存储抽象层 - 支持本地/CDN/COS
 */
class StorageService {
  private storageType: string
  private localPath: string
  private baseUrl: string

  private cosConfig: {
    secretId?: string
    secretKey?: string
    bucket?: string
    region?: string
  }

  private cdnConfig: {
    baseUrl?: string
    uploadUrl?: string
  }

  constructor() {
    this.storageType = process.env.STORAGE_TYPE || 'local'
    this.localPath = process.env.LOCAL_STORAGE_PATH || './uploads'
    this.baseUrl = process.env.STORAGE_BASE_URL || 'http://localhost:3000/uploads'

    this.cosConfig = {
      secretId: process.env.COS_SECRET_ID,
      secretKey: process.env.COS_SECRET_KEY,
      bucket: process.env.COS_BUCKET,
      region: process.env.COS_REGION,
    }

    this.cdnConfig = {
      baseUrl: process.env.CDN_BASE_URL,
      uploadUrl: process.env.CDN_UPLOAD_URL,
    }

    if (this.storageType === 'local') {
      this.ensureLocalDir()
    }
  }

  private ensureLocalDir(): void {
    const uploadDir = path.resolve(this.localPath)
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true })
    }
  }

  async saveImage(data: Buffer | string, originalName: string, mimeType: string): Promise<SaveImageResult> {
    const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
    if (!mimeType || !supportedTypes.includes(mimeType)) {
      mimeType = 'image/jpeg'
    }

    const ext = this.getExtFromMime(mimeType)
    const filename = `${uuidv4()}${ext}`

    let buffer: Buffer
    if (typeof data === 'string') {
      const base64Data = data.replace(/^data:image\/[^;]+;base64,/, '')
      buffer = Buffer.from(base64Data, 'base64')
    } else {
      buffer = data
    }

    switch (this.storageType) {
      case 'local':
        return this.saveToLocal(buffer, filename, mimeType)
      case 'cos':
        return this.saveToCOS(buffer, filename, mimeType)
      case 'cdn':
        return this.saveToCDN(buffer, filename, mimeType)
      default:
        return this.saveToLocal(buffer, filename, mimeType)
    }
  }

  private async saveToLocal(buffer: Buffer, filename: string, _mimeType: string): Promise<SaveImageResult> {
    const filePath = path.join(path.resolve(this.localPath), filename)
    await fs.writeFile(filePath, buffer)

    return {
      url: `${this.baseUrl}/${filename}`,
      storageType: 'local',
      size: buffer.length,
      filename,
    }
  }

  private async saveToCOS(buffer: Buffer, filename: string, mimeType: string): Promise<SaveImageResult> {
    // TODO: 实现 COS 上传
    console.warn('COS storage not implemented, falling back to local')
    return this.saveToLocal(buffer, filename, mimeType)
  }

  private async saveToCDN(buffer: Buffer, filename: string, mimeType: string): Promise<SaveImageResult> {
    // TODO: 实现 CDN 上传
    console.warn('CDN storage not implemented, falling back to local')
    return this.saveToLocal(buffer, filename, mimeType)
  }

  async deleteImage(url: string, storageType: string): Promise<void> {
    if (storageType === 'local') {
      const filename = path.basename(url)
      const filePath = path.join(path.resolve(this.localPath), filename)
      await fs.access(filePath).then(() => fs.unlink(filePath)).catch(() => {})
    }
    // TODO: 实现 COS/CDN 删除
  }

  private getExtFromMime(mimeType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
    }
    return map[mimeType] || '.jpg'
  }
}

export const storageService = new StorageService()
