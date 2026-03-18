# 微信云托管 Dockerfile
# 构建后端服务

FROM node:18-alpine

WORKDIR /app

# 安装 OpenSSL（Prisma 需要）
RUN apk add --no-cache openssl

# 复制 server 目录的 package 文件
COPY server/package.json server/package-lock.json* ./

# 安装所有依赖（包括 devDependencies 用于构建）
RUN npm install

# 复制服务端代码
COPY server/ ./

# 生成 Prisma Client
RUN npx prisma generate

# 构建 TypeScript
RUN npm run build

# 删除 devDependencies 减小镜像体积（保留 prisma 用于迁移）
RUN npm prune --production

# 暴露端口
EXPOSE 80

# 设置环境变量
ENV PORT=80
ENV NODE_ENV=production

# 启动命令：迁移数据库 -> 运行seed脚本 -> 启动服务
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts && echo 'Starting server...' && node dist/app.js"]