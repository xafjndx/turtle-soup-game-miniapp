import { Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import gameService from '../services/gameService';
import questionService from '../services/questionService';
import aiService from '../services/aiService';
import { success, error, ErrorCode } from '../utils/response';
import { authMiddleware } from '../middlewares/auth';
import config from '../config';

// 类型定义
type GameResult = 'WIN' | 'LOSE' | 'QUIT';
type InputMode = 'VOICE' | 'TEXT';
type QuestionSourceChoice = 'BANK' | 'AI_GENERATED';
type RoundAction = 'ASK' | 'GUESS' | 'HINT' | 'QUIT';

// 开始新游戏（从题库抽取）
export const startGame = [
  authMiddleware,
  body('questionId').optional().isString(),
  body('category').optional().isString(),
  body('source').isIn(['BANK', 'AI_GENERATED']).withMessage('无效的题目来源'),

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

      const { questionId, category, source } = req.body;

      // 检查是否有进行中的会话
      const currentSession = await gameService.getCurrentSession(req.userId);
      if (currentSession) {
        success(res, { session: currentSession, message: '您有未完成的游戏' });
        return;
      }

      let question;
      let questionSource: QuestionSourceChoice;

      if (source === 'AI_GENERATED') {
        // AI 生成题目
        const prompts = await getRandomPrompts(category, 3);
        question = await aiService.generateQuestion(category as any, prompts);
        questionSource = 'AI_GENERATED';
        
        // 暂时创建题目记录（不入库，游戏结束后决定是否入库）
        question = await questionService.create({
          ...question,
          category: category as any,
          source: 'AI_GENERATED',
          aiGeneratedBy: req.userId,
        });
        questionSource = 'AI_GENERATED';
      } else {
        // 从题库抽取
        question = await questionService.drawRandom(req.userId, category as any);
        questionSource = 'BANK';
      }

      if (!question) {
        error(res, ErrorCode.NO_AVAILABLE_QUESTION, '暂无可用题目');
        return;
      }

      // 创建游戏会话
      const session = await gameService.createSession({
        userId: req.userId,
        questionId: question.id,
        questionSource,
      });

      // 检查是否玩过
      const hasPlayed = await questionService.hasPlayed(req.userId, question.id);

      success(res, {
        session,
        question: {
          id: question.id,
          surface: question.surface,
          category: question.category,
        },
        hasPlayed,
        hintRemaining: 3,
      });
    } catch (err) {
      next(err);
    }
  },
];

// 获取当前游戏会话
export const getCurrentSession = [
  authMiddleware,

  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        error(res, ErrorCode.UNAUTHORIZED, '请先登录');
        return;
      }

      const session = await gameService.getCurrentSession(req.userId);
      success(res, session);
    } catch (err) {
      next(err);
    }
  },
];

// 提交回合（提问或猜答案）
export const submitRound = [
  authMiddleware,
  param('sessionId').isString().withMessage('无效的会话ID'),
  body('inputMode').isIn(['VOICE', 'TEXT']).withMessage('无效的输入方式'),
  body('playerInput').isLength({ min: 1, max: 200 }).withMessage('输入长度为1-200个字符'),
  body('action').isIn(['ASK', 'GUESS']).withMessage('无效的操作'),

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

      const { sessionId } = req.params;
      const { inputMode, playerInput, action } = req.body;

      // 获取会话
      const session = await gameService.getSession(sessionId, req.userId);
      if (!session) {
        error(res, ErrorCode.SESSION_NOT_FOUND, '游戏会话不存在');
        return;
      }

      // 获取题目
      const question = session.question;
      if (!question) {
        error(res, ErrorCode.QUESTION_NOT_FOUND, '题目不存在');
        return;
      }

      // AI 判定
      const isGuess = action === 'GUESS';
      const judgment = await aiService.judgeAnswer(
        {
          surface: question.surface,
          bottom: question.bottom,
          keywords: question.keywords as string[],
        },
        playerInput,
        isGuess
      );

      // 添加回合
      const round = await gameService.addRound(
        sessionId,
        {
          inputMode: inputMode as InputMode,
          playerInput,
          action: action as RoundAction,
        },
        judgment
      );

      success(res, {
        round,
        judgment: {
          answerType: judgment.answerType,
          aiResponse: judgment.aiResponse,
          hitRate: judgment.hitRate,
          isHit: judgment.isHit,
        },
        sessionEnded: judgment.isHit,
      });
    } catch (err) {
      next(err);
    }
  },
];

// 使用提示
export const useHint = [
  authMiddleware,
  param('sessionId').isString().withMessage('无效的会话ID'),

  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        error(res, ErrorCode.UNAUTHORIZED, '请先登录');
        return;
      }

      const { sessionId } = req.params;

      const session = await gameService.getSession(sessionId, req.userId);
      if (!session) {
        error(res, ErrorCode.SESSION_NOT_FOUND, '游戏会话不存在');
        return;
      }

      if (session.hintRemaining <= 0) {
        error(res, ErrorCode.NO_HINTS_LEFT, '提示次数已用完');
        return;
      }

      const result = await gameService.useHint(sessionId, session.hintUsed);

      success(res, result);
    } catch (err) {
      next(err);
    }
  },
];

// 结束游戏
export const endGame = [
  authMiddleware,
  param('sessionId').isString().withMessage('无效的会话ID'),
  body('result').isIn(['WIN', 'LOSE', 'QUIT']).withMessage('无效的结果'),
  body('revealedAnswer').optional().isBoolean(),

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

      const { sessionId } = req.params;
      const { result, revealedAnswer } = req.body;

      const session = await gameService.getSession(sessionId, req.userId);
      if (!session) {
        error(res, ErrorCode.SESSION_NOT_FOUND, '游戏会话不存在');
        return;
      }

      // 结束会话
      const endedSession = await gameService.endSession(
        sessionId,
        result as GameResult,
        undefined,
        revealedAnswer || false
      );

      // 获取题目详情（如果用户选择查看汤底）
      const question = revealedAnswer ? session.question : null;

      // 获取更新后的排行榜 TOP3
      const leaderboard = await gameService.getGameHistory(req.userId, 3);

      success(res, {
        session: endedSession,
        question: question ? {
          id: question.id,
          bottom: question.bottom,
        } : null,
        leaderboard,
      });
    } catch (err) {
      next(err);
    }
  },
];

// AI 题目入库
// ⚠️ 重要：AI生成的题目需要管理员审核后才能上架
export const saveAIQuestion = [
  authMiddleware,
  param('sessionId').isString().withMessage('无效的会话ID'),

  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        error(res, ErrorCode.UNAUTHORIZED, '请先登录');
        return;
      }

      const { sessionId } = req.params;

      const session = await gameService.getSession(sessionId, req.userId);
      if (!session) {
        error(res, ErrorCode.SESSION_NOT_FOUND, '游戏会话不存在');
        return;
      }

      if (session.questionSource !== 'AI_GENERATED') {
        error(res, ErrorCode.BAD_REQUEST, '该题目不是 AI 生成的');
        return;
      }

      // 更新题目状态为 PENDING（待审核）
      // ⚠️ AI生成的题目需要管理员审核后才能上架
      await questionService.update(session.questionId, {
        status: 'PENDING',
      });

      success(res, { 
        message: '题目已提交，等待管理员审核后加入题库',
        status: 'PENDING',
        needReview: true,
      });
    } catch (err) {
      next(err);
    }
  },
];

// 获取游戏历史
export const getHistory = [
  authMiddleware,

  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        error(res, ErrorCode.UNAUTHORIZED, '请先登录');
        return;
      }

      const limit = parseInt(req.query.limit as string) || 20;
      const history = await gameService.getGameHistory(req.userId, limit);

      success(res, history);
    } catch (err) {
      next(err);
    }
  },
];

// 辅助函数：获取随机提示词
async function getRandomPrompts(category: string | undefined, count: number): Promise<string[]> {
  // TODO: 从 PromptLibrary 表中获取
  // 这里先用默认提示词
  const defaultPrompts = {
    CLASSIC: ['密室', '时间', '消失', '不在场证明', '意外'],
    HORROR: ['镜子', '深夜', '声音', '恐惧', '鬼魂'],
    LOGIC: ['数学', '顺序', '矛盾', '证明', '假设'],
    WARM: ['家人', '重逢', '回忆', '礼物', '约定'],
  };

  const prompts = category ? defaultPrompts[category as keyof typeof defaultPrompts] || [] : [];
  
  // 随机选择
  const shuffled = prompts.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}