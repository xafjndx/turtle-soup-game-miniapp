import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  // 服务器配置
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  // 数据库配置
  database: {
    url: process.env.DATABASE_URL || '',
  },

  // JWT 配置
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-me',
    expiresIn: '7d',
  },

  // 微信小程序配置
  wechat: {
    appId: process.env.WECHAT_APPID || '',
    secret: process.env.WECHAT_SECRET || '',
  },

  // 阿里百炼 AI 配置
  ai: {
    apiKey: process.env.ALIBABA_DASHSCOPE_API_KEY || '',
    model: process.env.QWEN_MODEL || 'qwen3.5-plus',
    baseUrl: process.env.ALIBABA_DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/api/v1',
  },

  // 管理员配置
  admin: {
    password: process.env.ADMIN_PASSWORD || 'admin123',
  },

  // 爬虫配置
  crawler: {
    enabled: process.env.CRAWLER_ENABLED === 'true',
    cron: process.env.CRAWLER_CRON || '0 4 * * *',
  },

  // 游戏配置
  game: {
    maxHints: 3, // 每局最多提示次数
    hitThreshold: 85, // 命中判定阈值（重合率 >= 85%）
    maxAudioDuration: 60, // 最长录音时长（秒）
    maxInputLength: 200, // 最大文字输入长度
  },

  // 日志配置
  log: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

export default config;