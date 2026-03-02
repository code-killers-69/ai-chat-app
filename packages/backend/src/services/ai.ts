import OpenAI from 'openai'
import { getPool } from '../config/database'
import type { ModelInfo, StreamChatParams } from '../types'

// 硅基流动 SiliconFlow - 超低价/免费模型
const client = new OpenAI({
  apiKey: process.env.SILICONFLOW_API_KEY,
  baseURL: 'https://api.siliconflow.cn/v1',
})

// 默认模型
const MODELS = {
  text: 'Qwen/Qwen2.5-7B-Instruct',
  vision: 'Qwen/Qwen2-VL-72B-Instruct',
}

// 可用模型列表
export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: 'Qwen/Qwen2.5-7B-Instruct',
    name: 'Qwen2.5-7B',
    provider: 'Qwen',
    icon: 'https://img.icons8.com/?size=100&id=kTuxVYRKeKEY&format=png&color=000000',
    description: '免费模型，速度快，适合日常对话',
    free: true,
    supportVision: false,
  },
  {
    id: 'Qwen/Qwen2.5-14B-Instruct',
    name: 'Qwen2.5-14B',
    provider: 'Qwen',
    icon: 'https://img.icons8.com/?size=100&id=kTuxVYRKeKEY&format=png&color=000000',
    description: '中等规模，平衡速度与质量',
    free: false,
    supportVision: false,
  },
  {
    id: 'Qwen/Qwen2.5-72B-Instruct',
    name: 'Qwen2.5-72B',
    provider: 'Qwen',
    icon: 'https://img.icons8.com/?size=100&id=kTuxVYRKeKEY&format=png&color=000000',
    description: '大参数模型，回答质量更高',
    free: false,
    supportVision: false,
  },
  {
    id: 'deepseek-ai/DeepSeek-V3',
    name: 'DeepSeek-V3',
    provider: 'DeepSeek',
    icon: 'https://cdn.deepseek.com/chat/icon.png',
    description: 'DeepSeek 最新模型，综合能力强',
    free: false,
    supportVision: false,
  },
  {
    id: 'deepseek-ai/DeepSeek-R1',
    name: 'DeepSeek-R1',
    provider: 'DeepSeek',
    icon: 'https://cdn.deepseek.com/chat/icon.png',
    description: '深度推理模型，擅长复杂任务',
    free: false,
    supportVision: false,
  },
  {
    id: 'THUDM/GLM-4-9B-0414',
    name: 'GLM-4-9B',
    provider: 'GLM',
    icon: 'https://chatglm.cn/img/icons/apple-touch-icon-152x152.png',
    description: '智谱 GLM 系列，中文能力优秀',
    free: false,
    supportVision: false,
  },
  {
    id: 'Qwen/Qwen2-VL-72B-Instruct',
    name: 'Qwen2-VL-72B',
    provider: 'Qwen',
    icon: 'https://img.icons8.com/?size=100&id=kTuxVYRKeKEY&format=png&color=000000',
    description: '视觉模型，支持图片理解与分析',
    free: false,
    supportVision: true,
  },
]

const MAX_HISTORY_LENGTH = 20

type MessageContent = string | Array<{ type: string; text?: string; image_url?: { url: string } }>

class AIService {
  private client: OpenAI

  constructor() {
    this.client = client
  }

  async getConversationHistoryFromDB(conversationId: string, limit: number = MAX_HISTORY_LENGTH): Promise<Array<{ role: string; content: string }>> {
    if (!conversationId || conversationId === 'anonymous') {
      return []
    }

    try {
      const safeLimit = Math.max(1, Math.min(limit, 100))
      const [messages] = await getPool().execute(
        `SELECT role, content FROM messages 
         WHERE conversation_id = ? 
         ORDER BY created_at DESC 
         LIMIT ${safeLimit}`,
        [conversationId]
      ) as [Array<{ role: string; content: string }>, unknown]

      messages.reverse()

      return messages.map(m => ({
        role: m.role,
        content: m.content,
      }))
    } catch (error) {
      console.error('Failed to load history from DB:', (error as Error).message)
      return []
    }
  }

  buildMessageContent(text: string, images: string[] = []): MessageContent {
    if (images.length === 0) {
      return text || '你好'
    }

    const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = []

    if (text) {
      content.push({ type: 'text', text })
    }

    for (const image of images) {
      content.push({
        type: 'image_url',
        image_url: {
          url: image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`,
        },
      })
    }

    return content
  }

  async streamChat({ conversationId, userId, message, images = [], model: requestedModel, onChunk, onComplete }: StreamChatParams): Promise<string> {
    const messageContent = this.buildMessageContent(message, images)

    const history = await this.getConversationHistoryFromDB(conversationId)

    let model: string
    if (requestedModel) {
      const valid = AVAILABLE_MODELS.find(m => m.id === requestedModel)
      model = valid ? valid.id : (images.length > 0 ? MODELS.vision : MODELS.text)
    } else {
      model = images.length > 0 ? MODELS.vision : MODELS.text
    }
    if (images.length > 0) {
      const selected = AVAILABLE_MODELS.find(m => m.id === model)
      if (selected && !selected.supportVision) {
        model = MODELS.vision
      }
    }

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: MessageContent }> = [
      {
        role: 'system',
        content: '你是一个友好的AI助手，可以帮助用户解答问题、分析图片内容。请用简洁清晰的方式回答。',
      },
      ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content as MessageContent })),
      { role: 'user', content: messageContent },
    ]

    try {
      console.log('Calling AI with model:', model, '| History count:', history.length)

      const stream = await this.client.chat.completions.create({
        model,
        messages: messages as OpenAI.ChatCompletionMessageParam[],
        stream: true,
        max_tokens: 2048,
      })

      let fullResponse = ''

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || ''
        if (content) {
          fullResponse += content
          onChunk?.(content)
        }
      }

      await onComplete?.(fullResponse)

      return fullResponse
    } catch (error) {
      console.error('AI Service Error:', (error as Error).message)
      console.error('Error details:', error)
      throw error
    }
  }
}

export const aiService = new AIService()
