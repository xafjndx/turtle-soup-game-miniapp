// prisma/seed.ts - 初始化题目数据
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始填充题目数据...');

  // 10道经典海龟汤题目
  const questions = [
    {
      title: '海龟汤',
      surface: '一个人在餐厅点了海龟汤，吃完后大哭，然后自杀了。为什么？',
      bottom: '这个人曾经和妻子遭遇海难，漂流到荒岛上。为了生存，同伴给他喝"海龟汤"，但实际上那是他妻子的肉。现在他终于喝到真正的海龟汤，发现味道完全不同，意识到自己当年吃了妻子，崩溃自杀。',
      category: 'CLASSIC',
      hints: JSON.stringify(['他和谁一起遭遇海难？', '他当年吃了什么？', '为什么现在才知道真相？']),
      keywords: JSON.stringify(['海难', '妻子', '吃人肉', '真相', '海龟汤']),
      source: 'PLATFORM',
    },
    {
      title: '酒吧的水',
      surface: '一个男人走进酒吧，向酒保要了一杯水。酒保突然拿出一把枪指着他。男人说"谢谢"，然后离开了。',
      bottom: '这个男人打嗝不止，想喝水止嗝。酒保看出来了，故意用枪吓他一跳，打嗝就好了，所以他说谢谢。',
      category: 'CLASSIC',
      hints: JSON.stringify(['男人身体有什么问题？', '水不是目的', '吓一跳有什么效果？']),
      keywords: JSON.stringify(['打嗝', '吓一跳', '水', '枪']),
      source: 'PLATFORM',
    },
    {
      title: '电梯',
      surface: '一个人住在14楼，每天早上坐电梯下楼。某天回家时他坐电梯到7楼，然后走楼梯上14楼。为什么？',
      bottom: '他是个侏儒，够不到14楼的按钮。最高只能按到7楼的按钮。如果下雨天有别人在电梯里或者带了伞，他就可以让人帮忙按14楼。',
      category: 'CLASSIC',
      hints: JSON.stringify(['他的身高有问题', '电梯按钮的设计', '为什么下雨天不同？']),
      keywords: JSON.stringify(['侏儒', '身高', '按钮', '7楼']),
      source: 'PLATFORM',
    },
    {
      title: '盲人和肉',
      surface: '一个盲人在海边散步，遇到一个卖熟肉的小贩。他买了一份吃完后，跳海自杀了。',
      bottom: '盲人曾经遭遇海难，在救生艇上和同伴一起吃"海鸥肉"求生。后来他恢复了一些视力，在海边看到真正的海鸥，发现自己当年吃的不是海鸥肉，而是死去同伴的肉，崩溃自杀。',
      category: 'HORROR',
      hints: JSON.stringify(['他曾经遭遇海难', '海鸥肉是关键', '他看到了什么？']),
      keywords: JSON.stringify(['海难', '海鸥', '同伴', '吃人肉']),
      source: 'PLATFORM',
    },
    {
      title: '半夜敲门',
      surface: '半夜有人敲门，主人不开。第二天发现门口躺着一个人，已经死了。主人说：幸好昨晚没开门。',
      bottom: '主人曾经被入室抢劫过，所以不敢开门。门口躺着的是被通缉的杀人犯，他受伤了想求救。如果主人开门，就会被杀人犯杀死。所以主人说幸好没开门。',
      category: 'CLASSIC',
      hints: JSON.stringify(['主人为什么不敢开门？', '门口的人是谁？', '如果开门会发生什么？']),
      keywords: JSON.stringify(['杀人犯', '不开门', '幸存']),
      source: 'PLATFORM',
    },
    {
      title: '最后的晚餐',
      surface: '三个人一起吃饭，第二天其中两个人死了。活着的人说：都怪我选错了。为什么？',
      bottom: '他们被困在山上，食物耗尽。其中一个人提议：每人切下一块肉一起煮了吃，用抽签决定切哪块。活着的人作弊让另外两人抽到了致命部位，他吃的是自己的小指。下山后发现另外两人因失血过多死在山上。',
      category: 'HORROR',
      hints: JSON.stringify(['他们被困在哪里？', '吃的是什么肉？', '抽签有什么猫腻？']),
      keywords: JSON.stringify(['被困', '吃人肉', '抽签', '作弊']),
      source: 'PLATFORM',
    },
    {
      title: '灯塔',
      surface: '一个人站在灯塔上，关了灯，然后跳海自杀了。',
      bottom: '他是灯塔看守人，某天晚上忘记开灯，导致一艘船触礁沉没，船上都是人。他无法原谅自己的疏忽害死了这么多人，内疚自杀。',
      category: 'CLASSIC',
      hints: JSON.stringify(['灯塔的作用是什么？', '关灯会有什么后果？', '他为什么内疚？']),
      keywords: JSON.stringify(['灯塔', '沉船', '内疚', '疏忽']),
      source: 'PLATFORM',
    },
    {
      title: '雪人',
      surface: '小女孩堆了一个雪人，第二天雪人不见了，小女孩哭了。妈妈说：雪人去天堂了。小女孩说：不可能。为什么？',
      bottom: '小女孩不是在哭雪人融化，而是在哭雪人里面埋着她杀死的哥哥。妈妈说雪人去天堂，但小女孩知道哥哥是被她杀死的，不可能去天堂。',
      category: 'HORROR',
      hints: JSON.stringify(['雪人里面有什么？', '小女孩为什么哭？', '天堂和什么有关？']),
      keywords: JSON.stringify(['尸体', '哥哥', '谋杀', '雪人']),
      source: 'PLATFORM',
    },
    {
      title: '两个苹果',
      surface: '桌上放着两个苹果，一个人拿起一个吃了一口，然后死了。另一个人拿起另一个苹果也吃了一口，却没事。为什么？',
      bottom: '毒药涂在苹果刀上，不是苹果本身。第一个人切开苹果时毒药沾到果肉，第二个人直接啃没用到刀，所以没事。',
      category: 'LOGIC',
      hints: JSON.stringify(['毒药在哪里？', '他们怎么吃苹果的？', '工具是关键']),
      keywords: JSON.stringify(['毒药', '苹果刀', '吃法']),
      source: 'PLATFORM',
    },
    {
      title: '生日快乐',
      surface: '生日派对上，寿星吹灭蜡烛后，所有人都死了。为什么？',
      bottom: '他们在潜水艇里举办派对。寿星吹灭蜡烛消耗了最后的氧气，潜水艇里的人全部窒息而死。',
      category: 'LOGIC',
      hints: JSON.stringify(['派对在哪里举办？', '吹蜡烛有什么影响？', '环境是密闭的吗？']),
      keywords: JSON.stringify(['潜水艇', '氧气', '窒息']),
      source: 'PLATFORM',
    },
  ];

  let count = 0;
  for (const q of questions) {
    const existing = await prisma.question.findFirst({
      where: { title: q.title }
    });
    
    if (!existing) {
      await prisma.question.create({ data: q });
      count++;
      console.log(`✅ 添加题目: ${q.title}`);
    } else {
      console.log(`⏭️ 题目已存在: ${q.title}`);
    }
  }

  console.log(`🎉 完成！共添加 ${count} 道题目`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });