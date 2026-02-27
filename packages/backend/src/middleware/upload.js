import multer from 'multer';

/**
 * multer 配置：图片上传
 * 使用内存存储（memoryStorage），文件以 Buffer 形式存在 req.files 中
 * 不直接写磁盘，由 storageService 统一管理存储位置
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 单张最大 10MB
    files: 10,                   // 最多 10 张图
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'), false);
    }
  },
});

const multerImages = upload.fields([
  { name: 'images', maxCount: 10 },
]);

const multerFallbacks = upload.fields([
  { name: 'fallbacks', maxCount: 10 },
]);

/**
 * 兼容性图片上传中间件（聊天接口用，只接收主图）
 * - multipart/form-data 请求：走 multer 解析，图片在 req.files
 * - application/json 请求：跳过 multer，图片在 req.body.images（base64）
 */
export const uploadImages = (req, res, next) => {
  const contentType = req.headers['content-type'] || '';

  // 只有 multipart 请求才走 multer，JSON 请求直接放行
  if (contentType.includes('multipart/form-data')) {
    multerImages(req, res, next);
  } else {
    next();
  }
};

/**
 * 兜底图上传中间件（独立接口用，只接收 fallbacks）
 */
export const uploadFallbacks = (req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    multerFallbacks(req, res, next);
  } else {
    next();
  }
};
