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