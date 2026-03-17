// pages/profile/profile.ts
import { getUserProfile, getGameHistory } from '../../api/index';

Page({
  data: {
    userInfo: null as any,
    history: [] as any[],
    loading: true,
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  async loadData() {
    try {
      const userInfo = await getUserProfile();
      const history = await getGameHistory(10);
      
      this.setData({
        userInfo,
        history,
        loading: false,
      });
    } catch (err) {
      console.error('加载数据失败:', err);
      this.setData({ loading: false });
    }
  },

  // 退出登录
  onLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          wx.navigateTo({ url: '/pages/login/login' });
        }
      },
    });
  },

  // 查看排行榜
  onViewLeaderboard() {
    wx.switchTab({ url: '/pages/leaderboard/leaderboard' });
  },

  // 下拉刷新
  async onPullDownRefresh() {
    await this.loadData();
    wx.stopPullDownRefresh();
  },
});