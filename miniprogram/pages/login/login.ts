// pages/login/login.ts
import { login, wechatLogin, getUserList, getTop3 } from '../../api/index';

interface User {
  id: string;
  username: string;
  nickname?: string;
  avatarUrl?: string;
}

Page({
  data: {
    username: '',
    isNewUser: true,
    existingUsers: [] as User[],
    top3: [] as any[],
    loading: false,
  },

  onLoad() {
    this.loadData();
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