// pages/leaderboard/leaderboard.ts
import { getLeaderboard } from '../../api/index';

Page({
  data: {
    leaderboard: [] as any[],
    loading: true,
    myRank: null as number | null,
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  async loadData() {
    try {
      const leaderboard = await getLeaderboard(100);
      
      // 查找我的排名
      const userInfo = wx.getStorageSync('userInfo');
      let myRank = null;
      if (userInfo) {
        const index = leaderboard.findIndex((item: any) => item.id === userInfo.id);
        if (index !== -1) {
          myRank = index + 1;
        }
      }

      this.setData({
        leaderboard,
        myRank,
        loading: false,
      });
    } catch (err) {
      console.error('加载排行榜失败:', err);
      this.setData({ loading: false });
    }
  },

  // 下拉刷新
  async onPullDownRefresh() {
    await this.loadData();
    wx.stopPullDownRefresh();
  },
});