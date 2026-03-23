// controllers/voiceController.ts - 语音识别控制器
import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import voiceService, { VoiceError, VoiceErrorType } from '../services/voiceService';
import { success, error, ErrorCode } from '../utils/response';
import { authMiddleware } from '../middlewares/auth';
import logger from '../utils/logger';

/**
 * 音频数据最大大小 (5MB)
 */
const MAX_AUDIO_SIZE = 5 * 1024 * 1024;

/**
 * Base64 数据大小估算（Base64 编码后约为原始数据的 4/3 倍）
 */
function estimateAudioSize(base64Data: string): number {
  // 移除可能的 data URL 前缀
  const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
  // 估算原始大小
  return Math.ceil(cleanBase64.length * 3 / 4);
}

/**
 * 验证 Base64 格式
 */
function isValidBase64(str: string): boolean {
  const cleanStr = str.replace(/^data:[^;]+;base64,/, '');
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  return base64Regex.test(cleanStr);
}

/**
 * 映射语音错误类型到 HTTP 状态码和错误码
 */
function mapVoiceError(err: VoiceError): { httpStatus: number; errorCode: number; message: string } {
  switch (err.type) {
    case VoiceErrorType.CONFIG_MISSING:
    case VoiceErrorType.CONFIG_INVALID:
      return { httpStatus: 503, errorCode: ErrorCode.SERVICE_UNAVAILABLE, message: err.message };
    case VoiceErrorType.QUOTA_EXCEEDED:
      return { httpStatus: 429, errorCode: ErrorCode.RATE_LIMIT_EXCEEDED, message: err.message };
    case VoiceErrorType.NETWORK_ERROR:
      return { httpStatus: 503, errorCode: ErrorCode.SERVICE_UNAVAILABLE, message: err.message };
    case VoiceErrorType.AUDIO_INVALID:
      return { httpStatus: 400, errorCode: ErrorCode.BAD_REQUEST, message: err.message };
    case VoiceErrorType.RECOGNITION_FAILED:
      return { httpStatus: 422, errorCode: ErrorCode.BAD_REQUEST, message: err.message };
    default:
      return { httpStatus: 500, errorCode: ErrorCode.INTERNAL_ERROR, message: err.message };
  }
}

/**
 * 语音识别接口
 * POST /api/voice/recognize
 * Body: { audio: "base64编码的音频数据", format: "mp3|wav|pcm" }
 */
export const recognizeVoice = [
  authMiddleware,
  body('audio').isString().withMessage('请提供音频数据').notEmpty().withMessage('音频数据不能为空'),
  body('format').optional().isIn(['mp3', 'wav', 'pcm']).withMessage('不支持的音频格式，支持: mp3, wav, pcm'),

  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          code: 400,
          message: errors.array()[0].msg,
          data: null,
        });
        return;
      }

      const { audio, format = 'pcm' } = req.body;

      // 验证 Base64 格式
      if (!isValidBase64(audio)) {
        res.status(400).json({
          code: 400,
          message: '音频数据格式错误，请提供有效的 Base64 编码数据',
          data: null,
        });
        return;
      }

      // 验证音频大小
      const audioSize = estimateAudioSize(audio);
      if (audioSize > MAX_AUDIO_SIZE) {
        res.status(413).json({
          code: 413,
          message: `音频数据过大，最大支持 ${Math.floor(MAX_AUDIO_SIZE / 1024 / 1024)}MB`,
          data: null,
        });
        return;
      }

      // 调用语音识别服务
      const text = await voiceService.recognize(audio, format);

      success(res, { text, format, size: audioSize });
    } catch (err: any) {
      logger.error('语音识别请求失败:', { error: err.message, type: err.type });
      
      // 处理自定义语音错误
      if (err instanceof VoiceError) {
        const mapped = mapVoiceError(err);
        res.status(mapped.httpStatus).json({
          code: mapped.errorCode,
          message: mapped.message,
          data: { errorType: err.type },
        });
        return;
      }
      
      // 其他未知错误
      res.status(500).json({
        code: 500,
        message: '语音识别服务异常',
        data: null,
      });
    }
  },
];

/**
 * 测试语音识别配置接口
 * GET /api/voice/test-config
 */
export const testConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const configStatus = voiceService.getConfigStatus();
  
  const maskedConfig = {
    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID 
      ? `${process.env.ALIYUN_ACCESS_KEY_ID.substring(0, 8)}****` 
      : '未配置',
    accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET 
      ? '已配置（已隐藏）' 
      : '未配置',
    appKey: process.env.ALIYUN_NLS_APP_KEY 
      ? `${process.env.ALIYUN_NLS_APP_KEY.substring(0, 4)}****` 
      : '未配置',
    region: process.env.ALIYUN_NLS_REGION || 'cn-shanghai',
  };

  success(res, {
    configured: configStatus.configured,
    missingVariables: configStatus.missing,
    config: maskedConfig,
    message: configStatus.configured 
      ? '语音识别配置完整' 
      : `语音识别未完整配置，缺少: ${configStatus.missing.join(', ')}`,
  });
};

/**
 * 获取语音识别 Token
 * GET /api/voice/token
 */
export const getToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // 检查配置
    if (!voiceService.isConfigured()) {
      res.status(503).json({
        code: 503,
        message: '语音识别服务未配置',
        data: null,
      });
      return;
    }

    const token = await voiceService.getToken();
    
    success(res, {
      token,
      // 阿里云 Token 有效期 1 小时
      expiresIn: 3600,
      expireAt: Date.now() + 3600 * 1000,
    });
  } catch (err: any) {
    logger.error('获取 Token 失败:', { error: err.message });
    
    if (err instanceof VoiceError) {
      const mapped = mapVoiceError(err);
      res.status(mapped.httpStatus).json({
        code: mapped.errorCode,
        message: mapped.message,
        data: null,
      });
      return;
    }
    
    res.status(500).json({
      code: 500,
      message: '获取 Token 失败',
      data: null,
    });
  }
};

/**
 * 健康检查接口
 * GET /api/voice/health
 */
export const healthCheck = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const configStatus = voiceService.getConfigStatus();
  
  res.status(200).json({
    status: configStatus.configured ? 'healthy' : 'unconfigured',
    service: 'voice-recognition',
    configured: configStatus.configured,
    missing: configStatus.missing.length > 0 ? configStatus.missing : undefined,
    timestamp: new Date().toISOString(),
  });
};