import prisma from '../utils/prisma';

export interface CreateUserData {
  openId?: string;
  username: string;
  nickname?: string;
  avatarUrl?: string;
}

export interface UpdateUserStats {
  won?: boolean;
  playTime?: number;
  hintsUsed?: number;
  hitRate?: number;
}

class UserService {
  // 创建用户
  async create(data: CreateUserData) {
    return prisma.user.create({
      data: {
        openId: data.openId,
        username: data.username,
        nickname: data.nickname,
        avatarUrl: data.avatarUrl,
      },
    });
  }

  // 根据 ID 获取用户
  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  // 根据用户名获取用户
  async findByUsername(username: string) {
    return prisma.user.findUnique({
      where: { username },
    });
  }

  // 根据微信 OpenID 获取用户
  async findByOpenId(openId: string) {
    return prisma.user.findUnique({
      where: { openId },
    });
  }

  // 获取用户列表（用于选择已有账号登录）
  async getList(limit = 10) {
    return prisma.user.findMany({
      select: {
        id: true,
        username: true,
        nickname: true,
        avatarUrl: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // 更新用户统计
  async updateStats(userId: string, stats: UpdateUserStats) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return null;

    const updateData: any = {
      lastPlayedAt: new Date(),
    };

    // 更新游戏总数
    updateData.totalGames = user.totalGames + 1;

    // 更新胜利次数
    if (stats.won) {
      updateData.winCount = user.winCount + 1;
    }

    // 更新游戏时间
    if (stats.playTime) {
      const newTotalPlayTime = Number(user.totalPlayTime) + stats.playTime;
      updateData.totalPlayTime = newTotalPlayTime;
      updateData.avgPlayTime = newTotalPlayTime / updateData.totalGames;
      updateData.maxPlayTime = Math.max(Number(user.maxPlayTime), stats.playTime);
    }

    // 更新提示使用次数
    if (stats.hintsUsed) {
      const newTotalHints = user.totalHintsUsed + stats.hintsUsed;
      updateData.totalHintsUsed = newTotalHints;
      updateData.avgHintsPerGame = newTotalHints / updateData.totalGames;
    }

    // 更新命中率
    if (stats.hitRate !== undefined) {
      // 计算新的平均命中率
      const oldTotalHitRate = Number(user.hitRate) * user.totalGames;
      const newHitRate = (oldTotalHitRate + stats.hitRate) / updateData.totalGames;
      updateData.hitRate = Number(newHitRate.toFixed(2));
    }

    return prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  }

  // 获取排行榜
  async getLeaderboard(limit = 100) {
    return prisma.user.findMany({
      select: {
        id: true,
        username: true,
        nickname: true,
        avatarUrl: true,
        hitRate: true,
        totalGames: true,
        avgPlayTime: true,
        winCount: true,
      },
      where: {
        totalGames: { gt: 0 }, // 至少完成一题
      },
      orderBy: [
        { hitRate: 'desc' },
        { totalGames: 'desc' },
        { avgPlayTime: 'asc' },
      ],
      take: limit,
    });
  }

  // 获取 TOP3 排行榜
  async getTop3() {
    return this.getLeaderboard(3);
  }

  // 获取用户排名
  async getUserRank(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.totalGames === 0) {
      return null;
    }

    // 统计排名在当前用户之前的用户数
    const rank = await prisma.user.count({
      where: {
        totalGames: { gt: 0 },
        OR: [
          { hitRate: { gt: user.hitRate } },
          {
            hitRate: user.hitRate,
            totalGames: { gt: user.totalGames },
          },
          {
            hitRate: user.hitRate,
            totalGames: user.totalGames,
            avgPlayTime: { lt: user.avgPlayTime },
          },
        ],
      },
    });

    return rank + 1;
  }
}

export default new UserService();