# 微信云托管 Dockerfile
FROM node:18-alpine

WORKDIR /app

# 安装 OpenSSL（Prisma 需要）
RUN apk add --no-cache openssl

# 先复制 prisma schema 和 package.json
COPY package*.json ./
COPY prisma ./prisma/

# 安装依赖并生成 Prisma Client（单独一层，避免缓存问题）
RUN npm ci --only=production && \
    rm -rf node_modules/.prisma && \
    npx prisma generate

# 复制源代码
COPY . .

# 构建 TypeScript
RUN npm run build

# 创建启动脚本
RUN echo '#!/bin/sh\nnpx prisma migrate deploy\nnode dist/app.js' > start.sh && chmod +x start.sh

# 暴露端口
EXPOSE 80

# 启动命令
CMD ["./start.sh"]