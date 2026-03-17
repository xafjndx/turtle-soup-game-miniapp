import axios from 'axios';
import * as cheerio from 'cheerio';
import cron from 'node-cron';
import prisma from '../utils/prisma';
import aiService from './aiService';
import logger from '../utils/logger';

// 类型定义
type CrawlSource = 'TIEBA' | 'XIAOHONGSHU' | 'FORUM';

// 爬虫配置
const CRAWLER_CONFIG = {
  // 贴吧配置
  tieba: {
    baseUrl: 'https://tieba.baidu.com',
    forums: ['海龟汤', '海龟汤推理', '推理游戏'],
    maxPages: 5,
  },
  // 小红书配置（需要登录态，这里用模拟数据）
  xiaohongshu: {
    searchUrl: 'https://www.xiaohongshu.com',
    keywords: ['海龟汤', '推理游戏', '剧本杀'],
  },
  // 论坛配置
  forum: {
    urls: [
      'https://www.jubensha.com/forum-海龟汤',
    ],
  },
};

// 抓取的原始内容
interface RawContent {
  title: string;
  content: string;
  source: CrawlSource;
  url: string;
}

class CrawlerService {
  private isRunning = false;

  // 启动定时任务（每天凌晨4点）
  startScheduler() {
    cron.schedule('0 4 * * *', async () => {
      logger.info('🕷️ 开始执行爬虫任务...');
      await this.runCrawler();
    });

    logger.info('✅ 爬虫定时任务已启动（每天凌晨4点）');
  }

  // 手动触发爬虫
  async runCrawler() {
    if (this.isRunning) {
      logger.warn('爬虫正在运行中，跳过本次执行');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    let totalCount = 0;
    let successCount = 0;

    try {
      // 1. 抓取贴吧
      const tiebaContents = await this.crawlTieba();
      totalCount += tiebaContents.length;

      // 2. 抓取论坛（如果可用）
      // const forumContents = await this.crawlForum();
      // totalCount += forumContents.length;

      // 3. 处理抓取的内容
      for (const content of tiebaContents) {
        try {
          const saved = await this.processContent(content);
          if (saved) successCount++;
        } catch (err) {
          logger.error(`处理内容失败: ${content.url}`, err);
        }
      }

      // 4. 清理过期软删除的题目
      const deletedCount = await prisma.question.updateMany({
        where: {
          status: 'SOFT_DELETED',
          softDeletedAt: {
            lt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          },
        },
        data: {
          status: 'HARD_DELETED',
        },
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      logger.info(`✅ 爬虫任务完成: 抓取 ${totalCount} 条，入库 ${successCount} 条，清理 ${deletedCount.count} 条，耗时 ${duration}s`);
    } catch (err) {
      logger.error('爬虫任务执行失败:', err);
    } finally {
      this.isRunning = false;
    }
  }

  // 抓取贴吧
  private async crawlTieba(): Promise<RawContent[]> {
    const contents: RawContent[] = [];

    for (const forum of CRAWLER_CONFIG.tieba.forums) {
      try {
        logger.info(`📡 抓取贴吧: ${forum}`);
        
        // 获取帖子列表
        const posts = await this.getTiebaPosts(forum);
        
        // 获取帖子详情
        for (const post of posts.slice(0, CRAWLER_CONFIG.tieba.maxPages * 50)) {
          try {
            const detail = await this.getTiebaPostDetail(post.id, post.url);
            if (detail) {
              contents.push(detail);
            }
            
            // 延迟避免被封
            await this.delay(1000 + Math.random() * 2000);
          } catch (err) {
            logger.error(`获取帖子详情失败: ${post.url}`, err);
          }
        }
      } catch (err) {
        logger.error(`抓取贴吧 ${forum} 失败:`, err);
      }
    }

    return contents;
  }

  // 获取贴吧帖子列表
  private async getTiebaPosts(forumName: string): Promise<{ id: string; url: string }[]> {
    const posts: { id: string; url: string }[] = [];

    try {
      // 使用贴吧搜索接口
      const searchUrl = `${CRAWLER_CONFIG.tieba.baseUrl}/f/search/res?qw=${encodeURIComponent('海龟汤 汤面 汤底')}&rn=50&un=&only_thread=1`;
      
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
        timeout: 30000,
      });

      const $ = cheerio.load(response.data);
      
      // 解析搜索结果
      $('.p_thread').each((_, elem) => {
        const link = $(elem).find('a.p_title').attr('href');
        if (link) {
          const id = link.match(/\/p\/(\d+)/)?.[1] || '';
          posts.push({
            id,
            url: `${CRAWLER_CONFIG.tieba.baseUrl}${link}`,
          });
        }
      });

      logger.info(`贴吧 ${forumName} 找到 ${posts.length} 个帖子`);
    } catch (err) {
      logger.error(`获取贴吧帖子列表失败: ${forumName}`, err);
    }

    return posts;
  }

  // 获取贴吧帖子详情
  private async getTiebaPostDetail(id: string, url: string): Promise<RawContent | null> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        timeout: 30000,
      });

      const $ = cheerio.load(response.data);
      
      // 获取标题
      const title = $('.core_title_txt').text().trim();
      
      // 获取内容（第一个帖子内容）
      const content = $('.d_post_content').first().text().trim();
      
      if (!title || !content) {
        return null;
      }

      return {
        title,
        content,
        source: 'TIEBA',
        url,
      };
    } catch (err) {
      logger.error(`获取帖子详情失败: ${url}`, err);
      return null;
    }
  }

  // 处理抓取的内容
  private async processContent(raw: RawContent): Promise<boolean> {
    // 1. 检查是否重复
    const existing = await prisma.question.findFirst({
      where: {
        crawlUrl: raw.url,
      },
    });

    if (existing) {
      logger.debug(`内容已存在，跳过: ${raw.url}`);
      return false;
    }

    // 2. 使用 AI 提取结构化题目
    const extracted = await aiService.extractQuestion(raw.content);
    if (!extracted) {
      logger.debug(`无法提取有效题目: ${raw.url}`);
      return false;
    }

    // 3. AI 审核内容
    const moderation = await aiService.moderateContent(
      `${extracted.surface} ${extracted.bottom}`
    );
    if (!moderation.passed) {
      logger.warn(`内容审核不通过: ${raw.url}，原因: ${moderation.reason}`);
      return false;
    }

    // 4. 入库
    await prisma.question.create({
      data: {
        title: raw.title,
        surface: extracted.surface,
        bottom: extracted.bottom,
        hints: JSON.stringify(extracted.hints),
        keywords: JSON.stringify(extracted.keywords),
        source: 'CRAWLER',
        crawlSource: raw.source,
        crawlUrl: raw.url,
        crawledAt: new Date(),
        addedAt: new Date(),
        status: 'APPROVED', // 直接通过，后续可改为 PENDING 人工审核
      },
    });

    logger.info(`成功入库题目: ${raw.title}`);
    return true;
  }

  // 延迟函数
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default new CrawlerService();