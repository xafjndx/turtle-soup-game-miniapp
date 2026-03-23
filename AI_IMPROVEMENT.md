# AI 判定模块优化方案

## 🔍 当前问题分析

### 问题 1：AI Prompt 不够严格
- 虽然有判定规则，但 AI 可能因为 prompt 太长而忽略细节
- 85% 的阈值对 Qwen3.5-Plus 来说可能过于宽松

### 问题 2：Fallback 机制太简单
- 当 AI 调用失败时，只使用关键词匹配
- 缺乏语义理解，容易误判

### 问题 3：缺少判定一致性
- 没有记录历史判定，可能导致前后不一致

---

## ✅ 优化方案

### 方案 A：增强 AI Prompt（推荐）

**改进点：**
1. 使用更结构化的 Prompt 格式
2. 强调"不能只匹配关键词"
3. 提高判定阈值到 90%
4. 添加判定理由，方便调试

**修改文件：** `server/src/services/aiService.ts`

**关键改动：**
```typescript
// 1. 提高判定阈值
const JUDGMENT_THRESHOLD = 90; // 从 85 提升到 90

// 2. 增强 System Prompt
const systemPrompt = `你是一个严格的海龟汤裁判。

【绝对禁止】
❌ 不能透露汤底原文
❌ 不能因为玩家提到某个词就判定猜中
❌ 不能给暗示

【猜测判定标准】
必须同时满足以下条件才能判定 CORRECT：
1. 理解核心真相（20 分）
2. 背景要素准确（20 分）
3. 人物关系理清（20 分）
4. 关键行为还原（20 分）
5. 因果逻辑完整（20 分）

总分 ≥ 90 分才能判定猜中！
`;

// 3. 添加历史判定记录
async judgeAnswer(
  question: {...},
  playerInput: string,
  isGuess: boolean,
  roundHistory?: Array<{input: string, answerType: string}>
)
```

---

### 方案 B：改进 Fallback 逻辑

**当前问题：** Fallback 只做简单关键词匹配

**改进方案：**
```typescript
private fallbackJudgment(question, playerInput, isGuess) {
  // 1. 语义相似度检查（简单版）
  const similarity = this.calculateSemanticSimilarity(
    playerInput,
    question.bottom
  );
  
  // 2. 关键要素覆盖检查
  const elementsCovered = this.checkKeyElements(
    playerInput,
    question.bottom
  );
  
  // 3. 综合判定
  if (similarity > 0.8 && elementsCovered > 0.8) {
    return { answerType: 'CORRECT', hitRate: 90 };
  } else if (similarity > 0.6) {
    return { answerType: 'PARTIAL', hitRate: 60 };
  } else {
    return { answerType: 'NO', hitRate: 30 };
  }
}
```

---

### 方案 C：添加判定缓存

**目的：** 避免相同问题得到不同答案

**实现：**
```typescript
// 缓存最近 10 轮的判定结果
private judgmentCache = new Map<string, JudgmentResult>();

async judgeAnswer(...) {
  // 生成问题指纹
  const fingerprint = `${question.id}:${playerInput}`;
  
  // 检查缓存
  if (this.judgmentCache.has(fingerprint)) {
    return this.judgmentCache.get(fingerprint);
  }
  
  // 判定并缓存
  const result = await this.callAI(...);
  this.judgmentCache.set(fingerprint, result);
  
  // 保持缓存大小
  if (this.judgmentCache.size > 10) {
    this.judgmentCache.delete(this.judgmentCache.keys().next().value);
  }
  
  return result;
}
```

---

## 🚀 推荐实施步骤

### 第一步：增强 AI Prompt（立即实施）

修改 `aiService.ts` 中的 `judgeAnswer` 方法：

1. 提高阈值到 90%
2. 使用更严格的 System Prompt
3. 添加判定理由输出

### 第二步：添加历史判定记录（可选）

修改 `gameController.ts`，传递历史回合记录给 AI

### 第三步：改进 Fallback（可选）

增强 fallback 逻辑，添加简单的语义分析

---

## 📝 具体代码修改

### 修改 1：aiService.ts - 增强 Prompt

```typescript
async judgeAnswer(
  question: { surface: string; bottom: string; keywords: string[] },
  playerInput: string,
  isGuess: boolean
): Promise<JudgmentResult> {
  const systemPrompt = `你是严格的海龟汤裁判。

【绝对禁止】
❌ 不能透露汤底原文
❌ 不能因玩家提到某词就判定猜中
❌ 不能给暗示

【猜测判定 - 五维评估】
① 核心真相 (20 分) - 是否理解故事的核心/反转点
② 背景要素 (20 分) - 时间地点情境是否准确
③ 人物关系 (20 分) - 人物关系是否理清
④ 关键行为 (20 分) - 关键动作事件是否还原
⑤ 因果逻辑 (20 分) - 前因后果逻辑链是否完整

【判定标准】
• 90-100 分 → CORRECT（猜中）
• 70-89 分  → PARTIAL（接近）
• 40-69 分  → PARTIAL（部分对）
• 0-39 分   → NO（不对）

【警告】
以下情况不能判定 CORRECT：
⚠️ 只提到汤底中的某个词
⚠️ 只理解部分，没理解全貌
⚠️ 描述过于笼统（如"他死了"）
⚠️ 没说"为什么"，只说"是什么"

回复 JSON：
{
  "answerType": "YES|NO|IRRELEVANT|PARTIAL|CORRECT",
  "response": "简短回复（≤20 字）",
  "hitRate": 0-100,
  "analysis": {
    "coreTruth": 0-20,
    "background": 0-20,
    "relationships": 0-20,
    "actions": 0-20,
    "causality": 0-20,
    "reasoning": "一句话判定理由"
  }
}`;

  const prompt = `汤面：${question.surface}
汤底：${question.bottom}
关键词：${question.keywords.join('、')}

玩家${isGuess ? '猜测' : '提问'}：${playerInput}

${isGuess ? '【最终猜测！严格五维评估，≥90 分才判猜中】' : '【普通提问，判断对错】'}

请判定并回复 JSON。不能透露汤底！`;

  // ... AI 调用和解析
}
```

### 修改 2：aiService.ts - 提高阈值

```typescript
// 在解析结果后
return {
  answerType: parsed.answerType as AnswerType,
  aiResponse,
  hitRate,
  isHit: hitRate >= 90, // 从 85 提升到 90
};
```

---

## 🎯 测试建议

修改后，用以下测试用例验证：

### 测试 1：不完整猜测
- **汤底**："小明因为考试不及格，害怕被父母骂，所以自杀了"
- **玩家**："小明死了"
- **期望**：NO 或 PARTIAL（30-50 分），因为没说原因

### 测试 2：部分正确
- **玩家**："小明因为学习压力自杀"
- **期望**：PARTIAL（70-80 分），接近但不完整

### 测试 3：完整猜中
- **玩家**："小明考试不及格，怕父母骂，所以自杀"
- **期望**：CORRECT（≥90 分）

---

需要我帮你实施这些改进吗？我可以：
1. 直接修改 `aiService.ts` 文件
2. 更新配置阈值
3. 测试修改后的效果
