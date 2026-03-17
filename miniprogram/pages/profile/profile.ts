// pages/profile/profile.ts
import { getUserProfile, getGameHistory, checkIsAdmin, exportUserData, deleteAccount } from '../../api/index';

Page({
  data: {
    userInfo: null as any,
    history: [] as any[],
    loading: true,
    isAdmin: false,
    showDeleteModal: false,
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  async loadData() {
    try {
      const [userInfo, history, adminInfo] = await Promise.all([
        getUserProfile(),
        getGameHistory(10),
        checkIsAdmin().catch(() => ({ isAdmin: false })),
      ]);
      
      this.setData({
        userInfo,
        history,
        isAdmin: adminInfo.isAdmin,
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

  // 进入管理后台
  onEnterAdmin() {
    wx.navigateTo({ url: '/pages/admin/admin' });
  },

  // 查看隐私政策
  onViewPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' });
  },

  // 导出个人数据
  async onExportData() {
    wx.showModal({
      title: '导出数据',
      content: '将导出您的个人信息和游戏记录，数据将以文本形式展示，您可以截图或复制保存。',
      confirmText: '导出',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '导出中...' });
          try {
            const data = await exportUserData();
            wx.hideLoading();
            
            // 格式化数据
            const text = `
========== 海龟汤游戏 - 个人数据导出 ==========
导出时间：${data.exportTime}

【基本信息】
用户名：${data.user.username}
昵称：${data.user.nickname || '未设置'}
注册时间：${data.user.createdAt}
总游戏数：${data.user.totalGames}
猜中次数：${data.user.winCount}
命中率：${data.user.hitRate}%
总游戏时长：${data.user.totalPlayTime} 分钟

【游戏记录】（共 ${data.gameHistory.length} 条）
${data.gameHistory.map((h: any, i: number) => `
${i + 1}. ${h.result === 'WIN' ? '✓ 胜利' : '✗ 失败'}
   题目：${h.question}
   分类：${h.category}
   时间：${h.playedAt}
   用时：${h.playTime}分钟 | 提示：${h.hintUsed}次
`).join('')}
========== 数据导出完成 ==========
            `.trim();

            // 显示数据
            wx.showModal({
              title: '数据已导出',
              content: text.slice(0, 500) + (text.length > 500 ? '...(数据过长，请复制保存)' : ''),
              confirmText: '复制全部',
              success: (r) => {
                if (r.confirm) {
                  wx.setClipboardData({
                    data: text,
                    success: () => {
                      wx.showToast({ title: '已复制到剪贴板', icon: 'success' });
                    }
                  });
                }
              }
            });
          } catch (err: any) {
            wx.hideLoading();
            wx.showToast({ title: err.message || '导出失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 显示注销确认弹窗
  onShowDeleteModal() {
    this.setData({ showDeleteModal: true });
  },

  // 隐藏注销确认弹窗
  onHideDeleteModal() {
    this.setData({ showDeleteModal: false });
  },

  // 确认注销账号
  async onConfirmDelete() {
    wx.showModal({
      title: '⚠️ 最后确认',
      content: '注销后，您的所有数据将被永久删除且无法恢复。确定要继续吗？',
      confirmText: '确认注销',
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '注销中...' });
          try {
            await deleteAccount();
            wx.hideLoading();
            
            // 清除本地数据
            wx.clearStorageSync();
            
            wx.showModal({
              title: '注销成功',
              content: '您的账号已注销，所有数据已删除。感谢您的使用！',
              showCancel: false,
              success: () => {
                wx.reLaunch({ url: '/pages/login/login' });
              }
            });
          } catch (err: any) {
            wx.hideLoading();
            wx.showToast({ title: err.message || '注销失败', icon: 'none' });
          }
        }
      }
    });
    this.setData({ showDeleteModal: false });
  },

  // 下拉刷新
  async onPullDownRefresh() {
    await this.loadData();
    wx.stopPullDownRefresh();
  },
});