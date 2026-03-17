import winston from 'winston';
import config from '../config';

const { combine, timestamp, printf, colorize } = winston.format;

// 自定义日志格式
const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let log = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0) {
    log += ` ${JSON.stringify(metadata)}`;
  }
  return log;
});

// 创建 logger 实例
const logger = winston.createLogger({
  level: config.log.level,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    // 控制台输出
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
      ),
    }),
    // 错误日志文件
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    // 全部日志文件
    new winston.transports.File({
      filename: 'logs/combined.log',
    }),
  ],
});

// 生产环境不输出到控制台
if (config.server.nodeEnv === 'production') {
  logger.remove(logger.transports[0]);
}

export default logger;