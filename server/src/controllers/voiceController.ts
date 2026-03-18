// controllers/voiceController.ts - 语音识别控制器
import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import voiceService from '../services/voiceService';
import { success, error, ErrorCode } from '../utils/response';
import { authMiddleware } from '../middlewares/auth';

/**
 * 语音识别接口
 * POST /api/voice/recognize
 * Body: { audio: "base64编码的音频数据", format: "mp3|wav|pcm" }
 */
export const recognizeVoice = [
  authMiddleware,
  body('audio').isString().withMessage('请提供音频数据'),
  body('format').optional().isIn(['mp3', 'wav', 'pcm']).withMessage('不支持的音频格式'),

  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        error(res, ErrorCode.BAD_REQUEST, errors.array()[0].msg);
        return;
      }

      const { audio, format = 'mp3' } = req.body;

      // 调用语音识别服务
      const text = await voiceService.recognize(audio, format);

      success(res, { text });
    } catch (err: any) {
      // 语音识别失败，返回友好提示
      success(res, { 
        text: '', 
        error: err.message || '语音识别失败',
        fallback: true 
      });
    }
  },
];

/**
 * 小程序上传音频文件识别
 * POST /api/voice/upload
 * FormData: audio file
 */
export const uploadVoice = [
  authMiddleware,

  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        error(res, ErrorCode.BAD_REQUEST, '请上传音频文件');
        return;
      }

      // 将文件转换为 base64
      const audioBase64 = req.file.buffer.toString('base64');
      const format = req.file.mimetype.includes('mp3') ? 'mp3' : 
                     req.file.mimetype.includes('wav') ? 'wav' : 'pcm';

      // 调用语音识别服务
      const text = await voiceService.recognize(audioBase64, format);

      success(res, { text });
    } catch (err: any) {
      success(res, { 
        text: '', 
        error: err.message || '语音识别失败',
        fallback: true 
      });
    }
  },
];