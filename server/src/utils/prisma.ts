import { PrismaClient } from '@prisma/client';

// 创建 Prisma 客户端实例
const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' },
  ],
});

// 查询日志
prisma.$on('query', (e) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('Query: ' + e.query);
    console.log('Params: ' + e.params);
    console.log('Duration: ' + e.duration + 'ms');
  }
});

// 优雅关闭
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;