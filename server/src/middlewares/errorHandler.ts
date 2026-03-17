import { Request, Response, NextFunction } from 'express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import logger from '../utils/logger';
import { error, ErrorCode } from '../utils/response';

// 全局错误处理中间件
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  logger.error('Unhandled error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Prisma 错误处理
  if (err instanceof PrismaClientKnownRequestError) {
    handlePrismaError(err, res);
    return;
  }

  // 验证错误
  if (err.name === 'ValidationError') {
    error(res, ErrorCode.BAD_REQUEST, err.message);
    return;
  }

  // JSON 解析错误
  if (err.name === 'SyntaxError' && 'body' in err) {
    error(res, ErrorCode.BAD_REQUEST, '请求体格式错误');
    return;
  }

  // 默认服务器错误
  error(res, ErrorCode.INTERNAL_ERROR, '服务器内部错误');
}

// Prisma 错误处理
function handlePrismaError(err: PrismaClientKnownRequestError, res: Response): void {
  switch (err.code) {
    case 'P2002':
      // 唯一约束冲突
      const field = (err.meta?.target as string[])?.join(', ') || '字段';
      error(res, ErrorCode.BAD_REQUEST, `${field}已存在`);
      break;
    case 'P2025':
      // 记录不存在
      error(res, ErrorCode.NOT_FOUND, '记录不存在');
      break;
    case 'P2003':
      // 外键约束失败
      error(res, ErrorCode.BAD_REQUEST, '关联数据不存在');
      break;
    default:
      error(res, ErrorCode.INTERNAL_ERROR, '数据库操作失败');
  }
}

// 404 处理
export function notFoundHandler(req: Request, res: Response): void {
  error(res, ErrorCode.NOT_FOUND, '接口不存在');
}