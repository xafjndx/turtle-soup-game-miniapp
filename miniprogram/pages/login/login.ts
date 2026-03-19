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
    showPrivacyModal: true, // 默认显示隐私政策弹窗
    privacyChecked: false, // 是否已检查过隐私政策状态
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
    
    if (privacyAgreed) {
      // 已同意，隐藏弹窗，加载数据
      this.setData({ 
        showPrivacyModal: false, 
        privacyChecked: true 
      });
      this.loadData();
    } else {
      // 未同意，显示弹窗
      this.setData({ 
        showPrivacyModal: true, 
        privacyChecked: true 
      });
      // 不加载数据，等待用户同意
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
      title: '温馨提示',
      content: '您需要同意《用户协议》和《隐私政策》才能使用本小程序的服务。\n\n如果您不同意，将无法使用本小程序的功能。',
      confirmText: '重新阅读',
      cancelText: '退出',
      success: (res) => {
        if (res.cancel) {
          // 用户选择退出
          app.rejectPrivacy();
          // 退出小程序（实际无法真正退出，只能提示）
          wx.showToast({
            title: '您拒绝了隐私政策',
            icon: 'none',
            duration: 2000
          });
        }
        // 如果点击"重新阅读"，弹窗继续保持
      }
    });
  },

  async loadData() {
    // 只有同意隐私政策后才加载数据
    if (!wx.getStorageSync('privacyAgreed')) {
      return;
    }
    
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
      // 微信登录获取 code
      const loginRes = await wx.login();
      
      // 调用后端微信登录接口，后端会用 code 换取 openId
      const result = await wechatLogin(
        loginRes.code,  // 传 code，后端会换取 openId
        '',  // nickname 暂时为空
        ''   // avatarUrl 暂时为空
      );

      wx.setStorageSync('token', result.token);
      wx.setStorageSync('userInfo', result.user);

      wx.showToast({ title: '登录成功', icon: 'success' });

      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' });
      }, 1000);
    } catch (err: any) {
      console.error('微信登录失败:', err);
      wx.showToast({ title: err.message || '登录失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
});