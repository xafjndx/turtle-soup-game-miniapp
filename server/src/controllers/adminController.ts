import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import prisma from '../utils/prisma';
import { success, error, paginate, ErrorCode } from '../utils/response';
import { authMiddleware } from '../middlewares/auth';
import crawlerService from '../services/crawlerService';
import config from '../config';

// 类型定义
type QuestionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SOFT_DELETED' | 'HARD_DELETED';
type QuestionCategory = 'CLASSIC' | 'HORROR' | 'LOGIC' | 'WARM';

// 状态常量
const QuestionStatusValues = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SOFT_DELETED: 'SOFT_DELETED',
  HARD_DELETED: 'HARD_DELETED',
} as const;

// ==================== AI 模型配置管理 ====================

// 获取 AI 配置
export const getAIConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 从数据库获取配置，如果没有则返回默认配置
    const dbConfig = await prisma.systemConfig.findUnique({
      where: { key: 'ai_config' },
    });

    const defaultConfig = {
      provider: 'alibaba',  // alibaba, openai, custom
      model: config.ai.model,
      apiKey: '',  // 不返回完整密钥
      apiKeyMasked: config.ai.apiKey ? config.ai.apiKey.slice(0, 8) + '****' + config.ai.apiKey.slice(-4) : '',
      baseUrl: config.ai.baseUrl,
      enabled: !!config.ai.apiKey,
    };

    const aiConfig = dbConfig ? JSON.parse(dbConfig.value) : defaultConfig;

    success(res, {
      provider: aiConfig.provider || 'alibaba',
      model: aiConfig.model || config.ai.model,
      apiKeyMasked: aiConfig.apiKey ? aiConfig.apiKey.slice(0, 8) + '****' + aiConfig.apiKey.slice(-4) : '',
      baseUrl: aiConfig.baseUrl || config.ai.baseUrl,
      enabled: !!aiConfig.apiKey,
      supportedProviders: [
        { id: 'alibaba', name: '阿里百炼', models: ['qwen3.5-plus', 'qwen3.5-turbo', 'qwen-max'] },
        { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'] },
        { id: 'deepseek', name: 'DeepSeek', models: ['deepseek-chat', 'deepseek-coder'] },
        { id: 'custom', name: '自定义', models: [] },
      ],
    });
  } catch (err) {
    next(err);
  }
};

// 更新 AI 配置
export const updateAIConfig = [
  body('provider').isIn(['alibaba', 'openai', 'deepseek', 'custom']).withMessage('无效的AI提供商'),
  body('model').isString().withMessage('请选择模型'),
  body('apiKey').optional().isString(),
  body('baseUrl').optional().isString(),

  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        error(res, ErrorCode.BAD_REQUEST, errors.array()[0].msg);
        return;
      }

      const { provider, model, apiKey, baseUrl } = req.body;

      // 获取现有配置
      const existingConfig = await prisma.systemConfig.findUnique({
        where: { key: 'ai_config' },
      });

      const oldConfig = existingConfig ? JSON.parse(existingConfig.value) : {};

      // 更新配置（如果未提供新的apiKey，保留旧的）
      const newConfig = {
        provider,
        model,
        apiKey: apiKey || oldConfig.apiKey || config.ai.apiKey,
        baseUrl: baseUrl || oldConfig.baseUrl || config.ai.baseUrl,
        updatedAt: new Date().toISOString(),
      };

      // 保存到数据库
      await prisma.systemConfig.upsert({
        where: { key: 'ai_config' },
        create: {
          key: 'ai_config',
          value: JSON.stringify(newConfig),
        },
        update: {
          value: JSON.stringify(newConfig),
        },
      });

      // 记录操作日志
      await prisma.operationLog.create({
        data: {
          action: 'UPDATE_AI_CONFIG',
          target: 'ai_config',
          detail: JSON.stringify({ provider, model, updatedApiKey: !!apiKey }),
        },
      });

      success(res, {
        message: 'AI配置已更新',
        provider,
        model,
        apiKeyMasked: newConfig.apiKey ? newConfig.apiKey.slice(0, 8) + '****' + newConfig.apiKey.slice(-4) : '',
      }, '配置保存成功，重启服务后生效');
    } catch (err) {
      next(err);
    }
  },
];

// 测试 AI 连接
export const testAIConnection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dbConfig = await prisma.systemConfig.findUnique({
      where: { key: 'ai_config' },
    });

    const aiConfig = dbConfig ? JSON.parse(dbConfig.value) : {
      apiKey: config.ai.apiKey,
      model: config.ai.model,
      baseUrl: config.ai.baseUrl,
    };

    if (!aiConfig.apiKey) {
      error(res, ErrorCode.BAD_REQUEST, '请先配置AI API密钥');
      return;
    }

    // 发送测试请求
    const axios = require('axios');
    const testResponse = await axios.post(
      aiConfig.baseUrl || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
      {
        model: aiConfig.model || 'qwen3.5-plus',
        input: {
          messages: [{ role: 'user', content: '你好，请回复"测试成功"' }],
        },
        parameters: { result_format: 'message' },
      },
      {
        headers: {
          'Authorization': `Bearer ${aiConfig.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    success(res, {
      success: true,
      message: 'AI连接测试成功',
      model: aiConfig.model,
      response: testResponse.data.output?.choices?.[0]?.message?.content?.slice(0, 50) || '响应正常',
    });
  } catch (err: any) {
    success(res, {
      success: false,
      message: `连接失败: ${err.message}`,
      error: err.response?.data?.message || err.message,
    });
  }
};

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

        // 获取第一个用户作为管理员，如果没有用户则创建一个系统用户
        let firstUser = await prisma.user.findFirst();
        if (!firstUser) {
          firstUser = await prisma.user.create({
            data: {
              username: 'admin',
            },
          });
        }

        // 创建管理员记录
        const newAdmin = await prisma.admin.create({
          data: {
            userId: firstUser.id,
            role: 'SUPER',
            permissions: JSON.stringify(['ALL']),
          },
        });

        success(res, { 
          message: '管理员初始化成功',
          adminId: newAdmin.id,
          userId: firstUser.id,
        });
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
        where: { status: 'APPROVED' },
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
            status: 'HARD_DELETED',
          },
        });
      } else {
        // 软删除
        await prisma.question.updateMany({
          where: { id: { in: ids } },
          data: {
            status: 'SOFT_DELETED',
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
          status: 'APPROVED',
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

// 手动触发爬虫（已禁用）
export const triggerCrawler = [
  authMiddleware,

  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await crawlerService.runCrawler();
      
      // 记录操作日志
      await logOperation(req.userId!, 'TRIGGER_CRAWLER', undefined, { 
        result,
        note: '爬虫功能已禁用' 
      });

      success(res, result, '爬虫功能已禁用，请使用其他方式添加题目');
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