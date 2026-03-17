// pages/login/login.ts
import { login, wechatLogin, getUserList, getTop3 } from '../../api/index';

interface User {
  id: string;
  username: string;
  nickname?: string;
  avatarUrl?: string;
}

const app = getApp<IAppOption>();

Page({
  data: {
    username: '',
    isNewUser: true,
    existingUsers: [] as User[],
    top3: [] as any[],
    loading: false,
    showPrivacyModal: false, // 隐私政策弹窗
  },

  onLoad() {
    // 检查隐私政策同意状态
    this.checkPrivacyAgreed();
  },

  onShow() {
    // 每次显示页面时重新检查
    this.checkPrivacyAgreed();
  },

  // 检查是否已同意隐私政策
  checkPrivacyAgreed() {
    const privacyAgreed = wx.getStorageSync('privacyAgreed');
    if (!privacyAgreed) {
      // 未同意隐私政策，显示弹窗
      this.setData({ showPrivacyModal: true });
    } else {
      // 已同意，加载数据
      this.loadData();
    }
  },

  // 查看隐私政策
  onViewPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' });
  },

  // 同意隐私政策
  onAgreePrivacy() {
    app.agreePrivacy();
    this.setData({ showPrivacyModal: false });
    this.loadData();
  },

  // 拒绝隐私政策
  onRejectPrivacy() {
    wx.showModal({
      title: '提示',
      content: '您需要同意隐私政策才能使用本小程序',
      showCancel: false,
      confirmText: '重新阅读',
      success: () => {
        // 重新显示隐私政策
      }
    });
  },

  async loadData() {
    try {
      const [users, top3] = await Promise.all([
        getUserList(),
        getTop3(),
      ]);

      this.setData({
        existingUsers: users,
        top3,
        isNewUser: users.length === 0,
      });
    } catch (err) {
      console.error('加载数据失败:', err);
    }
  },

  // 切换登录/注册模式
  toggleMode() {
    this.setData({ isNewUser: !this.data.isNewUser });
  },

  // 输入用户名
  onInputUsername(e: any) {
    this.setData({ username: e.detail.value });
  },

  // 用户名登录/注册
  async onUsernameLogin() {
    const { username, isNewUser } = this.data;

    // 再次检查隐私政策
    if (!wx.getStorageSync('privacyAgreed')) {
      this.setData({ showPrivacyModal: true });
      return;
    }

    if (!username.trim()) {
      wx.showToast({ title: '请输入用户名', icon: 'none' });
      return;
    }

    if (username.length < 2 || username.length > 20) {
      wx.showToast({ title: '用户名长度为2-20个字符', icon: 'none' });
      return;
    }

    this.setData({ loading: true });

    try {
      const result = await login(username);
      
      // 保存登录信息
      wx.setStorageSync('token', result.token);
      wx.setStorageSync('userInfo', result.user);

      wx.showToast({ 
        title: isNewUser ? '注册成功' : '登录成功', 
        icon: 'success' 
      });

      // 跳转首页
      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' });
      }, 1000);
    } catch (err: any) {
      wx.showToast({ title: err.message || '登录失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 选择已有账号登录
  async onSelectUser(e: any) {
    const { username } = e.currentTarget.dataset;

    // 再次检查隐私政策
    if (!wx.getStorageSync('privacyAgreed')) {
      this.setData({ showPrivacyModal: true });
      return;
    }

    this.setData({ loading: true });

    try {
      const result = await login(username);
      
      wx.setStorageSync('token', result.token);
      wx.setStorageSync('userInfo', result.user);

      wx.showToast({ title: '登录成功', icon: 'success' });

      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' });
      }, 1000);
    } catch (err: any) {
      wx.showToast({ title: err.message || '登录失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 微信一键登录
  async onWechatLogin() {
    // 再次检查隐私政策
    if (!wx.getStorageSync('privacyAgreed')) {
      this.setData({ showPrivacyModal: true });
      return;
    }

    this.setData({ loading: true });

    try {
      // 获取用户信息
      const userInfo = await wx.getUserProfile({
        desc: '用于完善用户资料',
      });

      // 微信登录
      const loginRes = await wx.login();
      const result = await wechatLogin(
        loginRes.code,
        userInfo.userInfo.nickName,
        userInfo.userInfo.avatarUrl
      );

      wx.setStorageSync('token', result.token);
      wx.setStorageSync('userInfo', result.user);

      wx.showToast({ title: '登录成功', icon: 'success' });

      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' });
      }, 1000);
    } catch (err: any) {
      wx.showToast({ title: err.message || '登录失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
});