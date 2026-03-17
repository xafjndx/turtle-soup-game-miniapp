// pages/admin/admin.ts
import { getAdminStatistics, getPendingQuestions, updateQuestionStatus } from '../../api/index';

Page({
  data: {
    stats: null as any,
    pendingQuestions: [] as any[],
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
      const [stats, questions] = await Promise.all([
        getAdminStatistics(),
        getPendingQuestions(),
      ]);

      this.setData({
        stats,
        pendingQuestions: questions,
        loading: false,
      });
    } catch (err: any) {
      console.error('加载数据失败:', err);
      if (err.message?.includes('未授权') || err.message?.includes('管理员')) {
        wx.showModal({
          title: '无权限',
          content: '您不是管理员，无法访问此页面',
          showCancel: false,
          success: () => {
            wx.navigateBack();
          }
        });
      }
      this.setData({ loading: false });
    }
  },

  // 审核通过
  async onApprove(e: any) {
    const { id } = e.currentTarget.dataset;
    try {
      await updateQuestionStatus(id, 'APPROVED');
      wx.showToast({ title: '已通过', icon: 'success' });
      this.loadData();
    } catch (err: any) {
      wx.showToast({ title: err.message || '操作失败', icon: 'none' });
    }
  },

  // 拒绝
  async onReject(e: any) {
    const { id } = e.currentTarget.dataset;
    try {
      await updateQuestionStatus(id, 'REJECTED');
      wx.showToast({ title: '已拒绝', icon: 'success' });
      this.loadData();
    } catch (err: any) {
      wx.showToast({ title: err.message || '操作失败', icon: 'none' });
    }
  },

  // 下拉刷新
  async onPullDownRefresh() {
    await this.loadData();
    wx.stopPullDownRefresh();
  },
});