# 微信云托管 Dockerfile
FROM node:18-alpine

WORKDIR /app

# 安装 OpenSSL（Prisma 需要）
RUN apk add --no-cache openssl

# 安装依赖
COPY package*.json ./
RUN npm ci --only=production

# 复制源代码
COPY . .

# 生成 Prisma Client
RUN npx prisma generate

# 构建 TypeScript
RUN npm run build

# 运行数据库迁移（需要在启动时执行）
# 创建启动脚本
RUN echo '#!/bin/sh\nnpx prisma migrate deploy\nnode dist/app.js' > start.sh && chmod +x start.sh

# 暴露端口
EXPOSE 80

# 启动命令
CMD ["./start.sh"]