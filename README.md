# 海龟汤游戏小程序

一款异步回合制海龟汤推理游戏微信小程序。

## 技术栈

- **前端**：微信小程序
- **后端**：Node.js + TypeScript + Express
- **数据库**：MySQL（微信云托管）/ SQLite（开发环境）
- **部署**：微信云托管
- **AI**：阿里百炼 qwen3.5-plus

## 合规声明

本项目已按照微信小程序审核要求完成合规改造：

### ✅ 已完成的合规改进

| 改进项 | 状态 | 说明 |
|--------|------|------|
| 网络爬虫功能 | ✅ 已移除 | 为符合《网络安全法》要求，已移除爬虫功能 |
| AI内容审核 | ✅ 已完善 | AI生成的题目默认状态为PENDING，需人工审核 |
| 隐私政策 | ✅ 已添加 | 完整的隐私政策页面，明确数据使用范围 |
| 未成年人保护 | ✅ 已添加 | 内容分级提示，建议14岁以上使用 |
| 数据安全 | ✅ 已完善 | .env.example使用安全占位符，敏感信息不入库 |

### 题目来源（合规方式）

1. **官方投稿** - 管理员手动添加
2. **AI辅助生成** - 生成后需人工审核才能上架
3. **用户原创投稿** - 需人工审核（开发中）

## 项目结构

```
turtle-soup-game/
├── miniprogram/          # 微信小程序前端
│   ├── pages/            # 页面
│   │   ├── login/        # 登录页
│   │   ├── index/        # 首页
│   │   ├── game/         # 游戏页
│   │   ├── profile/      # 个人中心
│   │   ├── leaderboard/  # 排行榜
│   │   └── privacy/      # 隐私政策
│   ├── api/              # API 接口
│   ├── utils/            # 工具函数
│   └── app.ts
│
├── server/               # 后端服务
│   ├── src/
│   │   ├── controllers/  # 控制器
│   │   ├── services/     # 业务逻辑
│   │   ├── routes/       # 路由
│   │   ├── middlewares/  # 中间件
│   │   ├── utils/        # 工具函数
│   │   ├── config/       # 配置
│   │   └── app.ts        # 应用入口
│   ├── prisma/           # 数据库 Schema
│   └── package.json
│
├── admin/                # 管理后台（Web）
│   └── index.html
│
└── README.md
```

## 功能模块

| 模块 | 功能 |
|------|------|
| 用户系统 | 注册/登录、微信授权、个人统计 |
| 游戏核心 | 回合制游戏、语音/文字输入、AI判定 |
| 题库管理 | 分类抽取、AI生成（人工审核）、官方投稿 |
| 排行榜 | 命中率排名、实时更新 |
| 后台管理 | 数据统计、题目审核、操作日志 |
| 隐私保护 | 隐私政策、数据管理、未成年人保护 |

## 开发指南

### 环境要求

- Node.js >= 18
- SQLite（开发环境）/ MySQL >= 8.0（生产环境）
- 微信开发者工具

### 本地开发

```bash
# 1. 安装后端依赖
cd server
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填写必要配置

# 3. 生成 Prisma 客户端
npx prisma generate

# 4. 运行数据库迁移
npx prisma migrate dev

# 5. 启动后端服务
npm run dev

# 6. 打开微信开发者工具，导入 miniprogram 目录
```

### 环境变量配置

参考 `server/.env.example` 文件。

**重要安全提醒：**
- 生产环境必须使用 HTTPS
- JWT_SECRET 必须使用强随机字符串
- 请勿将 `.env` 文件提交到代码仓库

## API 接口

### 用户相关

| 接口 | 方法 | 说明 |
|------|------|------|
| /api/user/login | POST | 用户登录/注册 |
| /api/user/profile | GET | 获取用户信息 |
| /api/leaderboard | GET | 获取排行榜 |

### 游戏相关

| 接口 | 方法 | 说明 |
|------|------|------|
| /api/game/start | POST | 开始游戏 |
| /api/game/session/:id/round | POST | 提交回合 |
| /api/game/session/:id/hint | POST | 使用提示 |
| /api/game/session/:id/end | POST | 结束游戏 |

### 题目管理

| 接口 | 方法 | 说明 |
|------|------|------|
| /api/question/categories | GET | 获取题目分类 |
| /api/question/draw | GET | 抽取题目 |
| /api/question/generate | POST | AI生成题目（需审核） |

### 管理后台

| 接口 | 方法 | 说明 |
|------|------|------|
| /api/admin/login | POST | 管理员登录 |
| /api/admin/statistics | GET | 获取统计数据 |
| /api/admin/questions | GET | 获取题目列表 |
| /api/admin/question/:id/status | PUT | 更新题目状态（审核） |
| /api/admin/questions/delete | POST | 批量删除题目 |

## 管理后台

访问 `admin/index.html` 打开管理后台：

1. 使用配置的管理员密码登录
2. 查看数据统计概览
3. 管理题目（审核AI生成的题目、删除、修改分类）
4. 查看操作日志

### 题目审核流程

1. AI生成题目 → 状态：**PENDING**（待审核）
2. 管理员审核 → 状态：**APPROVED**（已通过）/ **REJECTED**（已拒绝）
3. 只有 **APPROVED** 状态的题目才能被玩家抽取

## 部署

### 微信云托管部署

1. 在微信云托管控制台创建服务
2. 配置 MySQL 数据库
3. 上传后端代码并部署
4. 配置环境变量
5. 将 miniprogram 目录导入微信开发者工具并上传

### 注意事项

- 生产环境必须使用 HTTPS
- 配置阿里百炼 API Key 用于 AI 判定
- 配置微信小程序 AppID 和 AppSecret
- 所有 AI 生成的题目需人工审核后才能上架

## 隐私保护

### 数据收集范围

- 微信 OpenID（用于身份识别）
- 用户昵称和头像（用户可选授权）
- 游戏记录（用于统计和排行榜）
- 语音数据（仅用于即时识别，不存储）

### 用户权利

- 查看个人信息
- 更正个人信息
- 删除个人信息
- 注销账号

详见 `miniprogram/pages/privacy/privacy.wxml`

## License

MIT