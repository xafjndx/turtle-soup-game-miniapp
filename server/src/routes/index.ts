import { Router } from 'express';
import * as userController from '../controllers/userController';
import * as questionController from '../controllers/questionController';
import * as gameController from '../controllers/gameController';
import * as adminController from '../controllers/adminController';
import * as voiceController from '../controllers/voiceController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

// ==================== 用户相关路由 ====================

// 公开路由
router.post('/user/login', userController.login);
router.get('/user/list', userController.getUserList);
router.get('/leaderboard/top3', userController.getTop3);
router.get('/leaderboard', userController.getLeaderboard);

// 需要登录的路由
router.get('/user/profile', authMiddleware, userController.getProfile);
router.put('/user/profile', authMiddleware, userController.updateProfile);
router.get('/user/isAdmin', authMiddleware, userController.checkAdmin);
router.get('/user/export', authMiddleware, userController.exportUserData);  // 导出数据
router.delete('/user/delete', authMiddleware, userController.deleteAccount);  // 注销账号

// ==================== 题目相关路由 ====================

// 公开路由
router.get('/question/categories', questionController.getCategories);
router.get('/question/submit/leaderboard', questionController.getSubmitLeaderboard);  // 投稿排行榜

// 需要登录的路由
router.get('/question/draw', questionController.drawQuestion);
router.get('/question/:id', questionController.getQuestionDetail);
router.post('/question/submit', authMiddleware, questionController.submitQuestion);  // 用户投稿

// AI 生成题目（管理员）
router.post('/question/generate', authMiddleware, questionController.generateByAI);

// ==================== 游戏相关路由 ====================

// 需要登录的路由
router.post('/game/start', authMiddleware, gameController.startGame);
router.get('/game/session', authMiddleware, gameController.getCurrentSession);
router.post('/game/session/:sessionId/round', authMiddleware, gameController.submitRound);
router.post('/game/session/:sessionId/hint', authMiddleware, gameController.useHint);
router.post('/game/session/:sessionId/end', authMiddleware, gameController.endGame);
router.post('/game/session/:sessionId/save', authMiddleware, gameController.saveAIQuestion);
router.get('/game/history', authMiddleware, gameController.getHistory);

// ==================== 管理后台路由 ====================

// 管理员登录
router.post('/admin/login', adminController.adminLogin);

// 统计数据
router.get('/admin/statistics', authMiddleware, adminController.getStatistics);

// 用户管理
router.get('/admin/users', authMiddleware, adminController.getUsers);
router.put('/admin/user/:id', authMiddleware, adminController.updateUser);
router.delete('/admin/user/:id', authMiddleware, adminController.deleteUser);

// 题目管理
router.get('/admin/questions', authMiddleware, adminController.getQuestions);
router.post('/admin/question/create', authMiddleware, questionController.create);  // 新增：手动创建题目
router.put('/admin/question/:id', authMiddleware, questionController.update);  // 更新题目
router.put('/admin/question/:id/status', authMiddleware, adminController.updateQuestionStatus);
router.put('/admin/question/:id/category', authMiddleware, adminController.updateQuestionCategory);
router.put('/admin/question/:id/quality', authMiddleware, adminController.updateQuestionQuality);
router.put('/admin/question/:id', authMiddleware, adminController.updateQuestion);  // 更新题目内容
router.delete('/admin/question/:id', authMiddleware, adminController.deleteQuestion);  // 删除题目
router.post('/admin/questions/delete', authMiddleware, adminController.batchDeleteQuestions);
router.post('/admin/questions/restore', authMiddleware, adminController.restoreQuestions);

// 爬虫管理（已禁用，保留接口但返回禁用提示）
router.post('/admin/crawler/trigger', authMiddleware, adminController.triggerCrawler);

// 操作日志
router.get('/admin/logs', authMiddleware, adminController.getOperationLogs);

// AI 模型配置
router.get('/admin/ai-config', authMiddleware, adminController.getAIConfig);
router.put('/admin/ai-config', authMiddleware, adminController.updateAIConfig);
router.post('/admin/ai-config/test', authMiddleware, adminController.testAIConnection);

// ==================== 语音识别路由 ====================

// 语音识别（Base64 数据）
router.post('/voice/recognize', voiceController.recognizeVoice);
router.get('/voice/test-config', voiceController.testConfig);  // 测试配置接口
router.get('/voice/token', voiceController.getToken);  // 获取 Token 接口

export default router;