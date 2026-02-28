const isDev = process.env.NODE_ENV !== 'production';

export const errorHandler = (err, req, res, next) => {
  // 开发环境打印完整堆栈，生产环境只记录摘要
  if (isDev) {
    console.error('Error:', err);
  } else {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${err.message}`);
  }

  if (err.status) {
    return res.status(err.status).json({
      success: false,
      error: err.message,
    });
  }

  res.status(500).json({
    success: false,
    error: isDev ? err.message : 'Internal server error',
  });
};
