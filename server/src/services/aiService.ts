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

判定规则：
1. "YES" - 玩家的陈述与汤底中的核心事实一致
2. "NO" - 玩家的陈述与汤底矛盾
3. "IRRELEVANT" - 玩家的陈述与汤底无关，不影响推理
4. "PARTIAL" - 部分正确，接近但未完全命中

猜测判定：
- 计算玩家猜测与汤底关键词的匹配度
- 匹配度 ≥ 85% 判定为 CORRECT（完全猜中）

回复格式（JSON）：
{
  "answerType": "YES|NO|IRRELEVANT|PARTIAL|CORRECT",
  "response": "简短回复，只能是：是、否、无关、部分正确，或恭喜猜中",
  "hitRate": 0-100
}`;

    const prompt = `汤面：${question.surface}
汤底：${question.bottom}
关键词：${Array.isArray(question.keywords) ? question.keywords.join('、') : JSON.parse(question.keywords || '[]').join('、')}

玩家${isGuess ? '猜测' : '提问'}：${playerInput}

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

    // 计算匹配率
    const hitRate = keywords.length > 0 
      ? Math.round((matchedKeywords.length / keywords.length) * 100)
      : 0;

    let answerType: AnswerType = 'IRRELEVANT';
    let aiResponse = '这个问题与汤底关系不大，请换个角度提问。';

    // 只有在猜测模式下才判断是否正确
    if (isGuess) {
      // 必须重合率达到85%以上才算猜对
      if (hitRate >= 85) {
        answerType = 'CORRECT';
        aiResponse = '恭喜你猜对了！';
      } else if (hitRate >= 50) {
        answerType = 'PARTIAL';
        aiResponse = `接近了，当前重合率${hitRate}%，需要达到85%才算猜对。`;
      } else if (matchedKeywords.length > 0) {
        answerType = 'PARTIAL';
        aiResponse = `有些关键词对了，但重合率只有${hitRate}%，继续努力！`;
      } else {
        answerType = 'NO';
        aiResponse = '这个猜测不对，请再想想。';
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
      isHit: isGuess && hitRate >= config.game.hitThreshold, // 只有猜测模式且重合率达标才算命中
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

    const systemPrompt = `你是一个海龟汤题目创作专家。请根据给定的提示词创作一个高质量的题目。

【重要要求】
1. 汤面（surface）：简短有趣的谜题情境，50-100字，不要透露答案
2. 汤底（bottom）：意想不到但又合理的答案，80-150字，简洁明了
3. 汤面和汤底要逻辑连贯，不能生搬硬套
4. 提示（hints）：3个由浅入深的提示
5. 关键词（keywords）：5-8个核心关键词

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