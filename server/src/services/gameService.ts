import prisma from '../utils/prisma';

// 类型定义
export type QuestionSourceChoice = 'BANK' | 'AI_GENERATED';
export type SessionStatus = 'ONGOING' | 'COMPLETED' | 'ABORTED';
export type GameResult = 'WIN' | 'LOSE' | 'QUIT';
export type InputMode = 'VOICE' | 'TEXT';
export type AnswerType = 'YES' | 'NO' | 'IRRELEVANT' | 'PARTIAL' | 'CORRECT';
export type RoundAction = 'ASK' | 'GUESS' | 'HINT' | 'QUIT';

export interface CreateSessionData {
  userId: string;
  questionId: string;
  questionSource: QuestionSourceChoice;
}

export interface RoundData {
  inputMode: InputMode;
  playerInput: string;
  action: RoundAction;
}

export interface RoundResult {
  answerType: AnswerType;
  aiResponse: string;
  isHit: boolean;
  hitRate?: number;
}

class GameService {
  // 创建游戏会话
  async createSession(data: CreateSessionData) {
    return prisma.gameSession.create({
      data: {
        userId: data.userId,
        questionId: data.questionId,
        questionSource: data.questionSource,
        status: 'ONGOING',
        hintUsed: 0,
        hintRemaining: 3,
      },
      include: {
        question: true,
      },
    });
  }

  // 获取会话详情
  async getSession(sessionId: string, userId?: string) {
    const where: any = { id: sessionId };
    if (userId) where.userId = userId;

    return prisma.gameSession.findFirst({
      where,
      include: {
        question: true,
        rounds: {
          orderBy: { roundNumber: 'asc' },
        },
      },
    });
  }

  // 获取用户当前进行中的会话
  async getCurrentSession(userId: string) {
    return prisma.gameSession.findFirst({
      where: {
        userId,
        status: 'ONGOING',
      },
      include: {
        question: true,
        rounds: {
          orderBy: { roundNumber: 'asc' },
        },
      },
    });
  }

  // 添加回合
  async addRound(sessionId: string, roundData: RoundData, result: RoundResult) {
    // 获取当前回合数
    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: { rounds: true },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    const roundNumber = session.rounds.length + 1;

    // 创建回合记录
    const round = await prisma.round.create({
      data: {
        sessionId,
        roundNumber,
        inputMode: roundData.inputMode,
        playerInput: roundData.playerInput,
        action: roundData.action,
        answerType: result.answerType,
        aiResponse: result.aiResponse,
      },
    });

    // 如果命中，更新会话状态
    if (result.isHit) {
      await this.endSession(sessionId, 'WIN', result.hitRate);
    }

    return round;
  }

  // 使用提示
  async useHint(sessionId: string, hintIndex: number) {
    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: { question: true },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    if (session.hintRemaining <= 0) {
      throw new Error('No hints left');
    }

    // 更新提示使用情况
    const updatedSession = await prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        hintUsed: { increment: 1 },
        hintRemaining: { decrement: 1 },
      },
    });

    // 获取提示内容
    const hints = JSON.parse(session.question.hints as string);
    const hint = hints[hintIndex] || hints[session.hintUsed];

    return {
      hint,
      hintRemaining: updatedSession.hintRemaining,
    };
  }

  // 结束会话
  async endSession(
    sessionId: string,
    result: GameResult,
    hitRate?: number,
    revealedAnswer: boolean = false
  ) {
    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    // 计算总耗时（分钟）
    const endedAt = new Date();
    const totalTime = (endedAt.getTime() - session.startedAt.getTime()) / (1000 * 60);

    // 更新会话
    const updatedSession = await prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        status: 'COMPLETED',
        endedAt,
        totalTime: Number(totalTime.toFixed(2)),
        result,
        hitRate: hitRate !== undefined ? Number(hitRate.toFixed(2)) : null,
        revealedAnswer,
      },
    });

    // 创建游戏历史记录
    await prisma.gameHistory.create({
      data: {
        userId: session.userId,
        questionId: session.questionId,
        result,
        hitRate: hitRate !== undefined ? Number(hitRate.toFixed(2)) : 0,
        playTime: Number(totalTime.toFixed(2)),
        hintUsed: session.hintUsed,
        revealedAnswer,
      },
    });

    // 更新用户统计
    await this.updateUserStats(session.userId, {
      won: result === 'WIN',
      playTime: totalTime,
      hintsUsed: session.hintUsed,
      hitRate,
    });

    return updatedSession;
  }

  // 更新用户统计
  private async updateUserStats(
    userId: string,
    stats: {
      won: boolean;
      playTime: number;
      hintsUsed: number;
      hitRate?: number;
    }
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return;

    const updateData: any = {
      totalGames: user.totalGames + 1,
      lastPlayedAt: new Date(),
    };

    if (stats.won) {
      updateData.winCount = user.winCount + 1;
    }

    const newTotalPlayTime = Number(user.totalPlayTime) + stats.playTime;
    updateData.totalPlayTime = Number(newTotalPlayTime.toFixed(2));
    updateData.avgPlayTime = Number((newTotalPlayTime / updateData.totalGames).toFixed(2));
    updateData.maxPlayTime = Number(Math.max(Number(user.maxPlayTime), stats.playTime).toFixed(2));

    const newTotalHints = user.totalHintsUsed + stats.hintsUsed;
    updateData.totalHintsUsed = newTotalHints;
    updateData.avgHintsPerGame = Number((newTotalHints / updateData.totalGames).toFixed(2));

    if (stats.hitRate !== undefined) {
      const oldTotalHitRate = Number(user.hitRate) * user.totalGames;
      const newHitRate = (oldTotalHitRate + stats.hitRate) / updateData.totalGames;
      updateData.hitRate = Number(newHitRate.toFixed(2));
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  }

  // 获取用户游戏历史
  async getGameHistory(userId: string, limit = 20) {
    return prisma.gameHistory.findMany({
      where: { userId },
      include: {
        question: {
          select: {
            id: true,
            title: true,
            surface: true,
            category: true,
          },
        },
      },
      orderBy: { playedAt: 'desc' },
      take: limit,
    });
  }
}

export default new GameService();