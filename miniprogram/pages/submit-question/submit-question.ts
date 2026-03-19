// pages/submit-question/submit-question.ts
import { submitQuestion, getSubmitLeaderboard, SubmitLeaderboardItem } from '../../api/index';

const app = getApp<IAppOption>();

Page({
  data: {
    title: '',
    surface: '',
    bottom: '',
    category: 'CLASSIC',
    hints: ['', '', ''],
    keywords: '',
    submitting: false,
    leaderboard: [] as SubmitLeaderboardItem[],
    categories: [
      { value: 'CLASSIC', label: '经典推理', desc: '传统海龟汤，逻辑清晰' },
      { value: 'HORROR', label: '恐怖悬疑', desc: '带有恐怖元素，需年满18岁' },
      { value: 'LOGIC', label: '逻辑陷阱', desc: '需要巧妙思维才能解开' },
      { value: 'WARM', label: '温情反转', desc: '温馨感人，出人意料' },
    ],
  },

  onLoad() {
    this.loadLeaderboard();
  },

  async loadLeaderboard() {
    try {
      const leaderboard = await getSubmitLeaderboard(10);
      this.setData({ leaderboard });
    } catch (err) {
      console.error('加载投稿排行失败:', err);
    }
  },

  // 输入标题
  onInputTitle(e: any) {
    this.setData({ title: e.detail.value });
  },

  // 输入汤面
  onInputSurface(e: any) {
    this.setData({ surface: e.detail.value });
  },

  // 输入汤底
  onInputBottom(e: any) {
    this.setData({ bottom: e.detail.value });
  },

  // 选择分类
  onSelectCategory(e: any) {
    this.setData({ category: e.currentTarget.dataset.value });
  },

  // 输入提示
  onInputHint(e: any) {
    const index = e.currentTarget.dataset.index;
    const hints = [...this.data.hints];
    hints[index] = e.detail.value;
    this.setData({ hints });
  },

  // 输入关键词
  onInputKeywords(e: any) {
    this.setData({ keywords: e.detail.value });
  },

  // 提交投稿
  async onSubmit() {
    const { title, surface, bottom, category, hints, keywords, submitting } = this.data;

    // 检查登录状态
    if (!wx.getStorageSync('token')) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      setTimeout(() => {
        wx.navigateTo({ url: '/pages/login/login' });
      }, 1000);
      return;
    }

    // 验证必填字段
    if (!surface.trim()) {
      wx.showToast({ title: '请输入汤面', icon: 'none' });
      return;
    }
    if (!bottom.trim()) {
      wx.showToast({ title: '请输入汤底', icon: 'none' });
      return;
    }
    if (surface.length < 20) {
      wx.showToast({ title: '汤面至少20个字符', icon: 'none' });
      return;
    }
    if (bottom.length < 20) {
      wx.showToast({ title: '汤底至少20个字符', icon: 'none' });
      return;
    }

    if (submitting) return;

    this.setData({ submitting: true });

    try {
      // 解析关键词
      const keywordList = keywords
        .split(/[,，、\n]/)
        .map((k: string) => k.trim())
        .filter((k: string) => k);

      // 过滤空提示
      const hintList = hints.filter((h: string) => h.trim());

      await submitQuestion({
        title: title.trim(),
        surface: surface.trim(),
        bottom: bottom.trim(),
        category,
        hints: hintList.length > 0 ? hintList : ['暂无提示'],
        keywords: keywordList.length > 0 ? keywordList : ['海龟汤'],
      });

      wx.showModal({
        title: '投稿成功',
        content: '感谢您的投稿！题目已提交审核，审核通过后将自动加入题库。',
        showCancel: false,
        success: () => {
          // 清空表单
          this.setData({
            title: '',
            surface: '',
            bottom: '',
            category: 'CLASSIC',
            hints: ['', '', ''],
            keywords: '',
          });
          // 返回上一页
          wx.navigateBack();
        }
      });
    } catch (err: any) {
      wx.showToast({ title: err.message || '投稿失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  // 查看投稿须知
  onViewGuide() {
    wx.showModal({
      title: '投稿须知',
      content: '1. 汤面应简洁有趣，引发好奇\n2. 汤底要出人意料但合情合理\n3. 避免涉及敏感、违法内容\n4. 投稿需审核通过后才会入库\n5. 优秀投稿可能会获得奖励',
      showCancel: false,
      confirmText: '知道了',
    });
  },
});