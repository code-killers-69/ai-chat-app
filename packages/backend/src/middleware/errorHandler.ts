import type { Request, Response, NextFunction } from 'express'

interface AppError extends Error {
  status?: number
}

const isDev = process.env.NODE_ENV !== 'production'

export const errorHandler = (err: AppError, req: Request, res: Response, _next: NextFunction): void => {
  // 开发环境打印完整堆栈，生产环境只记录摘要
  if (isDev) {
    console.error('Error:', err)
  } else {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${err.message}`)
  }

  if (err.status) {
    res.status(err.status).json({
      success: false,
      error: err.message,
    })
    return
  }

  res.status(500).json({
    success: false,
    error: isDev ? err.message : 'Internal server error',
  })
}
