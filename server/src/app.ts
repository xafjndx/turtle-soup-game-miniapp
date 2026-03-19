import express from 'express';
import cors from 'cors';
import config from './config';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import logger from './utils/logger';
import crawlerService from './services/crawlerService';

const app = express();

// ==================== 中间件配置 ====================

// CORS 配置
app.use(cors({
  origin: true, // 允许所有来源（生产环境需要配置具体域名）
  credentials: true,
}));

// JSON 解析
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 请求日志
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    query: req.query,
    body: req.body,
  });
  next();
});

// ==================== 路由配置 ====================

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    environment: config.server.nodeEnv,
    version: 'v6dc8b43',  // 当前部署版本
    buildTime: '2026-03-19 23:15',
  });
});

// API 路由
app.use('/api', routes);

// 404 处理
app.use(notFoundHandler);

// 错误处理
app.use(errorHandler);

// ==================== 启动定时任务 ====================

if (config.crawler.enabled) {
  crawlerService.startScheduler();
}

// ==================== 启动服务器 ====================

const PORT = config.server.port;

app.listen(PORT, () => {
  logger.info(`🚀 服务器启动成功`);
  logger.info(`📝 环境: ${config.server.nodeEnv}`);
  logger.info(`🌐 端口: ${PORT}`);
  logger.info(`🔗 健康检查: http://localhost:${PORT}/health`);
});

export default app;