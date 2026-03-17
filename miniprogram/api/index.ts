// api/index.ts
// API 接口定义

import { get, post } from '../utils/request';

// ==================== 用户相关 ====================

export interface User {
  id: string;
  username: string;
  nickname?: string;
  avatarUrl?: string;
  totalGames: number;
  winCount: number;
  hitRate: number;
  totalPlayTime: number;
  avgPlayTime: number;
}

export interface LoginResult {
  user: User;
  token: string;
  isNewUser: boolean;
}

// 用户登录
export function login(username: string): Promise<LoginResult> {
  return post<LoginResult>('/user/login', { username });
}

// 微信登录
export function wechatLogin(openId: string, nickname?: string, avatarUrl?: string): Promise<LoginResult> {
  return post<LoginResult>('/user/login', { openId, nickname, avatarUrl });
}

// 获取用户信息
export function getUserProfile(): Promise<User> {
  return get<User>('/user/profile');
}

// 检查是否是管理员
export function checkIsAdmin(): Promise<{ isAdmin: boolean; role: string | null; permissions: string[] }> {
  return get<{ isAdmin: boolean; role: string | null; permissions: string[] }>('/user/isAdmin');
}

// 获取账号列表
export function getUserList(): Promise<User[]> {
  return get<User[]>('/user/list');
}

// ==================== 排行榜相关 ====================

export interface LeaderboardItem {
  id: string;
  username: string;
  nickname?: string;
  avatarUrl?: string;
  hitRate: number;
  totalGames: number;
  winCount: number;
}

// 获取 TOP3
export function getTop3(): Promise<LeaderboardItem[]> {
  return get<LeaderboardItem[]>('/leaderboard/top3');
}

// 获取完整排行榜
export function getLeaderboard(limit = 100): Promise<LeaderboardItem[]> {
  return get<LeaderboardItem[]>('/leaderboard', { limit });
}

// ==================== 题目相关 ====================

export type QuestionCategory = 'CLASSIC' | 'HORROR' | 'LOGIC' | 'WARM';

export interface Question {
  id: string;
  title?: string;
  surface: string;
  bottom?: string;
  category: QuestionCategory;
  hints: string[];
  keywords: string[];
  playCount: number;
}

export interface DrawResult {
  question: Question;
  hasPlayed: boolean;
}

// 获取题目分类
export function getCategories(): Promise<string[]> {
  return get<string[]>('/question/categories');
}

// 抽取题目
export function drawQuestion(category?: QuestionCategory): Promise<DrawResult> {
  return get<DrawResult>('/question/draw', { category });
}

// 获取题目详情
export function getQuestionDetail(id: string): Promise<Question> {
  return get<Question>(`/question/${id}`);
}

// ==================== 用户投稿 ====================

export interface SubmitQuestionData {
  title?: string;
  surface: string;
  bottom: string;
  category: QuestionCategory;
  hints: string[];
  keywords: string[];
}

export interface SubmitQuestionResult {
  id: string;
  message: string;
  status: 'PENDING';
}

// 用户投稿题目
export function submitQuestion(data: SubmitQuestionData): Promise<SubmitQuestionResult> {
  return post<SubmitQuestionResult>('/question/submit', data);
}

// ==================== 管理员功能 ====================

export interface AdminStats {
  users: { total: number; active: number };
  questions: { total: number; pending: number; softDeleted: number; byCategory: Record<string, number>; bySource: Record<string, number> };
  games: { total: number; today: number; winRate: string };
}

export interface AdminQuestion {
  id: string;
  title?: string;
  surface: string;
  bottom: string;
  category: string;
  source: string;
  status: string;
  createdAt: string;
}

// 获取管理统计数据
export function getAdminStatistics(): Promise<AdminStats> {
  return get<AdminStats>('/admin/statistics');
}

// 获取待审核题目列表
export function getPendingQuestions(pageSize = 10): Promise<AdminQuestion[]> {
  return get<AdminQuestion[]>('/admin/questions', { status: 'PENDING', pageSize });
}

// 更新题目状态
export function updateQuestionStatus(id: string, status: string): Promise<void> {
  return put<void>(`/admin/question/${id}/status`, { status });
}

// ==================== 游戏相关 ====================

export type InputMode = 'VOICE' | 'TEXT';
export type RoundAction = 'ASK' | 'GUESS';
export type GameResult = 'WIN' | 'LOSE' | 'QUIT';

export interface GameSession {
  id: string;
  questionId: string;
  questionSource: 'BANK' | 'AI_GENERATED';
  status: 'ONGOING' | 'COMPLETED' | 'ABORTED';
  hintUsed: number;
  hintRemaining: number;
  inputMode?: InputMode;
  result?: GameResult;
  hitRate?: number;
  revealedAnswer: boolean;
  startedAt: string;
  endedAt?: string;
  totalTime?: number;
  question: Question;
  rounds: Round[];
}

export interface Round {
  id: string;
  roundNumber: number;
  inputMode: InputMode;
  playerInput: string;
  action: RoundAction;
  answerType: 'YES' | 'NO' | 'IRRELEVANT' | 'PARTIAL' | 'CORRECT';
  aiResponse: string;
  createdAt: string;
}

export interface StartGameResult {
  session: GameSession;
  question: Question;
  hasPlayed: boolean;
  hintRemaining: number;
}

export interface SubmitRoundResult {
  round: Round;
  judgment: {
    answerType: string;
    aiResponse: string;
    hitRate: number;
    isHit: boolean;
  };
  sessionEnded: boolean;
}

export interface HintResult {
  hint: string;
  hintRemaining: number;
}

// 开始游戏
export function startGame(
  source: 'BANK' | 'AI_GENERATED',
  category?: QuestionCategory
): Promise<StartGameResult> {
  return post<StartGameResult>('/game/start', { source, category });
}

// 获取当前会话
export function getCurrentSession(): Promise<GameSession | null> {
  return get<GameSession | null>('/game/session');
}

// 提交回合
export function submitRound(
  sessionId: string,
  inputMode: InputMode,
  playerInput: string,
  action: RoundAction
): Promise<SubmitRoundResult> {
  return post<SubmitRoundResult>(`/game/session/${sessionId}/round`, {
    inputMode,
    playerInput,
    action,
  });
}

// 使用提示
export function useHint(sessionId: string): Promise<HintResult> {
  return post<HintResult>(`/game/session/${sessionId}/hint`);
}

// 结束游戏
export function endGame(
  sessionId: string,
  result: GameResult,
  revealedAnswer: boolean
): Promise<{ session: GameSession; question: { bottom: string } | null }> {
  return post(`/game/session/${sessionId}/end`, { result, revealedAnswer });
}

// AI 题目入库
export function saveAIQuestion(sessionId: string): Promise<{ message: string }> {
  return post(`/game/session/${sessionId}/save`);
}

// 获取游戏历史
export function getGameHistory(limit = 20): Promise<any[]> {
  return get('/game/history', { limit });
}