// services/voiceService.ts - 阿里云语音识别服务
import axios from 'axios';
import crypto from 'crypto';
import logger from '../utils/logger';

// 阿里云语音识别配置
const ALIYUN_NLS_CONFIG = {
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET || '',
  appKey: process.env.ALIYUN_NLS_APP_KEY || '9VjrIoolPvwUSKyX',
  // 一句话识别 API 地址
  url: 'https://nls-gateway.cn-shanghai.aliyuncs.com/stream/v1/asr',
};

class VoiceService {
  /**
   * 一句话语音识别
   * @param audioData 音频文件的 Base64 数据
   * @param format 音频格式 (pcm, wav, mp3)
   * @returns 识别出的文字
   */
  async recognize(audioData: string, format: string = 'mp3'): Promise<string> {
    // 检查配置
    if (!ALIYUN_NLS_CONFIG.accessKeyId || !ALIYUN_NLS_CONFIG.accessKeySecret) {
      logger.warn('阿里云语音识别未配置，请设置环境变量 ALIYUN_ACCESS_KEY_ID 和 ALIYUN_ACCESS_KEY_SECRET');
      throw new Error('语音识别服务未配置');
    }

    try {
      // 获取 token
      const token = await this.getToken();
      
      logger.info('调用语音识别 API:', { 
        appKey: ALIYUN_NLS_CONFIG.appKey,
        format,
        audioLength: audioData.length 
      });
      
      // 调用一句话识别 API
      const response = await axios.post(
        `${ALIYUN_NLS_CONFIG.url}?appkey=${ALIYUN_NLS_CONFIG.appKey}&token=${token}&format=${format}&sample_rate=16000&enable_punctuation_prediction=true&enable_inverse_text_normalization=true`,
        Buffer.from(audioData, 'base64'),
        {
          headers: {
            'Content-Type': 'application/octet-stream',
          },
          timeout: 15000,
        }
      );

      logger.info('语音识别响应:', response.data);

      if (response.data.status === 20000000) {
        return response.data.result || '';
      } else {
        logger.error('语音识别失败:', response.data);
        throw new Error(response.data.message || '语音识别失败');
      }
    } catch (error: any) {
      logger.error('语音识别调用失败:', {
        error: error.message,
        response: error.response?.data,
      });
      
      // 检查是否是配额不足
      if (error.response?.data?.status === 40000001) {
        throw new Error('语音识别配额已用完');
      }
      
      throw new Error('语音识别失败');
    }
  }

  /**
   * 获取临时 Token（公开方法）
   */
  async getToken(): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      const nonce = Math.random().toString(36).substring(2);
      
      // 构造签名字符串
      const params = `AccessKeyId=${ALIYUN_NLS_CONFIG.accessKeyId}&Action=CreateToken&Format=JSON&RegionId=cn-shanghai&SignatureMethod=HMAC-SHA1&SignatureNonce=${nonce}&SignatureVersion=1.0&Timestamp=${encodeURIComponent(timestamp)}&Version=2019-02-28`;
      const stringToSign = `GET&%2F&${encodeURIComponent(params)}`;
      
      // 计算 HMAC-SHA1 签名
      const signature = crypto
        .createHmac('sha1', `${ALIYUN_NLS_CONFIG.accessKeySecret}&`)
        .update(stringToSign)
        .digest('base64');
      
      // 调用阿里云 Token API
      const response = await axios.get('https://nls-meta.cn-shanghai.aliyuncs.com/pop/2019-02-28/CreateToken', {
        params: {
          AccessKeyId: ALIYUN_NLS_CONFIG.accessKeyId,
          Action: 'CreateToken',
          Format: 'JSON',
          RegionId: 'cn-shanghai',
          SignatureMethod: 'HMAC-SHA1',
          SignatureNonce: nonce,
          SignatureVersion: '1.0',
          Timestamp: timestamp,
          Version: '2019-02-28',
          Signature: signature,
        },
      });
      
      logger.info('获取 Token 响应:', response.data);
      
      if (response.data.Token?.Id) {
        return response.data.Token.Id;
      }
      throw new Error('获取 Token 失败');
    } catch (error) {
      logger.error('获取语音识别 Token 失败:', error);
      throw new Error('语音识别服务暂时不可用');
    }
  }
}

export default new VoiceService();