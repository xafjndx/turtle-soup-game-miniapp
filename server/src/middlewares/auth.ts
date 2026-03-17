import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';
import { error, ErrorCode } from '../utils/response';

// 扩展 Request 类型
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: any;
    }
  }
}

// JWT 载荷接口
interface JwtPayload {
  userId: string;
  iat: number;
  exp: number;
}

// 用户认证中间件
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    error(res, ErrorCode.UNAUTHORIZED, '请先登录');
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.userId = decoded.userId;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      error(res, ErrorCode.UNAUTHORIZED, '登录已过期，请重新登录');
    } else if (err instanceof jwt.JsonWebTokenError) {
      error(res, ErrorCode.UNAUTHORIZED, '无效的登录凭证');
    } else {
      error(res, ErrorCode.UNAUTHORIZED, '认证失败');
    }
  }
}

// 管理员认证中间件
export function adminAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 先经过用户认证
  authMiddleware(req, res, () => {
    if (!req.userId) {
      error(res, ErrorCode.UNAUTHORIZED, '请先登录');
      return;
    }
    next();
  });
}

// 可选认证中间件（登录和未登录均可访问）
export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
      req.userId = decoded.userId;
    } catch {
      // 忽略错误，继续执行
    }
  }
  
  next();
}

// 生成 JWT Token
export function generateToken(userId: string): string {
  return jwt.sign({ userId }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

// 验证并解析 Token
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, config.jwt.secret) as JwtPayload;
  } catch {
    return null;
  }
}