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

  // 阿里百炼 API
  private async callAlibabaAPI(config: AIConfig, prompt: string, systemPrompt?: string): Promise<string> {
    try {
      const response = await axios.post(
        config.baseUrl || DASHSCOPE_API,
        {
          model: config.model,
          input: {
            messages: [
              ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
              { role: 'user', content: prompt },
            ],
          },
          parameters: {
            result_format: 'message',
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.output.choices[0].message.content;
    } catch (error: any) {
      logger.error('AI API call failed:', {
        error: error.message,
        response: error.response?.data,
      });
      throw new Error(`AI API 调用失败: ${error.message}`);
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
    const systemPrompt = `你是一个海龟汤游戏的裁判。你的任务是判定玩家的回答是否正确。

海龟汤是一种情境推理游戏：
- 汤面：给玩家的谜题情境
- 汤底：真实答案
- 玩家通过提问和猜测来还原真相

判定规则：
1. "是" - 玩家的陈述与核心事实一致
2. "否" - 玩家的陈述与核心事实矛盾
3. "无关" - 玩家的陈述不影响推理
4. "部分正确" - 接近但未完全命中

如果玩家在猜答案，计算重合率（玩家猜测与答案关键词匹配的比例）。
重合率 ≥ 85% 判定为命中。

回复格式：
{
  "answerType": "YES|NO|IRRELEVANT|PARTIAL|CORRECT",
  "response": "给玩家的简短回复（不超过50字）",
  "hitRate": 0-100,
  "matchedKeywords": ["匹配的关键词"]
}`;

    const prompt = `汤面：${question.surface}
汤底：${question.bottom}
关键词：${Array.isArray(question.keywords) ? question.keywords.join('、') : JSON.parse(question.keywords || '[]').join('、')}

玩家${isGuess ? '猜测' : '提问'}：${playerInput}

请判定玩家的回答。`;

    try {
      const result = await this.callAPI(prompt, systemPrompt);
      
      // 解析 JSON 结果
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const hitRate = parsed.hitRate || 0;
        
        return {
          answerType: parsed.answerType as AnswerType,
          aiResponse: parsed.response,
          hitRate,
          isHit: hitRate >= config.game.hitThreshold,
        };
      }

      // 解析失败，返回默认结果
      return {
        answerType: AnswerType.IRRELEVANT,
        aiResponse: '无法确定，请换一种方式提问。',
        hitRate: 0,
        isHit: false,
      };
    } catch (error) {
      logger.error('AI judgment failed:', error);
      throw new Error('AI 判定失败');
    }
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

    const systemPrompt = `你是一个海龟汤题目创作专家。请根据给定的提示词创作一个高质量的题目。

要求：
1. 汤面：简短有趣的谜题情境（50-150字）
2. 汤底：意想不到但又合理的答案（100-300字）
3. 提示：3个由浅入深的提示
4. 关键词：5-10个核心关键词

回复格式（JSON）：
{
  "surface": "汤面内容",
  "bottom": "汤底内容",
  "hints": ["提示1", "提示2", "提示3"],
  "keywords": ["关键词1", "关键词2", ...]
}`;

    const prompt = `分类：${categoryName}
提示词：${prompts.join('、')}

请创作一个${categoryName}类型的海龟汤题目。`;

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