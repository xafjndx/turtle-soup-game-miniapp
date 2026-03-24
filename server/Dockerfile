# 微信云托管 Dockerfile
FROM node:18-alpine

WORKDIR /app

# 安装 OpenSSL（Prisma 需要）
RUN apk add --no-cache openssl

# 先复制 prisma schema 和 package.json
COPY package*.json ./
COPY prisma ./prisma/

# 安装依赖并生成 Prisma Client（需要 devDependencies 用于构建）
RUN npm install && \
    rm -rf node_modules/.prisma && \
    npx prisma generate

# 复制源代码
COPY . .

# 构建 TypeScript
RUN npm run build

# 创建启动脚本
RUN printf '#!/bin/sh\nnpx prisma migrate deploy\nnode dist/app.js\n' > start.sh && chmod +x start.sh

# 设置默认端口为 80
ENV PORT=80

# 暴露端口
EXPOSE 80

# 启动命令
CMD ["./start.sh"]