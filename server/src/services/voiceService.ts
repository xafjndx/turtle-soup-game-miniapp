// services/voiceService.ts - 阿里云语音识别服务
import axios from 'axios';
import crypto from 'crypto';
import logger from '../utils/logger';

/**
 * 阿里云语音识别配置接口
 */
interface AliyunNlsConfig {
  accessKeyId: string;
  accessKeySecret: string;
  appKey: string;
  region: string;
}

/**
 * Token 缓存结构
 */
interface TokenCache {
  token: string;
  expireAt: number; // 过期时间戳
}

/**
 * 错误类型枚举
 */
export enum VoiceErrorType {
  CONFIG_MISSING = 'CONFIG_MISSING',       // 配置缺失
  CONFIG_INVALID = 'CONFIG_INVALID',       // 配置无效
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',       // 配额不足
  NETWORK_ERROR = 'NETWORK_ERROR',         // 网络错误
  RECOGNITION_FAILED = 'RECOGNITION_FAILED', // 识别失败
  AUDIO_INVALID = 'AUDIO_INVALID',         // 音频无效
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE', // 服务不可用
}

/**
 * 自定义语音识别错误
 */
export class VoiceError extends Error {
  type: VoiceErrorType;
  constructor(type: VoiceErrorType, message: string) {
    super(message);
    this.type = type;
    this.name = 'VoiceError';
  }
}

/**
 * 验证配置是否完整
 */
function validateConfig(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  
  if (!process.env.ALIYUN_ACCESS_KEY_ID) {
    missing.push('ALIYUN_ACCESS_KEY_ID');
  }
  if (!process.env.ALIYUN_ACCESS_KEY_SECRET) {
    missing.push('ALIYUN_ACCESS_KEY_SECRET');
  }
  if (!process.env.ALIYUN_NLS_APP_KEY) {
    missing.push('ALIYUN_NLS_APP_KEY');
  }
  
  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * 获取阿里云 NLS 配置
 * 注意：不再提供默认值，必须通过环境变量配置
 */
function getAliyunConfig(): AliyunNlsConfig {
  return {
    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET || '',
    appKey: process.env.ALIYUN_NLS_APP_KEY || '',
    region: process.env.ALIYUN_NLS_REGION || 'cn-shanghai',
  };
}

class VoiceService {
  private tokenCache: TokenCache | null = null;
  private static readonly TOKEN_EXPIRE_BUFFER = 5 * 60 * 1000; // 5分钟缓冲

  /**
   * 检查服务是否可用
   */
  isConfigured(): boolean {
    const validation = validateConfig();
    return validation.valid;
  }

  /**
   * 获取配置状态
   */
  getConfigStatus(): { configured: boolean; missing: string[] } {
    const validation = validateConfig();
    return {
      configured: validation.valid,
      missing: validation.missing,
    };
  }

  /**
   * 获取临时 Token（带缓存）
   * 阿里云 Token 有效期为 3600 秒（1小时）
   */
  async getToken(): Promise<string> {
    const config = getAliyunConfig();
    
    // 检查配置
    if (!config.accessKeyId || !config.accessKeySecret || !config.appKey) {
      throw new VoiceError(
        VoiceErrorType.CONFIG_MISSING,
        '语音识别服务未配置，请设置环境变量 ALIYUN_ACCESS_KEY_ID、ALIYUN_ACCESS_KEY_SECRET、ALIYUN_NLS_APP_KEY'
      );
    }

    // 检查缓存的 Token 是否有效
    if (this.tokenCache && this.tokenCache.expireAt > Date.now() + VoiceService.TOKEN_EXPIRE_BUFFER) {
      logger.debug('使用缓存的语音识别 Token');
      return this.tokenCache.token;
    }

    try {
      const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      const nonce = Math.random().toString(36).substring(2);
      
      // 构造签名字符串
      const params = `AccessKeyId=${config.accessKeyId}&Action=CreateToken&Format=JSON&RegionId=${config.region}&SignatureMethod=HMAC-SHA1&SignatureNonce=${nonce}&SignatureVersion=1.0&Timestamp=${encodeURIComponent(timestamp)}&Version=2019-02-28`;
      const stringToSign = `GET&%2F&${encodeURIComponent(params)}`;
      
      // 计算 HMAC-SHA1 签名
      const signature = crypto
        .createHmac('sha1', `${config.accessKeySecret}&`)
        .update(stringToSign)
        .digest('base64');
      
      const tokenUrl = `https://nls-meta.${config.region}.aliyuncs.com/pop/2019-02-28/CreateToken`;
      
      const response = await axios.get(tokenUrl, {
        params: {
          AccessKeyId: config.accessKeyId,
          Action: 'CreateToken',
          Format: 'JSON',
          RegionId: config.region,
          SignatureMethod: 'HMAC-SHA1',
          SignatureNonce: nonce,
          SignatureVersion: '1.0',
          Timestamp: timestamp,
          Version: '2019-02-28',
          Signature: signature,
        },
        timeout: 10000,
      });
      
      if (response.data.Token?.Id && response.data.Token?.ExpireTime) {
        // 缓存 Token，阿里云 Token 有效期 3600 秒
        const expireTime = response.data.Token.ExpireTime * 1000; // 转换为毫秒
        this.tokenCache = {
          token: response.data.Token.Id,
          expireAt: expireTime,
        };
        
        logger.info('语音识别 Token 获取成功', { 
          expiresIn: Math.floor((expireTime - Date.now()) / 1000) + '秒'
        });
        
        return this.tokenCache.token;
      }
      
      throw new VoiceError(VoiceErrorType.SERVICE_UNAVAILABLE, '获取 Token 响应格式错误');
    } catch (error: any) {
      if (error instanceof VoiceError) {
        throw error;
      }
      
      logger.error('获取语音识别 Token 失败:', {
        message: error.message,
        response: error.response?.data,
      });
      
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw new VoiceError(VoiceErrorType.NETWORK_ERROR, '网络连接失败');
      }
      
      throw new VoiceError(VoiceErrorType.SERVICE_UNAVAILABLE, '语音识别服务暂时不可用');
    }
  }

  /**
   * 一句话语音识别
   * @param audioData 音频文件的 Base64 数据
   * @param format 音频格式 (pcm, wav, mp3) - 推荐 pcm
   * @returns 识别出的文字
   */
  async recognize(audioData: string, format: string = 'pcm'): Promise<string> {
    const config = getAliyunConfig();
    
    // 检查配置
    if (!config.accessKeyId || !config.accessKeySecret || !config.appKey) {
      throw new VoiceError(
        VoiceErrorType.CONFIG_MISSING,
        '语音识别服务未配置'
      );
    }

    // 验证音频数据
    if (!audioData || audioData.length === 0) {
      throw new VoiceError(VoiceErrorType.AUDIO_INVALID, '音频数据为空');
    }

    // 验证音频格式
    const supportedFormats = ['pcm', 'wav', 'mp3'];
    if (!supportedFormats.includes(format.toLowerCase())) {
      throw new VoiceError(VoiceErrorType.AUDIO_INVALID, `不支持的音频格式: ${format}，支持: ${supportedFormats.join(', ')}`);
    }

    try {
      // 获取 token
      const token = await this.getToken();
      
      logger.info('调用语音识别 API:', { 
        appKey: config.appKey.substring(0, 4) + '****',
        format,
        audioLength: audioData.length 
      });
      
      // 构建请求 URL
      const asrUrl = `https://nls-gateway.${config.region}.aliyuncs.com/stream/v1/asr`;
      const requestUrl = `${asrUrl}?appkey=${config.appKey}&token=${token}&format=${format}&sample_rate=16000&enable_punctuation_prediction=true&enable_inverse_text_normalization=true`;
      
      // 调用一句话识别 API
      const response = await axios.post(
        requestUrl,
        Buffer.from(audioData, 'base64'),
        {
          headers: {
            'Content-Type': 'application/octet-stream',
          },
          timeout: 15000,
        }
      );

      logger.info('语音识别响应:', { status: response.data.status, result: response.data.result });

      // 阿里云成功状态码
      if (response.data.status === 20000000) {
        return response.data.result || '';
      }
      
      // 处理特定错误码
      const errorStatus = response.data.status;
      let errorMessage = response.data.message || '语音识别失败';
      let errorType = VoiceErrorType.RECOGNITION_FAILED;
      
      if (errorStatus === 40000001) {
        errorType = VoiceErrorType.QUOTA_EXCEEDED;
        errorMessage = '语音识别配额已用完';
      } else if (errorStatus === 40000002) {
        errorType = VoiceErrorType.AUDIO_INVALID;
        errorMessage = '音频格式不正确';
      }
      
      throw new VoiceError(errorType, errorMessage);
    } catch (error: any) {
      if (error instanceof VoiceError) {
        throw error;
      }
      
      logger.error('语音识别调用失败:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
      });
      
      // 网络错误
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw new VoiceError(VoiceErrorType.NETWORK_ERROR, '网络连接失败');
      }
      
      throw new VoiceError(VoiceErrorType.RECOGNITION_FAILED, '语音识别失败');
    }
  }
}

// 服务启动时检查配置
const configStatus = validateConfig();
if (!configStatus.valid) {
  logger.warn(`语音识别服务配置不完整，缺少环境变量: ${configStatus.missing.join(', ')}`);
} else {
  logger.info('语音识别服务配置完整');
}

export default new VoiceService();
export { validateConfig };