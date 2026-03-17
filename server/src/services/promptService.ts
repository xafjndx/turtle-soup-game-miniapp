import prisma from '../utils/prisma';

// 类型定义
type QuestionCategory = 'CLASSIC' | 'HORROR' | 'LOGIC' | 'WARM';

// 提示词库服务
class PromptService {
  // 获取某分类的提示词列表
  async getPromptsByCategory(category: QuestionCategory) {
    return prisma.promptLibrary.findMany({
      where: { category },
      orderBy: { usageCount: 'desc' },
    });
  }

  // 获取所有提示词（按分类分组）
  async getAllPrompts() {
    const prompts = await prisma.promptLibrary.findMany({
      orderBy: [{ category: 'asc' }, { usageCount: 'desc' }],
    });

    // 按分类分组
    const grouped: Record<string, typeof prompts> = {
      CLASSIC: [],
      HORROR: [],
      LOGIC: [],
      WARM: [],
    };

    for (const prompt of prompts) {
      if (grouped[prompt.category]) {
        grouped[prompt.category].push(prompt);
      }
    }

    return grouped;
  }

  // 随机获取指定数量的提示词
  async getRandomPrompts(category: QuestionCategory, count: number = 3) {
    const prompts = await prisma.promptLibrary.findMany({
      where: { category },
    });

    if (prompts.length === 0) {
      // 返回默认提示词
      return this.getDefaultPrompts(category, count);
    }

    // 随机打乱并选取
    const shuffled = prompts.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count).map(p => p.prompt);
  }

  // 默认提示词
  private getDefaultPrompts(category: QuestionCategory, count: number): string[] {
    const defaults: Record<QuestionCategory, string[]> = {
      CLASSIC: ['密室', '时间', '消失', '不在场证明', '意外', '巧合', '身份', '职业'],
      HORROR: ['镜子', '深夜', '声音', '恐惧', '鬼魂', '死亡', '诅咒', '血迹'],
      LOGIC: ['数学', '顺序', '矛盾', '证明', '假设', '推理', '逻辑', '规律'],
      WARM: ['家人', '重逢', '回忆', '礼物', '约定', '爱', '童年', '老人'],
    };

    const prompts = defaults[category] || defaults.CLASSIC;
    const shuffled = [...prompts].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  // 添加提示词
  async addPrompt(category: QuestionCategory, prompt: string) {
    return prisma.promptLibrary.create({
      data: {
        category,
        prompt,
        generatedBy: 'MANUAL',
      },
    });
  }

  // 更新提示词使用次数
  async incrementUsage(id: string) {
    return prisma.promptLibrary.update({
      where: { id },
      data: {
        usageCount: { increment: 1 },
      },
    });
  }

  // 删除提示词
  async deletePrompt(id: string) {
    return prisma.promptLibrary.delete({
      where: { id },
    });
  }

  // 批量导入提示词
  async importPrompts(category: QuestionCategory, prompts: string[]) {
    const data = prompts.map(prompt => ({
      category,
      prompt,
      generatedBy: 'AI_AUTO',
    }));

    return prisma.promptLibrary.createMany({
      data,
      skipDuplicates: true,
    });
  }

  // 获取提示词库统计
  async getStats() {
    const stats = await prisma.promptLibrary.groupBy({
      by: ['category'],
      _count: true,
    });

    return stats.reduce((acc, item) => {
      acc[item.category] = item._count;
      return acc;
    }, {} as Record<string, number>);
  }
}

export default new PromptService();