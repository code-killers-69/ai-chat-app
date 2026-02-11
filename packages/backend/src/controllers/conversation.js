import { messageService } from '../services/message.js';

/**
 * 获取会话列表
 */
export async function getConversations(req, res) {
  try {
    const conversations = await messageService.getConversations(req.user.userId);
    res.json({ success: true, data: conversations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * 创建新会话
 */
export async function createConversation(req, res) {
  const { title } = req.body;

  try {
    const conversation = await messageService.createConversation(req.user.userId, title);
    res.json({ success: true, data: conversation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * 获取会话元信息（不含消息）
 */
export async function getConversationInfo(req, res) {
  try {
    const conversation = await messageService.getConversationInfo(
      req.params.id,
      req.user.userId
    );

    if (!conversation) {
      return res.status(404).json({ success: false, error: '会话不存在' });
    }

    res.json({ success: true, data: conversation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * 获取会话详情（包含消息）
 */
export async function getConversationDetail(req, res) {
  try {
    const conversation = await messageService.getConversationWithMessages(
      req.params.id,
      req.user.userId
    );

    if (!conversation) {
      return res.status(404).json({ success: false, error: '会话不存在' });
    }

    res.json({ success: true, data: conversation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * 更新会话标题
 */
export async function updateConversation(req, res) {
  const { title } = req.body;

  if (!title) {
    return res.status(400).json({ success: false, error: '标题不能为空' });
  }

  try {
    await messageService.updateConversationTitle(req.params.id, req.user.userId, title);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * 删除会话
 */
export async function deleteConversation(req, res) {
  try {
    await messageService.deleteConversation(req.params.id, req.user.userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * 分页获取会话消息
 */
export async function getMessages(req, res) {
  try {
    const { limit, before, after } = req.query;

    const result = await messageService.getMessagesPaginated(
      req.params.id,
      req.user.userId,
      {
        limit: limit ? parseInt(limit, 10) : 20,
        before,
        after,
      }
    );

    if (!result) {
      return res.status(404).json({ success: false, error: '会话不存在' });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
