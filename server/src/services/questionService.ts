import prisma from '../utils/prisma';

// 类型定义
export type QuestionCategory = 'CLASSIC' | 'HORROR' | 'LOGIC' | 'WARM';
export type QuestionSource = 'PLATFORM' | 'CRAWLER' | 'AI_GENERATED' | 'USER_SUBMITTED';
export type QuestionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SOFT_DELETED' | 'HARD_DELETED';

export interface CreateQuestionData {
  title?: string;
  surface: string;
  bottom: string;
  category?: QuestionCategory;
  hints: string[] | string;
  keywords: string[] | string;
  source?: QuestionSource;
  submittedBy?: string;  // 投稿者用户ID
  aiGeneratedBy?: string;
  crawlSource?: string;
  crawlUrl?: string;
}

class QuestionService {
  // 获取所有分类
  getCategories(): QuestionCategory[] {
    return ['CLASSIC', 'HORROR', 'LOGIC', 'WARM'];
  }

  // 创建题目
  async create(data: CreateQuestionData) {
    return prisma.question.create({
      data: {
        title: data.title,
        surface: data.surface,
        bottom: data.bottom,
        category: data.category || 'CLASSIC',
        hints: typeof data.hints === 'string' ? data.hints : JSON.stringify(data.hints),
        keywords: typeof data.keywords === 'string' ? data.keywords : JSON.stringify(data.keywords),
        source: data.source || 'PLATFORM',
        submittedBy: data.submittedBy,
        aiGeneratedBy: data.aiGeneratedBy,
        crawlSource: data.crawlSource,
        crawlUrl: data.crawlUrl,
        crawledAt: data.crawlSource ? new Date() : undefined,
        addedAt: data.crawlSource ? new Date() : undefined,
      },
    });
  }

  // 根据 ID 获取题目
  async findById(id: string) {
    return prisma.question.findUnique({
      where: { id },
    });
  }

  // 随机抽取题目（排除已玩过的）
  async drawRandom(
    userId: string,
    category?: QuestionCategory,
    excludeIds: string[] = []
  ) {
    // 获取用户已玩过的题目 ID
    const playedQuestions = await prisma.gameHistory.findMany({
      where: { userId },
      select: { questionId: true },
    });
    const playedIds = playedQuestions.map((p) => p.questionId);

    // 构建查询条件
    const where: any = {
      status: 'APPROVED',
      id: { notIn: [...playedIds, ...excludeIds] },
    };

    if (category) {
      where.category = category;
    }

    // 统计可用题目数
    const count = await prisma.question.count({ where });

    if (count === 0) {
      return null;
    }

    // 随机选择一个
    const skip = Math.floor(Math.random() * count);
    return prisma.question.findFirst({
      where,
      skip,
    });
  }

  // 检查用户是否玩过某题目
  async hasPlayed(userId: string, questionId: string): Promise<boolean> {
    const history = await prisma.gameHistory.findFirst({
      where: { userId, questionId },
    });
    return !!history;
  }

  // 获取题目列表（管理员用）
  async getList(options: {
    page?: number;
    pageSize?: number;
    category?: QuestionCategory;
    status?: QuestionStatus;
    source?: QuestionSource;
    keyword?: string;
  } = {}) {
    const { page = 1, pageSize = 20, category, status, source, keyword } = options;

    const where: any = {};

    if (category) where.category = category;
    if (status) where.status = status;
    if (source) where.source = source;
    if (keyword) {
      where.OR = [
        { title: { contains: keyword } },
        { surface: { contains: keyword } },
        { bottom: { contains: keyword } },
      ];
    }

    const [list, total] = await Promise.all([
      prisma.question.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.question.count({ where }),
    ]);

    return { list, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  // 更新题目
  async update(id: string, data: Partial<CreateQuestionData> & { status?: QuestionStatus; quality?: number }) {
    // 处理 hints 和 keywords，确保是字符串
    const updateData: any = {
      ...data,
      updatedAt: new Date(),
    };
    
    if (Array.isArray(data.hints)) {
      updateData.hints = JSON.stringify(data.hints);
    }
    if (Array.isArray(data.keywords)) {
      updateData.keywords = JSON.stringify(data.keywords);
    }
    
    return prisma.question.update({
      where: { id },
      data: updateData,
    });
  }

  // 软删除题目
  async softDelete(id: string) {
    return prisma.question.update({
      where: { id },
      data: {
        status: 'SOFT_DELETED',
        softDeletedAt: new Date(),
      },
    });
  }

  // 恢复软删除的题目
  async restore(id: string) {
    return prisma.question.update({
      where: { id },
      data: {
        status: 'APPROVED',
        softDeletedAt: null,
      },
    });
  }

  // 彻底删除题目
  async hardDelete(id: string) {
    return prisma.question.update({
      where: { id },
      data: {
        status: 'HARD_DELETED',
      },
    });
  }

  // 清理过期软删除题目（超过10天）
  async cleanupSoftDeleted() {
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    const result = await prisma.question.updateMany({
      where: {
        status: 'SOFT_DELETED',
        softDeletedAt: { lt: tenDaysAgo },
      },
      data: {
        status: 'HARD_DELETED',
      },
    });

    return result.count;
  }

  // 增加游玩次数
  async incrementPlayCount(id: string) {
    return prisma.question.update({
      where: { id },
      data: {
        playCount: { increment: 1 },
      },
    });
  }

  // 获取投稿排行榜
  async getSubmitLeaderboard(limit: number = 10) {
    // 统计每个用户的投稿数量（包括待审核和已通过）
    const submissions = await prisma.question.groupBy({
      by: ['submittedBy'],
      where: {
        submittedBy: { not: null },
        status: { in: ['PENDING', 'APPROVED'] },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: limit,
    });

    // 获取用户信息
    const userIds = submissions.map(s => s.submittedBy).filter(Boolean) as string[];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, nickname: true, username: true, avatarUrl: true },
    });

    const userMap = new Map(users.map(u => [u.id, u]));

    return submissions.map((s, index) => ({
      rank: index + 1,
      userId: s.submittedBy,
      nickname: userMap.get(s.submittedBy || '')?.nickname || userMap.get(s.submittedBy || '')?.username || '匿名用户',
      avatarUrl: userMap.get(s.submittedBy || '')?.avatarUrl,
      submitCount: s._count.id,
    }));
  }
}

export default new QuestionService();