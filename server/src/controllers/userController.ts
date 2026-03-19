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
  body('code').optional().isString().withMessage('无效的微信登录凭证'),
  body('nickname').optional().isString(),
  body('avatarUrl').optional().isString(),

  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        error(res, ErrorCode.BAD_REQUEST, errors.array()[0].msg);
        return;
      }

      const { username, openId, code, nickname, avatarUrl } = req.body;

      // 微信登录
      let wechatOpenId = openId;
      
      // 如果传的是 code，用 code 换取 openId
      if (code && !openId) {
        try {
          const axios = require('axios');
          const wxAppId = process.env.WECHAT_APPID;
          const wxSecret = process.env.WECHAT_SECRET;
          
          if (!wxAppId || !wxSecret || wxAppId === 'your-wechat-appid') {
            // 微信配置未设置，返回错误
            error(res, ErrorCode.INTERNAL_ERROR, '微信登录未配置，请联系管理员');
            return;
          }
          
          const wxRes = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
            params: {
              appid: wxAppId,
              secret: wxSecret,
              js_code: code,
              grant_type: 'authorization_code',
            },
          });
          
          if (wxRes.data.openid) {
            wechatOpenId = wxRes.data.openid;
          } else {
            console.error('微信登录失败:', wxRes.data);
            error(res, ErrorCode.INTERNAL_ERROR, wxRes.data.errmsg || '微信登录失败');
            return;
          }
        } catch (err) {
          console.error('微信登录请求失败:', err);
          error(res, ErrorCode.INTERNAL_ERROR, '微信登录服务暂时不可用');
          return;
        }
      }

      if (wechatOpenId) {
        let user = await userService.findByOpenId(wechatOpenId);
        
        if (!user) {
          // 新用户，创建账号
          user = await userService.create({
            openId: wechatOpenId,
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

// 导出用户数据
export const exportUserData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.userId) {
      error(res, ErrorCode.UNAUTHORIZED, '请先登录');
      return;
    }

    // 获取用户基本信息
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        username: true,
        nickname: true,
        avatarUrl: true,
        createdAt: true,
        totalGames: true,
        winCount: true,
        hitRate: true,
        totalPlayTime: true,
        avgPlayTime: true,
        maxPlayTime: true,
        totalHintsUsed: true,
        avgHintsPerGame: true,
        lastPlayedAt: true,
      },
    });

    if (!user) {
      error(res, ErrorCode.USER_NOT_FOUND, '用户不存在');
      return;
    }

    // 获取游戏历史
    const gameHistory = await prisma.gameHistory.findMany({
      where: { userId: req.userId },
      include: {
        question: {
          select: {
            surface: true,
            category: true,
          },
        },
      },
      orderBy: { playedAt: 'desc' },
    });

    // 组装导出数据
    const exportData = {
      exportTime: new Date().toISOString(),
      user: user,
      gameHistory: gameHistory.map(h => ({
        playedAt: h.playedAt,
        result: h.result,
        playTime: h.playTime,
        hitRate: h.hitRate,
        hintUsed: h.hintUsed,
        question: h.question.surface,
        category: h.question.category,
      })),
    };

    success(res, exportData);
  } catch (err) {
    next(err);
  }
};

// 注销账号（删除用户数据）
export const deleteAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.userId) {
      error(res, ErrorCode.UNAUTHORIZED, '请先登录');
      return;
    }

    // 获取用户信息用于确认
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!user) {
      error(res, ErrorCode.USER_NOT_FOUND, '用户不存在');
      return;
    }

    // 删除用户的所有数据（级联删除）
    // 1. 删除游戏历史
    await prisma.gameHistory.deleteMany({
      where: { userId: req.userId },
    });

    // 2. 删除游戏会话
    await prisma.gameSession.deleteMany({
      where: { userId: req.userId },
    });

    // 3. 删除管理员记录（如果有）
    await prisma.admin.deleteMany({
      where: { userId: req.userId },
    });

    // 4. 删除用户
    await prisma.user.delete({
      where: { id: req.userId },
    });

    success(res, { 
      message: '账号已注销，所有数据已删除',
      deletedAt: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
};