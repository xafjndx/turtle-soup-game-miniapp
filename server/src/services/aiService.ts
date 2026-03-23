import axios from 'axios';
import config from '../config';
import logger from '../utils/logger';
import prisma from '../utils/prisma';

// 类型定义
export type AnswerType = 'YES' | 'NO' | 'IRRELEVANT' | 'PARTIAL' | 'CORRECT';
export type QuestionCategory = 'CLASSIC' | 'HORROR' | 'LOGIC' | 'WARM';

// AI 判定结果接口
export interface JudgmentResult {
  answerType: AnswerType;
  aiResponse: string;
  hitRate: number;
  isHit: boolean;
}

// AI 生成题目结果接口
export interface GeneratedQuestion {
  surface: string;
  bottom: string;
  hints: string[];
  keywords: string[];
}

// AI 配置接口
interface AIConfig {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
}

// 阿里百炼 API 配置
const DASHSCOPE_API = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

class AIService {
  private defaultApiKey: string;
  private defaultModel: string;
  private defaultBaseUrl: string;
  private cachedConfig: AIConfig | null = null;
  private configCacheTime: number = 0;
  private readonly CACHE_TTL = 60000; // 缓存 60 秒

  constructor() {
    this.defaultApiKey = config.ai.apiKey;
    this.defaultModel = config.ai.model;
    this.defaultBaseUrl = config.ai.baseUrl;
  }

  // 获取 AI 配置（优先从数据库读取）
  private async getConfig(): Promise<AIConfig> {
    // 检查缓存
    if (this.cachedConfig && Date.now() - this.configCacheTime < this.CACHE_TTL) {
      return this.cachedConfig;
    }

    try {
      // 从数据库获取配置
      const dbConfig = await prisma.systemConfig.findUnique({
        where: { key: 'ai_config' },
      });

      if (dbConfig) {
        const parsed = JSON.parse(dbConfig.value);
        this.cachedConfig = {
          provider: parsed.provider || 'alibaba',
          model: parsed.model || this.defaultModel,
          apiKey: parsed.apiKey || this.defaultApiKey,
          baseUrl: parsed.baseUrl || this.defaultBaseUrl,
        };
        this.configCacheTime = Date.now();
        return this.cachedConfig;
      }
    } catch (err) {
      logger.warn('从数据库读取 AI 配置失败，使用默认配置');
    }

    // 使用默认配置（环境变量）
    return {
      provider: 'alibaba',
      model: this.defaultModel,
      apiKey: this.defaultApiKey,
      baseUrl: this.defaultBaseUrl,
    };
  }

  // 清除配置缓存
  clearCache() {
    this.cachedConfig = null;
    this.configCacheTime = 0;
  }

  // 调用 AI API
  private async callAPI(prompt: string, systemPrompt?: string): Promise<string> {
    const aiConfig = await this.getConfig();

    if (!aiConfig.apiKey) {
      throw new Error('AI API 密钥未配置，请在管理后台配置');
    }

    // 根据提供商选择不同的 API 调用方式
    switch (aiConfig.provider) {
      case 'alibaba':
        return this.callAlibabaAPI(aiConfig, prompt, systemPrompt);
      case 'openai':
        return this.callOpenAIAPI(aiConfig, prompt, systemPrompt);
      case 'deepseek':
        return this.callDeepSeekAPI(aiConfig, prompt, systemPrompt);
      default:
        return this.callCustomAPI(aiConfig, prompt, systemPrompt);
    }
  }

  // 阿里百炼 API（OpenAI 兼容格式）
  private async callAlibabaAPI(config: AIConfig, prompt: string, systemPrompt?: string): Promise<string> {
    try {
      // 使用 OpenAI 兼容的 API 格式
      const url = config.baseUrl 
        ? `${config.baseUrl}/chat/completions`
        : 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
      
      logger.info('Calling Alibaba API:', { url, model: config.model });
      
      const response = await axios.post(
        url,
        {
          model: config.model,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: prompt },
          ],
        },
        {
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      return response.data.choices[0].message.content;
    } catch (error: any) {
      logger.error('AI API call failed:', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      throw new Error(`AI API 调用失败：${error.response?.data?.error?.message || error.message}`);
    }
  }

  // OpenAI API
  private async callOpenAIAPI(config: AIConfig, prompt: string, systemPrompt?: string): Promise<string> {
    try {
      const response = await axios.post(
        `${config.baseUrl || 'https://api.openai.com/v1'}/chat/completions`,
        {
          model: config.model,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: prompt },
          ],
        },
        {
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.choices[0].message.content;
    } catch (error: any) {
      logger.error('OpenAI API call failed:', error.message);
      throw new Error(`OpenAI API 调用失败：${error.message}`);
    }
  }

  // DeepSeek API
  private async callDeepSeekAPI(config: AIConfig, prompt: string, systemPrompt?: string): Promise<string> {
    try {
      const response = await axios.post(
        `${config.baseUrl || 'https://api.deepseek.com/v1'}/chat/completions`,
        {
          model: config.model,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: prompt },
          ],
        },
        {
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.choices[0].message.content;
    } catch (error: any) {
      logger.error('DeepSeek API call failed:', error.message);
      throw new Error(`DeepSeek API 调用失败：${error.message}`);
    }
  }

  // 自定义 API
  private async callCustomAPI(config: AIConfig, prompt: string, systemPrompt?: string): Promise<string> {
    try {
      const response = await axios.post(
        `${config.baseUrl}/chat/completions`,
        {
          model: config.model,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: prompt },
          ],
        },
        {
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.choices[0].message.content;
    } catch (error: any) {
      logger.error('Custom API call failed:', error.message);
      throw new Error(`自定义 API 调用失败：${error.message}`);
    }
  }

  // AI 判定玩家回答
  async judgeAnswer(
    question: { surface: string; bottom: string; keywords: string[] },
    playerInput: string,
    isGuess: boolean
  ): Promise<JudgmentResult> {
    const systemPrompt = `你是严格的海龟汤游戏 AI 裁判，必须公正、严谨地判定玩家的提问和猜测。

╔══════════════════════════════════════════════════════════╗
║          ⚠️  核心规则 - 必须严格遵守 ⚠️                    ║
╚══════════════════════════════════════════════════════════╝

【绝对禁止】
❌ 绝对不能在回复中透露汤底的任何原文或关键词！
❌ 不能因为玩家提到汤底中的某个词就判定猜中！
❌ 不能给出暗示性回复！
✅ 只能回答：是、否、无关、部分正确、恭喜猜中

╔══════════════════════════════════════════════════════════╗
║              📋 提问判定规则                              ║
╚══════════════════════════════════════════════════════════╝

回答类型：
• YES - 玩家的陈述与汤底核心事实一致
• NO - 玩家的陈述与汤底矛盾  
• IRRELEVANT - 玩家的陈述与汤底无关
• PARTIAL - 部分正确，但不完整

回复示例：
• "是"、"是的"、"对"
• "不是"、"不对"、"否"
• "这个问题与故事无关"
• "部分正确，但不完整"

╔══════════════════════════════════════════════════════════╗
║          🎯 猜测判定规则（极其重要！）                    ║
╚══════════════════════════════════════════════════════════╝

【判定流程 - 必须按顺序执行】

第一步：检查玩家是否理解了故事的"核心真相"
  - 不是匹配某句话，而是理解整个故事的逻辑
  - 例如：汤底讲"某人自杀"，玩家说"他死了"→ 不够！必须理解为什么自杀

第二步：五维综合评估（每项 0-20 分，满分 100 分）
  ① 核心真相 (20 分) - 是否理解了故事的核心/真相/反转点
  ② 背景要素 (20 分) - 时间、地点、情境是否准确
  ③ 人物关系 (20 分) - 人物之间的关系是否理清
  ④ 关键行为 (20 分) - 关键动作/事件是否还原
  ⑤ 因果逻辑 (20 分) - 前因后果的逻辑链是否完整

第三步：严格判定标准
  • 90-100 分 → CORRECT（恭喜猜中）
  • 70-89 分  → PARTIAL（很接近了，但还差一些）
  • 40-69 分  → PARTIAL（部分正确，需要继续思考）
  • 0-39 分   → NO（不对，请重新思考）

【重要警告 - 以下情况绝对不能判定为 CORRECT】
⚠️ 玩家只提到汤底中的某个词或某句话
⚠️ 玩家只理解了故事的一部分，没有理解全貌
⚠️ 玩家的描述过于笼统（如"他死了"、"他是凶手"）
⚠️ 玩家没有解释"为什么"，只说了"是什么"

【回复格式 - 必须严格遵守】
回复必须是可以解析的 JSON 格式：
{
  "answerType": "YES|NO|IRRELEVANT|PARTIAL|CORRECT",
  "response": "简短回复（不超过 20 字）",
  "hitRate": 0-100,
  "analysis": {
    "coreTruth": 0-20,
    "background": 0-20,
    "relationships": 0-20,
    "actions": 0-20,
    "causality": 0-20,
    "reasoning": "一句话说明判定理由"
  }
}`;

    const prompt = `【题目信息】
汤面（谜题）：${question.surface}
汤底（真相）：${question.bottom}
关键词：${Array.isArray(question.keywords) ? question.keywords.join('、') : JSON.parse(question.keywords || '[]').join('、')}

【玩家${isGuess ? '的最终猜测' : '的提问'}】
${playerInput}

${isGuess ? `
╔══════════════════════════════════════════════════════════╗
║  这是最终猜测！请严格按照五维评估，≥90 分才能判定猜中！    ║
╚══════════════════════════════════════════════════════════╝` : `
【这是普通提问，只需判断对错即可，不需要打分】`}

请判定并回复 JSON 格式。再次强调：绝对不能透露汤底原文！`;

    try {
      const result = await this.callAPI(prompt, systemPrompt);
      
      // 解析 JSON 结果
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const hitRate = parsed.hitRate || 0;
        
        // 过滤回复，确保不泄露汤底
        let aiResponse = parsed.response || '';
        // 如果回复太长或包含汤底关键词，替换为简短回复
        if (aiResponse.length > 50) {
          const answerMap: Record<string, string> = {
            'YES': '是',
            'NO': '否',
            'IRRELEVANT': '无关',
            'PARTIAL': '部分正确',
            'CORRECT': '恭喜猜中！'
          };
          aiResponse = answerMap[parsed.answerType] || '请换种方式提问';
        }
        
        return {
          answerType: parsed.answerType as AnswerType,
          aiResponse,
          hitRate,
          isHit: hitRate >= 90, // 提高阈值到 90%
        };
      }

      // 解析失败，使用 fallback
      return this.fallbackJudgment(question, playerInput, isGuess);
    } catch (error) {
      logger.warn('AI judgment failed, using fallback:', error);
      // AI 调用失败，使用 fallback 关键词匹配
      return this.fallbackJudgment(question, playerInput, isGuess);
    }
  }

  // Fallback: 增强版关键词匹配判定
  private fallbackJudgment(
    question: { surface: string; bottom: string; keywords: string[] },
    playerInput: string,
    isGuess: boolean
  ): JudgmentResult {
    const input = playerInput.toLowerCase();
    const bottom = question.bottom.toLowerCase();
    const keywords = Array.isArray(question.keywords) 
      ? question.keywords 
      : JSON.parse(question.keywords || '[]');
    
    // 检查关键词匹配
    const matchedKeywords: string[] = [];
    keywords.forEach((kw: string) => {
      if (input.includes(kw.toLowerCase())) {
        matchedKeywords.push(kw);
      }
    });

    // 计算关键词匹配率
    const keywordHitRate = keywords.length > 0 
      ? Math.round((matchedKeywords.length / keywords.length) * 100)
      : 0;

    // 对于猜测模式，需要更严格的判定
    if (isGuess) {
      // 分析汤底的句子数量
      const bottomSentences = bottom.split(/[。！？.!?]/).filter(s => s.trim().length > 0);
      const bottomWords = bottom.split(/[\s，,、；;：:]+/).filter(w => w.trim().length > 0);
      
      // 计算句子覆盖率（权重 40%）
      let sentenceCoverage = 0;
      for (const sentence of bottomSentences) {
        const sentenceWords = sentence.split(/[\s，,、；;：:]+/).filter(w => w.trim().length > 1);
        let matchedInSentence = 0;
        for (const word of sentenceWords) {
          if (input.includes(word)) {
            matchedInSentence++;
          }
        }
        if (matchedInSentence > sentenceWords.length * 0.5) {
          sentenceCoverage++;
        }
      }
      const sentenceRate = bottomSentences.length > 0 
        ? (sentenceCoverage / bottomSentences.length) * 40 
        : 0;
      
      // 关键词覆盖率（权重 30%）
      const keywordRate = keywordHitRate * 0.3;
      
      // 原文字数覆盖（权重 30%）
      let wordMatchCount = 0;
      for (const word of bottomWords) {
        if (word.length > 1 && input.includes(word)) {
          wordMatchCount++;
        }
      }
      const wordRate = bottomWords.length > 0 
        ? (wordMatchCount / bottomWords.length) * 30 
        : 0;
      
      // 综合得分
      const hitRate = Math.round(sentenceRate + keywordRate + wordRate);
      
      // 严格判定标准
      let answerType: AnswerType = 'NO';
      let aiResponse = '这个猜测不对，请再想想故事的全貌。';
      
      if (hitRate >= 90) {
        answerType = 'CORRECT';
        aiResponse = '恭喜你猜对了！';
      } else if (hitRate >= 70) {
        answerType = 'PARTIAL';
        aiResponse = `很接近了！当前重合率${hitRate}%，需要达到 90% 才算猜中。继续努力！`;
      } else if (hitRate >= 40) {
        answerType = 'PARTIAL';
        aiResponse = `部分正确，重合率${hitRate}%。需要更完整地理解故事真相！`;
      } else if (hitRate >= 20) {
        answerType = 'NO';
        aiResponse = '不太对，请重新思考故事的因果关系。';
      }
      
      return { answerType, aiResponse, hitRate, isHit: hitRate >= 90 };
    } else {
      // 提问模式：判断问题相关性
      let answerType: AnswerType = 'IRRELEVANT';
      let aiResponse = '这个问题与汤底关系不大，请换个角度提问。';
      
      if (matchedKeywords.length > 0) {
        answerType = 'YES';
        aiResponse = '这个方向是对的，请继续。';
      } else {
        // 检查否定词
        const negativeWords = ['不', '不是', '没有', '没', '错误', '假的'];
        let hasNegative = false;
        for (const word of negativeWords) {
          if (input.includes(word)) {
            hasNegative = true;
            break;
          }
        }
        if (hasNegative) {
          answerType = 'NO';
          aiResponse = '不是这样的，请再想想。';
        }
      }
      
      return { answerType, aiResponse, hitRate: keywordHitRate, isHit: false };
    }
  }

  // 内容审核
  async moderateContent(content: string): Promise<{ passed: boolean; reason?: string }> {
    const systemPrompt = `你是内容安全审核员。请检查以下内容是否包含：
1. 违法暴力内容
2. 色情低俗内容
3. 政治敏感内容
4. 歧视仇恨言论
5. 自杀自残引导

如果包含以上任何内容，请标记为不通过。`;

    const prompt = `请审核以下内容：
${content}

按 JSON 格式回复：
{
  "passed": true/false,
  "reason": "如果不通过，说明原因"
}`;

    try {
      const result = await this.callAPI(prompt, systemPrompt);
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { passed: true }; // 解析失败默认通过
    } catch (error) {
      logger.warn('内容审核失败:', error);
      return { passed: true }; // 审核失败默认通过
    }
  }

  // AI 生成题目
  async generateQuestion(
    category: QuestionCategory,
    prompts: string[]
  ): Promise<GeneratedQuestion> {
    const systemPrompt = `你是一个海龟汤题目创作专家。请创作一个${category}类型的海龟汤题目。

【题目要求】
1. 汤面（谜题）：简短的情境描述，制造悬念
2. 汤底（真相）：完整的故事真相，逻辑清晰
3. 提示：3 个渐进式提示
4. 关键词：5-8 个关键词，用于 AI 判定

【${category}类型特点】
${this.getCategoryDescription(category)}

请创作一个原创题目，确保逻辑自洽，没有歧义。`;

    const prompt = `请参考以下创作提示：${prompts.join('、')}

请创作一个完整的海龟汤题目，按以下 JSON 格式回复：
{
  "surface": "汤面内容",
  "bottom": "汤底内容",
  "hints": ["提示 1", "提示 2", "提示 3"],
  "keywords": ["关键词 1", "关键词 2", ...]
}`;

    try {
      const result = await this.callAPI(prompt, systemPrompt);
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('AI 生成题目格式错误');
    } catch (error) {
      logger.error('AI 生成题目失败:', error);
      throw new Error('AI 生成题目失败，请稍后重试');
    }
  }

  // 获取分类描述
  private getCategoryDescription(category: QuestionCategory): string {
    const descriptions: Record<QuestionCategory, string> = {
      CLASSIC: '经典推理类，注重逻辑推理和因果关系',
      HORROR: '恐怖悬疑类，包含惊悚元素和反转',
      LOGIC: '纯逻辑类，完全依靠逻辑推理',
      WARM: '温情治愈类，感人的故事真相',
    };
    return descriptions[category] || descriptions.CLASSIC;
  }
}

export default new AIService();
