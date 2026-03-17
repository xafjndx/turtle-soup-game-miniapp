import { Request, Response, NextFunction } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import questionService from '../services/questionService';
import { success, error, paginate, ErrorCode } from '../utils/response';
import { authMiddleware } from '../middlewares/auth';

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

// 创建题目（管理员）
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

      const question = await questionService.create({
        title,
        surface,
        bottom,
        category: category as QuestionCategory,
        hints,
        keywords,
        source: 'PLATFORM',
      });

      success(res, question, '题目创建成功');
    } catch (err) {
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