// scripts/seed.ts - 初始化测试数据
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始填充测试数据...');

  // 创建测试用户
  const user1 = await prisma.user.upsert({
    where: { username: 'test1' },
    update: {},
    create: {
      username: 'test1',
      nickname: '测试用户1',
      totalGames: 5,
      winCount: 3,
      hitRate: 78.5,
    },
  });

  const user2 = await prisma.user.upsert({
    where: { username: 'test2' },
    update: {},
    create: {
      username: 'test2',
      nickname: '测试用户2',
      totalGames: 10,
      winCount: 7,
      hitRate: 85.2,
    },
  });

  console.log('✅ 创建测试用户');

  // 创建测试题目
  const questions = [
    {
      title: '酒吧的水',
      surface: '一个男人走进酒吧，向酒保要了一杯水。酒保突然拿出一把枪指着他。男人说"谢谢"，然后离开了。',
      bottom: '这个男人打嗝不止，想喝水止嗝。酒保用枪吓他一跳，打嗝就好了，所以他说谢谢。',
      category: 'CLASSIC',
      hints: JSON.stringify(['男人身体不舒服', '水不是目的', '吓一跳有帮助']),
      keywords: JSON.stringify(['打嗝', '吓一跳', '水', '枪']),
      source: 'PLATFORM',
    },
    {
      title: '盲人的晚餐',
      surface: '一个盲人走进餐厅，点了一份牛排。服务员问他要几分熟，盲人说"五分熟"。吃完后，盲人自杀了。',
      bottom: '盲人曾经和妻子约定，如果能治好眼睛就吃五分熟牛排庆祝。他治好了眼睛，发现妻子一直在骗他，他看到的世界和他想象的不一样，绝望自杀。',
      category: 'HORROR',
      hints: JSON.stringify(['牛排有特殊含义', '他曾经不是盲人', '看见真相后崩溃']),
      keywords: JSON.stringify(['盲人', '牛排', '约定', '妻子', '欺骗']),
      source: 'PLATFORM',
    },
    {
      title: '电梯里的死人',
      surface: '一个人住在20楼，每天早上坐电梯下楼。某天电梯坏了，他走楼梯，走到10楼时突然明白了什么，跳楼自杀。',
      bottom: '他杀了他妻子藏在电梯井里。电梯正常时，他看不到尸体。走楼梯时他看到了妻子藏尸的地方，明白尸体已经被发现或即将被发现，绝望自杀。',
      category: 'HORROR',
      hints: JSON.stringify(['电梯有问题', '他杀过人', '楼梯上看到了关键证据']),
      keywords: JSON.stringify(['电梯', '尸体', '妻子', '杀人', '楼梯']),
      source: 'PLATFORM',
    },
    {
      title: '雪地里的脚印',
      surface: '一个猎人走进小木屋，发现地上有两行脚印。他立刻报警。警察来了后，猎人被抓了。',
      bottom: '猎人其实是杀人犯，他伪造了现场。警察发现脚印是同一个人的，而且方向不对，证明他在撒谎。',
      category: 'LOGIC',
      hints: JSON.stringify(['脚印有蹊跷', '猎人是假的', '脚印方向不对']),
      keywords: JSON.stringify(['脚印', '猎人', '伪造', '方向']),
      source: 'PLATFORM',
    },
    {
      title: '最后一封信',
      surface: '老人每天都给妻子写信，妻子从不回信。某天老人不再写信了，一个月后他收到了妻子的回信。',
      bottom: '妻子住在养老院，患有老年痴呆。老人每天写信是希望妻子某天清醒时能看到。老人去世后，护工帮妻子读了一封信，妻子清醒了一瞬间写的回信。',
      category: 'WARM',
      hints: JSON.stringify(['妻子无法正常回信', '写信是一种坚持', '延迟的回复']),
      keywords: JSON.stringify(['信', '老人', '妻子', '痴呆', '爱']),
      source: 'PLATFORM',
    },
  ];

  for (const q of questions) {
    await prisma.question.create({
      data: q,
    });
  }

  console.log('✅ 创建测试题目');

  // 创建提示词库
  const prompts = [
    { category: 'CLASSIC', prompt: '密室' },
    { category: 'CLASSIC', prompt: '时间' },
    { category: 'CLASSIC', prompt: '消失' },
    { category: 'HORROR', prompt: '镜子' },
    { category: 'HORROR', prompt: '深夜' },
    { category: 'HORROR', prompt: '声音' },
    { category: 'LOGIC', prompt: '数学' },
    { category: 'LOGIC', prompt: '顺序' },
    { category: 'LOGIC', prompt: '矛盾' },
    { category: 'WARM', prompt: '家人' },
    { category: 'WARM', prompt: '重逢' },
    { category: 'WARM', prompt: '回忆' },
  ];

  for (const p of prompts) {
    await prisma.promptLibrary.create({
      data: p,
    });
  }

  console.log('✅ 创建提示词库');
  console.log('🎉 测试数据填充完成！');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });