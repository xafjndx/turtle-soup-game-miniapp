import { Response } from 'express';

// 统一 API 响应格式
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data?: T;
  timestamp: number;
}

// 成功响应
export function success<T>(res: Response, data?: T, message = 'success'): void {
  const response: ApiResponse<T> = {
    code: 0,
    message,
    data,
    timestamp: Date.now(),
  };
  res.json(response);
}

// 错误响应
export function error(res: Response, code: number, message: string): void {
  const response: ApiResponse = {
    code,
    message,
    timestamp: Date.now(),
  };
  res.status(getHttpStatus(code)).json(response);
}

// 分页响应
export interface PageData<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function paginate<T>(
  res: Response,
  list: T[],
  total: number,
  page: number,
  pageSize: number
): void {
  const data: PageData<T> = {
    list,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
  success(res, data);
}

// 业务错误码映射 HTTP 状态码
function getHttpStatus(code: number): number {
  if (code === 401) return 401;
  if (code === 403) return 403;
  if (code === 404) return 404;
  if (code >= 400 && code < 500) return code;
  if (code >= 500) return 500;
  return 400;
}

// 常用错误码
export const ErrorCode = {
  // 通用错误
  UNKNOWN: -1,
  SUCCESS: 0,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMIT_EXCEEDED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,

  // 用户相关 1xxx
  USER_NOT_FOUND: 1001,
  USER_ALREADY_EXISTS: 1002,
  INVALID_USERNAME: 1003,
  INVALID_PASSWORD: 1004,
  LOGIN_REQUIRED: 1005,

  // 题目相关 2xxx
  QUESTION_NOT_FOUND: 2001,
  NO_AVAILABLE_QUESTION: 2002,
  QUESTION_ALREADY_PLAYED: 2003,
  INVALID_CATEGORY: 2004,

  // 游戏相关 3xxx
  SESSION_NOT_FOUND: 3001,
  SESSION_ENDED: 3002,
  NO_HINTS_LEFT: 3003,
  INVALID_INPUT: 3004,
  GAME_NOT_STARTED: 3005,

  // AI 相关 4xxx
  AI_GENERATION_FAILED: 4001,
  AI_JUDGMENT_FAILED: 4002,
  VOICE_RECOGNITION_FAILED: 4003,

  // 管理员相关 5xxx
  ADMIN_NOT_FOUND: 5001,
  PERMISSION_DENIED: 5002,
  INVALID_OPERATION: 5003,
} as const;