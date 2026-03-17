import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import prisma from '../utils/prisma';
import { success, error, paginate, ErrorCode } from '../utils/response';
import { authMiddleware } from '../middlewares/auth';
import crawlerService from '../services/crawlerService';

// 类型定义
type QuestionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SOFT_DELETED' | 'HARD_DELETED';
type QuestionCategory = 'CLASSIC' | 'HORROR' | 'LOGIC' | 'WARM';

// 管理员登录
export const adminLogin = [
  body('password').isString().withMessage('请输入管理员密码'),

  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        error(res, ErrorCode.BAD_REQUEST, errors.array()[0].msg);
        return;
      }

      const { password } = req.body;

      // 检查管理员是否存在
      const admin = await prisma.admin.findFirst();

      if (!admin) {
        // 如果没有管理员，创建一个（使用配置的密码）
        const config = require('../config').default;
        if (password !== config.admin.password) {
          error(res, ErrorCode.INVALID_PASSWORD, '密码错误');
          return;
        }

        // 创建管理员记录（关联第一个用户或创建系统管理员）
        const newAdmin = await prisma.admin.create({
          data: {
            userId: 'system',
            role: 'SUPER',
            permissions: ['ALL'],
          },
        });

        success(res, { message: '管理员初始化成功' });
        return;
      }

      // 验证密码
      const config = require('../config').default;
      if (password !== config.admin.password) {
        error(res, ErrorCode.INVALID_PASSWORD, '密码错误');
        return;
      }

      success(res, { message: '登录成功' });
    } catch (err) {
      next(err);
    }
  },
];

// 获取统计数据
export const getStatistics = [
  authMiddleware,

  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 用户统计
      const userCount = await prisma.user.count();
      const activeUserCount = await prisma.user.count({
        where: {
          lastPlayedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 最近7天活跃
          },
        },
      });

      // 题目统计
      const questionCount = await prisma.question.count({
        where: { status: 'APPROVED' },
      });
      const pendingCount = await prisma.question.count({
        where: { status: 'PENDING' },
      });
      const softDeletedCount = await prisma.question.count({
        where: { status: 'SOFT_DELETED' },
      });

      // 游戏统计
      const totalGames = await prisma.gameHistory.count();
      const todayGames = await prisma.gameHistory.count({
        where: {
          playedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      });
      const winCount = await prisma.gameHistory.count({
        where: { result: 'WIN' },
      });

      // 按分类统计题目
      const categoryStats = await prisma.question.groupBy({
        by: ['category'],
        where: { status: 'APPROVED' },
        _count: true,
      });

      // 按来源统计题目
      const sourceStats = await prisma.question.groupBy({
        by: ['source'],
        where: { status: QuestionStatus.APPROVED },
        _count: true,
      });

      success(res, {
        users: {
          total: userCount,
          active: activeUserCount,
        },
        questions: {
          total: questionCount,
          pending: pendingCount,
          softDeleted: softDeletedCount,
          byCategory: categoryStats.reduce((acc, item) => {
            acc[item.category] = item._count;
            return acc;
          }, {} as Record<string, number>),
          bySource: sourceStats.reduce((acc, item) => {
            acc[item.source] = item._count;
            return acc;
          }, {} as Record<string, number>),
        },
        games: {
          total: totalGames,
          today: todayGames,
          winRate: totalGames > 0 ? ((winCount / totalGames) * 100).toFixed(1) : 0,
        },
      });
    } catch (err) {
      next(err);
    }
  },
];

// 获取题目列表（管理后台）
export const getQuestions = [
  authMiddleware,
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('pageSize').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('category').optional().isIn(['CLASSIC', 'HORROR', 'LOGIC', 'WARM']),
  query('status').optional().isIn(['PENDING', 'APPROVED', 'REJECTED', 'SOFT_DELETED', 'HARD_DELETED']),
  query('source').optional().isString(),
  query('keyword').optional().isString(),

  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        error(res, ErrorCode.BAD_REQUEST, errors.array()[0].msg);
        return;
      }

      const { page = 1, pageSize = 20, category, status, source, keyword } = req.query;

      const where: any = {};
      if (category) where.category = category;
      if (status) where.status = status;
      if (source) where.source = source;
      if (keyword) {
        where.OR = [
          { title: { contains: keyword as string } },
          { surface: { contains: keyword as string } },
        ];
      }

      const [list, total] = await Promise.all([
        prisma.question.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (Number(page) - 1) * Number(pageSize),
          take: Number(pageSize),
        }),
        prisma.question.count({ where }),
      ]);

      paginate(res, list, total, Number(page), Number(pageSize));
    } catch (err) {
      next(err);
    }
  },
];

// 更新题目状态
export const updateQuestionStatus = [
  authMiddleware,
  param('id').isString().withMessage('无效的题目ID'),
  body('status').isIn(['PENDING', 'APPROVED', 'REJECTED', 'SOFT_DELETED', 'HARD_DELETED']).withMessage('无效的状态'),

  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        error(res, ErrorCode.BAD_REQUEST, errors.array()[0].msg);
        return;
      }

      const { id } = req.params;
      const { status } = req.body;

      const updateData: any = { status };
      if (status === 'SOFT_DELETED') {
        updateData.softDeletedAt = new Date();
      } else if (status === 'APPROVED') {
        updateData.softDeletedAt = null;
      }

      const question = await prisma.question.update({
        where: { id },
        data: updateData,
      });

      // 记录操作日志
      await logOperation(req.userId!, 'UPDATE_STATUS', id, { status });

      success(res, question, '状态更新成功');
    } catch (err) {
      next(err);
    }
  },
];

// 更新题目分类
export const updateQuestionCategory = [
  authMiddleware,
  param('id').isString().withMessage('无效的题目ID'),
  body('category').isIn(['CLASSIC', 'HORROR', 'LOGIC', 'WARM']).withMessage('无效的分类'),

  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        error(res, ErrorCode.BAD_REQUEST, errors.array()[0].msg);
        return;
      }

      const { id } = req.params;
      const { category } = req.body;

      const question = await prisma.question.update({
        where: { id },
        data: { category },
      });

      // 记录操作日志
      await logOperation(req.userId!, 'UPDATE_CATEGORY', id, { category });

      success(res, question, '分类更新成功');
    } catch (err) {
      next(err);
    }
  },
];

// 更新题目质量评分
export const updateQuestionQuality = [
  authMiddleware,
  param('id').isString().withMessage('无效的题目ID'),
  body('quality').isInt({ min: 1, max: 5 }).withMessage('评分范围1-5'),

  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        error(res, ErrorCode.BAD_REQUEST, errors.array()[0].msg);
        return;
      }

      const { id } = req.params;
      const { quality } = req.body;

      const question = await prisma.question.update({
        where: { id },
        data: { quality },
      });

      // 记录操作日志
      await logOperation(req.userId!, 'UPDATE_QUALITY', id, { quality });

      success(res, question, '评分更新成功');
    } catch (err) {
      next(err);
    }
  },
];

// 批量删除题目
export const batchDeleteQuestions = [
  authMiddleware,
  body('ids').isArray({ min: 1 }).withMessage('请选择要删除的题目'),
  body('hard').optional().isBoolean().withMessage('无效的删除类型'),

  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        error(res, ErrorCode.BAD_REQUEST, errors.array()[0].msg);
        return;
      }

      const { ids, hard = false } = req.body;

      if (hard) {
        // 彻底删除
        await prisma.question.updateMany({
          where: { id: { in: ids } },
          data: {
            status: QuestionStatus.HARD_DELETED,
          },
        });
      } else {
        // 软删除
        await prisma.question.updateMany({
          where: { id: { in: ids } },
          data: {
            status: QuestionStatus.SOFT_DELETED,
            softDeletedAt: new Date(),
          },
        });
      }

      // 记录操作日志
      await logOperation(req.userId!, 'BATCH_DELETE', undefined, { ids, hard });

      success(res, { count: ids.length }, `已${hard ? '彻底' : '软'}删除 ${ids.length} 个题目`);
    } catch (err) {
      next(err);
    }
  },
];

// 恢复软删除的题目
export const restoreQuestions = [
  authMiddleware,
  body('ids').isArray({ min: 1 }).withMessage('请选择要恢复的题目'),

  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        error(res, ErrorCode.BAD_REQUEST, errors.array()[0].msg);
        return;
      }

      const { ids } = req.body;

      await prisma.question.updateMany({
        where: { id: { in: ids } },
        data: {
          status: QuestionStatus.APPROVED,
          softDeletedAt: null,
        },
      });

      // 记录操作日志
      await logOperation(req.userId!, 'RESTORE', undefined, { ids });

      success(res, { count: ids.length }, `已恢复 ${ids.length} 个题目`);
    } catch (err) {
      next(err);
    }
  },
];

// 手动触发爬虫
export const triggerCrawler = [
  authMiddleware,

  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 异步执行爬虫
      crawlerService.runCrawler().catch(err => {
        console.error('爬虫执行失败:', err);
      });

      success(res, { message: '爬虫任务已启动' });
    } catch (err) {
      next(err);
    }
  },
];

// 获取操作日志
export const getOperationLogs = [
  authMiddleware,
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('pageSize').optional().isInt({ min: 1, max: 100 }).toInt(),

  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = 1, pageSize = 20 } = req.query;

      const [list, total] = await Promise.all([
        prisma.operationLog.findMany({
          orderBy: { createdAt: 'desc' },
          skip: (Number(page) - 1) * Number(pageSize),
          take: Number(pageSize),
        }),
        prisma.operationLog.count(),
      ]);

      paginate(res, list, total, Number(page), Number(pageSize));
    } catch (err) {
      next(err);
    }
  },
];

// 辅助函数：记录操作日志
async function logOperation(
  adminId: string,
  action: string,
  target?: string,
  detail?: any
) {
  try {
    await prisma.operationLog.create({
      data: {
        adminId,
        action,
        target,
        detail,
      },
    });
  } catch (err) {
    console.error('记录操作日志失败:', err);
  }
}