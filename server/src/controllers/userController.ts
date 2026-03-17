import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import userService from '../services/userService';
import prisma from '../utils/prisma';
import { success, error, ErrorCode } from '../utils/response';
import { generateToken } from '../middlewares/auth';

// 用户注册/登录
export const login = [
  // 验证规则
  body('username').optional().isLength({ min: 2, max: 20 }).withMessage('用户名长度为2-20个字符'),
  body('openId').optional().isString().withMessage('无效的微信登录'),

  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        error(res, ErrorCode.BAD_REQUEST, errors.array()[0].msg);
        return;
      }

      const { username, openId, nickname, avatarUrl } = req.body;

      // 微信登录
      if (openId) {
        let user = await userService.findByOpenId(openId);
        
        if (!user) {
          // 新用户，创建账号
          user = await userService.create({
            openId,
            username: nickname || `用户${Date.now().toString(36)}`,
            nickname,
            avatarUrl,
          });
        }

        const token = generateToken(user.id);
        success(res, { user, token, isNewUser: !user.lastPlayedAt });
        return;
      }

      // 用户名登录
      if (username) {
        let user = await userService.findByUsername(username);
        
        if (!user) {
          // 新用户，创建账号
          user = await userService.create({ username });
          const token = generateToken(user.id);
          success(res, { user, token, isNewUser: true });
        } else {
          // 已有账号，直接登录
          const token = generateToken(user.id);
          success(res, { user, token, isNewUser: false });
        }
        return;
      }

      error(res, ErrorCode.BAD_REQUEST, '请提供用户名或微信登录信息');
    } catch (err) {
      next(err);
    }
  },
];

// 获取用户信息
export const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.userId) {
      error(res, ErrorCode.UNAUTHORIZED, '请先登录');
      return;
    }

    const user = await userService.findById(req.userId);
    if (!user) {
      error(res, ErrorCode.USER_NOT_FOUND, '用户不存在');
      return;
    }

    const rank = await userService.getUserRank(req.userId);
    success(res, { ...user, rank });
  } catch (err) {
    next(err);
  }
};

// 获取账号列表（用于选择已有账号登录）
export const getUserList = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await userService.getList(10);
    success(res, users);
  } catch (err) {
    next(err);
  }
};

// 获取排行榜 TOP3
export const getTop3 = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const top3 = await userService.getTop3();
    success(res, top3);
  } catch (err) {
    next(err);
  }
};

// 获取完整排行榜
export const getLeaderboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const leaderboard = await userService.getLeaderboard(limit);
    success(res, leaderboard);
  } catch (err) {
    next(err);
  }
};

// 更新用户信息
export const updateProfile = [
  body('nickname').optional().isLength({ max: 50 }).withMessage('昵称最长50个字符'),
  body('avatarUrl').optional().isURL().withMessage('头像地址必须是有效的URL'),

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

      const { nickname, avatarUrl } = req.body;
      const user = await userService.findById(req.userId);

      if (!user) {
        error(res, ErrorCode.USER_NOT_FOUND, '用户不存在');
        return;
      }

      const updatedUser = await userService.findById(req.userId);
      success(res, updatedUser);
    } catch (err) {
      next(err);
    }
  },
];

// 检查用户是否是管理员
export const checkAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.userId) {
      error(res, ErrorCode.UNAUTHORIZED, '请先登录');
      return;
    }

    // 查询用户是否在 Admin 表中
    const admin = await prisma.admin.findUnique({
      where: { userId: req.userId },
    });

    success(res, {
      isAdmin: !!admin,
      role: admin?.role || null,
      permissions: admin?.permissions ? JSON.parse(admin.permissions) : [],
    });
  } catch (err) {
    next(err);
  }
};