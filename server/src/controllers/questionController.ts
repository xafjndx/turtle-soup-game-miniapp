import { Request, Response, NextFunction } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import questionService from '../services/questionService';
import aiService from '../services/aiService';
import { success, error, paginate, ErrorCode } from '../utils/response';
import { authMiddleware } from '../middlewares/auth';
import logger from '../utils/logger';

// 类型定义
type QuestionCategory = 'CLASSIC' | 'HORROR' | 'LOGIC' | 'WARM';
type QuestionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SOFT_DELETED' | 'HARD_DELETED';

// 获取题目分类列表
export const getCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = questionService.getCategories();
    success(res, categories);
  } catch (err) {
    next(err);
  }
};

// 抽取题目
export const drawQuestion = [
  authMiddleware,
  query('category').optional().isIn(['CLASSIC', 'HORROR', 'LOGIC', 'WARM']).withMessage('无效的分类'),

  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        error(res, ErrorCode.UNAUTHORIZED, '请先登录');
        return;
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        error(res, ErrorCode.BAD_REQUEST, errors.array()[0].msg);
        return;
      }

      const category = req.query.category as QuestionCategory | undefined;
      const question = await questionService.drawRandom(req.userId, category);

      if (!question) {
        error(res, ErrorCode.NO_AVAILABLE_QUESTION, '该分类暂无可用题目');
        return;
      }

      // 检查是否玩过
      const hasPlayed = await questionService.hasPlayed(req.userId, question.id);

      success(res, {
        question: {
          id: question.id,
          title: question.title,
          surface: question.surface,
          category: question.category,
          playCount: question.playCount,
        },
        hasPlayed,
      });
    } catch (err) {
      next(err);
    }
  },
];

// 获取题目详情（游戏结束后查看汤底）
export const getQuestionDetail = [
  authMiddleware,
  param('id').isString().withMessage('无效的题目ID'),

  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        error(res, ErrorCode.UNAUTHORIZED, '请先登录');
        return;
      }

      const { id } = req.params;
      const question = await questionService.findById(id);

      if (!question) {
        error(res, ErrorCode.QUESTION_NOT_FOUND, '题目不存在');
        return;
      }

      success(res, question);
    } catch (err) {
      next(err);
    }
  },
];

// 获取题目列表（管理员）
export const getList = [
  authMiddleware,
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('pageSize').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('category').optional().isIn(['CLASSIC', 'HORROR', 'LOGIC', 'WARM']),
  query('status').optional().isIn(['PENDING', 'APPROVED', 'REJECTED', 'SOFT_DELETED', 'HARD_DELETED']),
  query('keyword').optional().isString(),

  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        error(res, ErrorCode.BAD_REQUEST, errors.array()[0].msg);
        return;
      }

      const { page = 1, pageSize = 20, category, status, keyword } = req.query;

      const result = await questionService.getList({
        page: Number(page),
        pageSize: Number(pageSize),
        category: category as QuestionCategory,
        status: status as QuestionStatus,
        keyword: keyword as string,
      });

      paginate(res, result.list, result.total, result.page, result.pageSize);
    } catch (err) {
      next(err);
    }
  },
];

// 创建题目（管理员手动添加）
// 管理员手动添加的题目默认状态为 APPROVED，可直接上架
export const create = [
  authMiddleware,
  body('surface').notEmpty().withMessage('汤面不能为空'),
  body('bottom').notEmpty().withMessage('汤底不能为空'),
  body('hints').isArray({ min: 1 }).withMessage('至少需要一个提示'),
  body('keywords').isArray({ min: 1 }).withMessage('至少需要一个关键词'),

  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        error(res, ErrorCode.BAD_REQUEST, errors.array()[0].msg);
        return;
      }

      const { title, surface, bottom, category, hints, keywords } = req.body;

      // 创建题目，管理员手动添加的默认状态为 APPROVED
      const question = await questionService.create({
        title,
        surface,
        bottom,
        category: category as QuestionCategory,
        hints,
        keywords,
        source: 'PLATFORM', // 来源：平台预设/人工添加
      });

      // 管理员手动添加的题目默认上架
      await questionService.update(question.id, { status: 'APPROVED' });

      logger.info(`管理员手动添加题目: id=${question.id}, title=${title || '无标题'}`);

      success(res, question, '题目添加成功，已自动上架');
    } catch (err) {
      logger.error('创建题目失败:', err);
      next(err);
    }
  },
];

// 更新题目（管理员）
export const update = [
  authMiddleware,
  param('id').isString().withMessage('无效的题目ID'),

  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        error(res, ErrorCode.BAD_REQUEST, errors.array()[0].msg);
        return;
      }

      const { id } = req.params;
      const { title, surface, bottom, category, hints, keywords, status, quality } = req.body;

      const question = await questionService.update(id, {
        title,
        surface,
        bottom,
        category: category as QuestionCategory,
        hints,
        keywords,
        status: status as QuestionStatus,
        quality,
      });

      success(res, question, '题目更新成功');
    } catch (err) {
      next(err);
    }
  },
];

// 软删除题目（管理员）
export const softDelete = [
  authMiddleware,
  param('id').isString().withMessage('无效的题目ID'),

  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await questionService.softDelete(id);
      success(res, null, '题目已软删除');
    } catch (err) {
      next(err);
    }
  },
];

// 恢复软删除的题目（管理员）
export const restore = [
  authMiddleware,
  param('id').isString().withMessage('无效的题目ID'),

  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await questionService.restore(id);
      success(res, null, '题目已恢复');
    } catch (err) {
      next(err);
    }
  },
];

// 彻底删除题目（管理员）
export const hardDelete = [
  authMiddleware,
  param('id').isString().withMessage('无效的题目ID'),

  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await questionService.hardDelete(id);
      success(res, null, '题目已彻底删除');
    } catch (err) {
      next(err);
    }
  },
];

// AI 生成题目（管理员）
// 注意：AI 生成的题目默认状态为 PENDING，需要人工审核后才能上架
export const generateByAI = [
  authMiddleware,
  body('category').isIn(['CLASSIC', 'HORROR', 'LOGIC', 'WARM']).withMessage('无效的分类'),
  body('prompts').optional().isArray().withMessage('提示词必须是数组'),

  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        error(res, ErrorCode.BAD_REQUEST, errors.array()[0].msg);
        return;
      }

      const { category, prompts = [] } = req.body;

      logger.info(`AI 生成题目请求: 分类=${category}, 提示词=${prompts.join(',')}`);

      // 调用 AI 生成题目
      const generated = await aiService.generateQuestion(
        category as QuestionCategory,
        prompts
      );

      // 内容安全审核
      const moderation = await aiService.moderateContent(
        `${generated.surface} ${generated.bottom}`
      );

      if (!moderation.passed) {
        error(res, ErrorCode.BAD_REQUEST, `内容审核不通过: ${moderation.reason}`);
        return;
      }

      // 创建题目，默认状态为 PENDING（需要人工审核）
      const question = await questionService.create({
        surface: generated.surface,
        bottom: generated.bottom,
        category: category as QuestionCategory,
        hints: generated.hints,
        keywords: generated.keywords,
        source: 'AI_GENERATED',
        aiGeneratedBy: 'qwen3.5-plus',
      });

      // ⚠️ 重要：AI 生成的题目默认状态为 PENDING
      // 需要管理员在后台审核通过后才能被抽取
      await questionService.update(question.id, { status: 'PENDING' });

      logger.info(`AI 生成题目成功: id=${question.id}, 状态=PENDING（待审核）`);

      success(res, {
        question,
        message: '题目已生成，状态为待审核。请前往管理后台审核通过后才能上架。',
        status: 'PENDING',
        needReview: true,
      }, 'AI 生成题目成功，请审核后上架');
    } catch (err) {
      logger.error('AI 生成题目失败:', err);
      next(err);
    }
  },
];

// 用户投稿题目
// 投稿的题目默认状态为 PENDING，需要管理员审核后才能上架
export const submitQuestion = [
  authMiddleware,
  body('surface').notEmpty().withMessage('汤面不能为空'),
  body('bottom').notEmpty().withMessage('汤底不能为空'),
  body('category').isIn(['CLASSIC', 'HORROR', 'LOGIC', 'WARM']).withMessage('无效的分类'),
  body('hints').isArray({ min: 1 }).withMessage('至少需要一个提示'),
  body('keywords').isArray({ min: 1 }).withMessage('至少需要一个关键词'),

  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        error(res, ErrorCode.BAD_REQUEST, errors.array()[0].msg);
        return;
      }

      const { title, surface, bottom, category, hints, keywords } = req.body;

      logger.info(`用户投稿题目: userId=${req.userId}, title=${title || '无标题'}`);

      // 创建题目，来源为 USER_SUBMITTED（需要在 Prisma schema 中添加）
      // 暂时使用 PLATFORM 作为来源，状态设为 PENDING
      const question = await questionService.create({
        title,
        surface,
        bottom,
        category: category as QuestionCategory,
        hints,
        keywords,
        source: 'PLATFORM', // 用户投稿暂时标记为 PLATFORM
      });

      // ⚠️ 重要：用户投稿的题目默认状态为 PENDING
      // 需要管理员在后台审核通过后才能被抽取
      await questionService.update(question.id, { status: 'PENDING' });

      logger.info(`用户投稿成功: id=${question.id}, 状态=PENDING（待审核）`);

      success(res, {
        id: question.id,
        message: '投稿成功！您的题目已提交审核，审核通过后将自动加入题库。',
        status: 'PENDING',
      }, '投稿成功，请等待审核');
    } catch (err) {
      logger.error('用户投稿失败:', err);
      next(err);
    }
  },
];