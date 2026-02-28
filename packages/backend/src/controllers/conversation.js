import { messageService } from '../services/message.js';

/**
 * 获取会话列表
 */
export async function getConversations(req, res) {
  try {
    const conversations = await messageService.getConversations(req.user.userId);
    res.json({ success: true, data: conversations });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取会话列表失败' });
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
    res.status(500).json({ success: false, error: '创建会话失败' });
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
    res.status(500).json({ success: false, error: '获取会话信息失败' });
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
    res.status(500).json({ success: false, error: '获取会话详情失败' });
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
    res.status(500).json({ success: false, error: '更新会话标题失败' });
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
    res.status(500).json({ success: false, error: '删除会话失败' });
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
    res.status(500).json({ success: false, error: '获取消息失败' });
  }
}

/**
 * 全文搜索消息
 * GET /api/conversations/search?q=keyword&limit=20&offset=0
 */
export async function searchMessages(req, res) {
  const { q, limit, offset } = req.query;

  if (!q || !q.trim()) {
    return res.status(400).json({ success: false, error: '搜索关键词不能为空' });
  }

  try {
    const result = await messageService.searchMessages(
      req.user.userId,
      q.trim(),
      { limit: limit ? parseInt(limit, 10) : 20, offset: offset ? parseInt(offset, 10) : 0 }
    );
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Search messages error:', error);
    res.status(500).json({ success: false, error: '搜索失败' });
  }
}
