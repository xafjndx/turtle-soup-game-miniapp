# 海龟汤游戏小程序

一款异步回合制海龟汤推理游戏微信小程序。

## 技术栈

- **前端**：微信小程序
- **后端**：Node.js + TypeScript + Express
- **数据库**：MySQL（微信云托管）
- **部署**：微信云托管
- **AI**：阿里百炼 qwen3.5-plus

## 项目结构

```
turtle-soup-game/
├── miniprogram/          # 微信小程序前端
│   ├── pages/            # 页面
│   │   ├── login/        # 登录页
│   │   ├── index/        # 首页
│   │   ├── game/         # 游戏页
│   │   ├── profile/      # 个人中心
│   │   └── leaderboard/  # 排行榜
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
| 题库管理 | 分类抽取、AI生成、爬虫扩充 |
| 排行榜 | 命中率排名、实时更新 |
| 爬虫系统 | 定时抓取、内容审核、自动入库 |
| 后台管理 | 数据统计、题目审核、操作日志 |

## 开发指南

### 环境要求

- Node.js >= 18
- MySQL >= 8.0
- 微信开发者工具

### 本地开发

```bash
# 1. 安装后端依赖
cd server
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填写数据库连接、阿里百炼 API Key 等

# 3. 生成 Prisma 客户端
npx prisma generate

# 4. 运行数据库迁移
npx prisma migrate dev

# 5. 启动后端服务
npm run dev

# 6. 打开微信开发者工具，导入 miniprogram 目录
```

### 环境变量配置

```env
# 服务器配置
PORT=3000
NODE_ENV=development

# 数据库配置（微信云托管 MySQL）
DATABASE_URL="mysql://user:password@localhost:3306/turtle_soup"

# JWT 密钥
JWT_SECRET=your-super-secret-jwt-key

# 微信小程序配置
WECHAT_APPID=your-wechat-appid
WECHAT_SECRET=your-wechat-secret

# 阿里百炼 AI 配置
ALIBABA_DASHSCOPE_API_KEY=your-dashscope-api-key
QWEN_MODEL=qwen3.5-plus

# 管理员密码
ADMIN_PASSWORD=your-admin-password

# 爬虫配置
CRAWLER_ENABLED=true
CRAWLER_CRON="0 4 * * *"
```

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

### 管理后台

| 接口 | 方法 | 说明 |
|------|------|------|
| /api/admin/login | POST | 管理员登录 |
| /api/admin/statistics | GET | 获取统计数据 |
| /api/admin/questions | GET | 获取题目列表 |
| /api/admin/questions/delete | POST | 批量删除题目 |
| /api/admin/crawler/trigger | POST | 手动触发爬虫 |

## 爬虫系统

### 定时任务

- 每天凌晨 4:00 自动执行
- 优先抓取：贴吧-海龟汤吧
- 自动去重、结构化提取、内容审核

### 手动触发

```bash
# 通过管理后台触发
# 或调用 API
curl -X POST http://localhost:3000/api/admin/crawler/trigger \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 爬虫配置

修改 `server/src/services/crawlerService.ts` 中的 `CRAWLER_CONFIG` 配置：

```typescript
const CRAWLER_CONFIG = {
  tieba: {
    forums: ['海龟汤', '海龟汤推理'],
    maxPages: 5,
  },
  // ...
};
```

## 管理后台

访问 `admin/index.html` 打开管理后台：

1. 使用配置的管理员密码登录
2. 查看数据统计概览
3. 管理题目（审核、删除、修改分类）
4. 手动触发爬虫
5. 查看操作日志

## 部署

### 微信云托管部署

1. 在微信云托管控制台创建服务
2. 配置 MySQL 数据库
3. 上传后端代码并部署
4. 配置环境变量
5. 将 miniprogram 目录导入微信开发者工具并上传

### 注意事项

- 生产环境需配置 CORS 白名单
- 配置阿里百炼 API Key 用于 AI 判定
- 定时任务需确保服务持续运行

## License

MIT