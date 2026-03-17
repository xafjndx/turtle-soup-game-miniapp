import logger from '../utils/logger';

/**
 * ⚠️ 合规声明
 * 
 * 本服务已移除网络爬虫功能，原因如下：
 * 1. 网络爬虫可能违反《网络安全法》和《数据安全法》
 * 2. 可能违反目标网站的robots.txt和服务条款
 * 3. 可能涉及侵犯版权和用户隐私
 * 
 * 当前题目来源：
 * 1. 平台官方投稿（PLATFORM）
 * 2. AI辅助生成（AI_GENERATED）- 需人工审核后才能上架
 * 3. 用户原创投稿（USER_SUBMITTED）- 需人工审核后才能上架
 */

class CrawlerService {
  private isRunning = false;

  /**
   * 启动定时任务
   * @deprecated 爬虫功能已禁用，此方法不再执行任何操作
   */
  startScheduler() {
    logger.info('⚠️ 爬虫功能已禁用，定时任务不会启动');
    logger.info('📝 题目来源已改为：官方投稿 + AI辅助生成(人工审核) + 用户投稿(人工审核)');
  }

  /**
   * 手动触发爬虫
   * @deprecated 爬虫功能已禁用
   * @returns 提示信息
   */
  async runCrawler() {
    if (this.isRunning) {
      return { success: false, message: '爬虫功能已禁用' };
    }

    logger.warn('⚠️ 爬虫功能已禁用，请使用以下方式添加题目：');
    logger.info('1. 管理后台手动添加题目');
    logger.info('2. AI辅助生成题目（需人工审核）');
    logger.info('3. 用户投稿功能（需人工审核）');

    return {
      success: false,
      message: '爬虫功能已禁用。请通过管理后台手动添加题目，或使用AI辅助生成功能（生成后需人工审核）。',
      alternatives: [
        '管理后台手动添加题目',
        'AI辅助生成题目（需人工审核）',
        '用户投稿功能（需人工审核）',
      ],
    };
  }

  /**
   * 获取爬虫状态
   * @returns 爬虫已禁用的状态信息
   */
  getStatus() {
    return {
      enabled: false,
      reason: '为符合《网络安全法》和微信小程序审核要求，网络爬虫功能已永久禁用',
      lastRun: null,
      nextRun: null,
    };
  }
}

export default new CrawlerService();