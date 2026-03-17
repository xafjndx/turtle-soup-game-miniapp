import { Router } from 'express';
import * as userController from '../controllers/userController';
import * as questionController from '../controllers/questionController';
import * as gameController from '../controllers/gameController';
import * as adminController from '../controllers/adminController';
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

// ==================== 题目相关路由 ====================

// 公开路由
router.get('/question/categories', questionController.getCategories);

// 需要登录的路由
router.get('/question/draw', questionController.drawQuestion);
router.get('/question/:id', questionController.getQuestionDetail);

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

// 题目管理
router.get('/admin/questions', authMiddleware, adminController.getQuestions);
router.put('/admin/question/:id/status', authMiddleware, adminController.updateQuestionStatus);
router.put('/admin/question/:id/category', authMiddleware, adminController.updateQuestionCategory);
router.put('/admin/question/:id/quality', authMiddleware, adminController.updateQuestionQuality);
router.post('/admin/questions/delete', authMiddleware, adminController.batchDeleteQuestions);
router.post('/admin/questions/restore', authMiddleware, adminController.restoreQuestions);

// 爬虫管理
router.post('/admin/crawler/trigger', authMiddleware, adminController.triggerCrawler);

// 操作日志
router.get('/admin/logs', authMiddleware, adminController.getOperationLogs);

export default router;