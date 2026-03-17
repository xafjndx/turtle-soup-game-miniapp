// pages/index/index.ts
import { getTop3, startGame, getCategories } from '../../api/index';

Page({
  data: {
    top3: [] as any[],
    categories: [
      { key: 'CLASSIC', name: '经典推理', icon: '🔍', desc: '传统海龟汤，考验逻辑思维' },
      { key: 'HORROR', name: '恐怖悬疑', icon: '👻', desc: '惊悚故事，胆小者慎入' },
      { key: 'LOGIC', name: '逻辑陷阱', icon: '🧩', desc: '烧脑谜题，挑战智商极限' },
      { key: 'WARM', name: '温情反转', icon: '💝', desc: '暖心故事，治愈心灵' },
    ],
    selectedCategory: '',
    selectedSource: 'BANK' as 'BANK' | 'AI_GENERATED',
    loading: false,
    userInfo: null as any,
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    // 刷新用户信息
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.setData({ userInfo });
    }
  },

  async loadData() {
    try {
      const top3 = await getTop3();
      this.setData({ top3 });
    } catch (err) {
      console.error('加载数据失败:', err);
    }
  },

  // 选择分类
  onSelectCategory(e: any) {
    const { category } = e.currentTarget.dataset;
    this.setData({ 
      selectedCategory: this.data.selectedCategory === category ? '' : category 
    });
  },

  // 选择来源
  onSelectSource(e: any) {
    const { source } = e.currentTarget.dataset;
    this.setData({ selectedSource: source });
  },

  // 开始游戏
  async onStartGame() {
    const { selectedCategory, selectedSource } = this.data;

    // 检查登录
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }

    this.setData({ loading: true });

    try {
      const result = await startGame(selectedSource, selectedCategory || undefined);
      
      // 保存会话信息
      wx.setStorageSync('currentSession', result.session);
      wx.setStorageSync('currentQuestion', result.question);

      // 跳转游戏页
      wx.navigateTo({ 
        url: `/pages/game/game?sessionId=${result.session.id}&hasPlayed=${result.hasPlayed}`
      });
    } catch (err: any) {
      wx.showToast({ title: err.message || '开始游戏失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 查看排行榜
  onViewLeaderboard() {
    wx.switchTab({ url: '/pages/leaderboard/leaderboard' });
  },

  // 查看个人中心
  onViewProfile() {
    wx.switchTab({ url: '/pages/profile/profile' });
  },
});