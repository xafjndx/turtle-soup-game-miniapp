// api/index.ts
// API 接口定义

// ==================== 基础请求方法 ====================

const BASE_URL = 'https://turtle-soup-server-235023-9-1412292669.sh.run.tcloudbase.com/api';

interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
  timestamp: number;
}

function request<T = any>(url: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', data?: any, needAuth: boolean = true): Promise<T> {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token');

    if (needAuth && !token) {
      wx.navigateTo({ url: '/pages/login/login' });
      reject(new Error('请先登录'));
      return;
    }

    wx.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
      },
      success: (res: any) => {
        const responseData: ApiResponse<T> = res.data;
        if (responseData.code === 0) {
          resolve(responseData.data);
        } else if (responseData.code === 401) {
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          wx.navigateTo({ url: '/pages/login/login' });
          reject(new Error('登录已过期'));
        } else {
          reject(new Error(responseData.message || '请求失败'));
        }
      },
      fail: () => {
        reject(new Error('网络错误，请稍后重试'));
      },
    });
  });
}

const get = <T = any>(url: string, data?: any, needAuth: boolean = true): Promise<T> => request<T>(url, 'GET', data, needAuth);
const post = <T = any>(url: string, data?: any, needAuth: boolean = true): Promise<T> => request<T>(url, 'POST', data, needAuth);
const put = <T = any>(url: string, data?: any, needAuth: boolean = true): Promise<T> => request<T>(url, 'PUT', data, needAuth);
const del = <T = any>(url: string, data?: any, needAuth: boolean = true): Promise<T> => request<T>(url, 'DELETE', data, needAuth);

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

export function login(username: string): Promise<LoginResult> {
  return post<LoginResult>('/user/login', { username }, false);
}

export function wechatLogin(code: string, nickname?: string, avatarUrl?: string): Promise<LoginResult> {
  return post<LoginResult>('/user/login', { code, nickname, avatarUrl }, false);
}

export function getUserProfile(): Promise<User> {
  return get<User>('/user/profile');
}

export function checkIsAdmin(): Promise<{ isAdmin: boolean; role: string | null; permissions: string[] }> {
  return get<{ isAdmin: boolean; role: string | null; permissions: string[] }>('/user/isAdmin');
}

export function exportUserData(): Promise<{
  exportTime: string;
  user: User;
  gameHistory: any[];
}> {
  return get('/user/export');
}

export function deleteAccount(): Promise<{ message: string; deletedAt: string }> {
  return del('/user/delete');
}

export function getUserList(): Promise<User[]> {
  return get<User[]>('/user/list', undefined, false);
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

export function getTop3(): Promise<LeaderboardItem[]> {
  return get<LeaderboardItem[]>('/leaderboard/top3', undefined, false);
}

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

export function getCategories(): Promise<string[]> {
  return get<string[]>('/question/categories');
}

export function drawQuestion(category?: QuestionCategory): Promise<DrawResult> {
  return get<DrawResult>('/question/draw', { category });
}

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

export function submitQuestion(data: SubmitQuestionData): Promise<SubmitQuestionResult> {
  return post<SubmitQuestionResult>('/question/submit', data);
}

export interface SubmitLeaderboardItem {
  rank: number;
  userId: string;
  nickname: string;
  avatarUrl?: string;
  submitCount: number;
}

export function getSubmitLeaderboard(limit = 10): Promise<SubmitLeaderboardItem[]> {
  return get<SubmitLeaderboardItem[]>('/question/submit/leaderboard', { limit }, false);
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

export function getAdminStatistics(): Promise<AdminStats> {
  return get<AdminStats>('/admin/statistics');
}

export async function getPendingQuestions(pageSize = 10): Promise<AdminQuestion[]> {
  const result = await get<{ list: AdminQuestion[]; total: number }>('/admin/questions', { status: 'PENDING', pageSize });
  return result.list || [];
}

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

export function startGame(
  source: 'BANK' | 'AI_GENERATED',
  category?: QuestionCategory
): Promise<StartGameResult> {
  return post<StartGameResult>('/game/start', { source, category });
}

export function getCurrentSession(): Promise<GameSession | null> {
  return get<GameSession | null>('/game/session');
}

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

export function useHint(sessionId: string): Promise<HintResult> {
  return post<HintResult>(`/game/session/${sessionId}/hint`);
}

export function endGame(
  sessionId: string,
  result: GameResult,
  revealedAnswer: boolean
): Promise<{ session: GameSession; question: { bottom: string } | null }> {
  return post(`/game/session/${sessionId}/end`, { result, revealedAnswer });
}

export function saveAIQuestion(sessionId: string): Promise<{ message: string }> {
  return post(`/game/session/${sessionId}/save`);
}

export function getGameHistory(limit = 20): Promise<any[]> {
  return get('/game/history', { limit });
}