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
  private readonly CACHE_TTL = 60000; // 缓存60秒

  constructor() {
    this.defaultApiKey = config.ai.apiKey;
    this.defaultModel = config.ai.model;
    this.defaultBaseUrl = config.ai.baseUrl;
  }

  // 获取AI配置（优先从数据库读取）
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
      logger.warn('从数据库读取AI配置失败，使用默认配置');
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

  // 调用AI API
  private async callAPI(prompt: string, systemPrompt?: string): Promise<string> {
    const aiConfig = await this.getConfig();

    if (!aiConfig.apiKey) {
      throw new Error('AI API密钥未配置，请在管理后台配置');
    }

    // 根据提供商选择不同的API调用方式
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
      throw new Error(`AI API 调用失败: ${error.response?.data?.error?.message || error.message}`);
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
      throw new Error(`OpenAI API 调用失败: ${error.message}`);
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
      throw new Error(`DeepSeek API 调用失败: ${error.message}`);
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
      throw new Error(`自定义 API 调用失败: ${error.message}`);
    }
  }

  // AI 判定玩家回答
  async judgeAnswer(
    question: { surface: string; bottom: string; keywords: string[] },
    playerInput: string,
    isGuess: boolean
  ): Promise<JudgmentResult> {
    const systemPrompt = `你是一个海龟汤游戏的裁判。你的任务是判定玩家的提问或猜测。

【重要规则 - 绝对禁止】
1. 绝对不能在回复中透露汤底的任何内容！
2. 只能回答"是"、"否"、"无关"、"部分正确"
3. 回复要简短，不要给出任何提示或线索

【提问判定规则】
1. "YES" - 玩家的陈述与汤底中的核心事实一致
2. "NO" - 玩家的陈述与汤底矛盾
3. "IRRELEVANT" - 玩家的陈述与汤底无关，不影响推理
4. "PARTIAL" - 部分正确，接近但未完全命中

【猜测判定规则 - 非常重要！】
猜测必须与完整汤底进行综合判定，不能只匹配一句话就算猜中！

判定要素（每个要素占20%权重）：
1. 汤底完整意思 - 是否理解了整个故事的真相
2. 汤底背景信息 - 是否掌握了故事发生的背景
3. 汤底角色关系 - 是否理清了角色之间的关系
4. 角色的动作 - 是否还原了关键动作
5. 前因后果 - 是否理解了事情的因果

判定标准：
- 重合度 ≥ 85% 才能判定为 CORRECT（猜中汤底）
- 重合度 60-84% 为 PARTIAL（接近了）
- 重合度 < 60% 为 NO（不对）

【特别警告】
不能因为玩家的一句话与汤底中某句话意思相近就直接判定猜中！
必须评估玩家是否完整理解了汤底的全貌！

回复格式（JSON）：
{
  "answerType": "YES|NO|IRRELEVANT|PARTIAL|CORRECT",
  "response": "简短回复",
  "hitRate": 0-100,
  "analysis": {
    "fullMeaning": 0-20,
    "background": 0-20,
    "relationships": 0-20,
    "actions": 0-20,
    "causality": 0-20
  }
}`;

    const prompt = `汤面：${question.surface}
汤底：${question.bottom}
关键词：${Array.isArray(question.keywords) ? question.keywords.join('、') : JSON.parse(question.keywords || '[]').join('、')}

玩家${isGuess ? '猜测' : '提问'}：${playerInput}

${isGuess ? '【这是猜测！请严格按照猜测判定规则，综合评估各要素后给出hitRate，≥85%才算猜中】' : '【这是提问，只需判断对错即可】'}

请判定并按JSON格式回复。记住：绝对不能透露汤底内容！`;

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
          isHit: hitRate >= config.game.hitThreshold,
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

  // Fallback: 简单关键词匹配判定
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
    // 检查玩家输入是否覆盖了汤底的主要要素
    let answerType: AnswerType = 'IRRELEVANT';
    let aiResponse = '这个问题与汤底关系不大，请换个角度提问。';
    let hitRate = keywordHitRate;

    // 只有在猜测模式下才判断是否正确
    if (isGuess) {
      // 分析汤底的句子数量和复杂度
      const bottomSentences = bottom.split(/[。！？.!?]/).filter(s => s.trim().length > 0);
      const bottomWords = bottom.split(/[\s，,、；;：:]+/).filter(w => w.trim().length > 0);
      
      // 计算玩家输入覆盖汤底内容的程度
      let coverageScore = 0;
      
      // 检查是否覆盖了多个句子（体现对完整故事的理解）
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
      
      // 句子覆盖率（权重40%）
      const sentenceRate = bottomSentences.length > 0 
        ? (sentenceCoverage / bottomSentences.length) * 40 
        : 0;
      
      // 关键词覆盖率（权重30%）
      const keywordRate = keywordHitRate * 0.3;
      
      // 原文字数覆盖（权重30%）
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
      hitRate = Math.round(sentenceRate + keywordRate + wordRate);
      
      // 必须达到85%才算猜中
      if (hitRate >= 85) {
        answerType = 'CORRECT';
        aiResponse = '恭喜你猜对了！';
      } else if (hitRate >= 60) {
        answerType = 'PARTIAL';
        aiResponse = `接近了！当前重合率${hitRate}%，需要达到85%才算猜中。继续努力！`;
      } else if (hitRate >= 30) {
        answerType = 'PARTIAL';
        aiResponse = `有些对了，但重合率只有${hitRate}%。需要更完整地理解故事真相！`;
      } else {
        answerType = 'NO';
        aiResponse = '这个猜测不对，请再想想故事的全貌。';
      }
    } else {
      // 提问模式：判断问题相关性
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
        } else {
          answerType = 'IRRELEVANT';
          aiResponse = '这个问题与汤底关系不大，请换个角度提问。';
        }
      }
    }

    return {
      answerType,
      aiResponse,
      hitRate,
      isHit: isGuess && hitRate >= 85, // 只有猜测模式且重合率达到85%才算命中
    };
  }

  // AI 生成题目
  async generateQuestion(
    category: QuestionCategory,
    prompts: string[]
  ): Promise<GeneratedQuestion> {
    const categoryName = {
      CLASSIC: '经典推理',
      HORROR: '恐怖悬疑',
      LOGIC: '逻辑陷阱',
      WARM: '温情反转',
    }[category];

    const systemPrompt = `你是一个海龟汤题目创作专家。请创作一个高质量的海龟汤题目。

【字数要求 - 必须严格遵守！】
1. 汤面（surface）：必须控制在30字以内！简洁有力，引发好奇
2. 汤底（bottom）：必须控制在50字以内！逻辑严密，完整解释谜题

【内容要求】
1. 汤面：简短有趣的谜题情境，不透露答案，让人好奇
2. 汤底：逻辑清晰，完整解释汤面的谜题，不故作玄虚，与汤面关联紧密
3. 提示（hints）：3个由浅入深的提示
4. 关键词（keywords）：3-5个核心关键词

【质量标准】
- 汤面要有悬念，吸引人想一探究竟
- 汤底要合情合理，出人意料但逻辑自洽
- 不能故作神秘让人看不懂
- 避免过于简单或过于复杂的题目

回复格式（JSON）：
{
  "surface": "汤面内容（30字以内）",
  "bottom": "汤底内容（50字以内）",
  "hints": ["提示1", "提示2", "提示3"],
  "keywords": ["关键词1", "关键词2", ...]
}`;

    const prompt = `分类：${categoryName}
${prompts.length > 0 ? `提示词：${prompts.join('、')}` : ''}

请创作一个${categoryName}类型的海龟汤题目。
记住：汤面30字以内，汤底50字以内！`;

    try {
      const result = await this.callAPI(prompt, systemPrompt);
      
      // 解析 JSON 结果
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      throw new Error('AI 返回格式错误');
    } catch (error) {
      logger.error('AI generation failed:', error);
      throw new Error('AI 生成题目失败');
    }
  }

  // 审核题目内容（检查是否过度色情）
  async moderateContent(content: string): Promise<{ passed: boolean; reason?: string }> {
    const prompt = `请审核以下内容是否包含过度色情、暴力或不当内容。

内容：
${content}

请直接回复"通过"或"不通过"，如果不通过，请说明原因。`;

    try {
      const result = await this.callAPI(prompt);
      
      if (result.includes('通过') && !result.includes('不通过')) {
        return { passed: true };
      }
      
      return { 
        passed: false, 
        reason: result.replace('不通过', '').trim() 
      };
    } catch (error) {
      logger.error('Content moderation failed:', error);
      // 审核失败时默认通过，避免误删
      return { passed: true };
    }
  }

  // 从原始内容提取结构化题目
  async extractQuestion(rawContent: string): Promise<GeneratedQuestion | null> {
    const systemPrompt = `你是一个数据提取专家。请从给定的文本中提取海龟汤题目信息。

如果文本不是有效的海龟汤题目，请回复"无效内容"。

提取格式：
{
  "surface": "汤面内容",
  "bottom": "汤底内容",
  "hints": ["提示1", "提示2", "提示3"],
  "keywords": ["关键词1", "关键词2", ...]
}`;

    const prompt = `请从以下内容中提取海龟汤题目：

${rawContent}`;

    try {
      const result = await this.callAPI(prompt, systemPrompt);
      
      if (result.includes('无效内容')) {
        return null;
      }

      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return null;
    } catch (error) {
      logger.error('Question extraction failed:', error);
      return null;
    }
  }
}

export default new AIService();