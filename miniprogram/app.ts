// app.ts
App<{
  globalData: {
    userInfo: any;
    token: string;
    baseUrl: string;
  };
  onLaunch(): void;
  checkLogin(): boolean;
  login(): Promise<void>;
  logout(): void;
}>({
  globalData: {
    userInfo: null,
    token: '',
    baseUrl: 'https://your-domain.com/api', // 替换为实际后端地址
  },

  onLaunch() {
    // 检查登录状态
    this.checkLogin();
  },

  // 检查是否已登录
  checkLogin(): boolean {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    
    if (token && userInfo) {
      this.globalData.token = token;
      this.globalData.userInfo = userInfo;
      return true;
    }
    return false;
  },

  // 登录
  async login() {
    try {
      // 微信登录获取 code
      const loginRes = await wx.login();
      
      // 调用后端登录接口
      const res = await wx.request({
        url: `${this.globalData.baseUrl}/user/login`,
        method: 'POST',
        data: {
          openId: loginRes.code, // 实际应通过后端换取 openid
        },
      });

      const data = (res as any).data.data;
      this.globalData.token = data.token;
      this.globalData.userInfo = data.user;

      // 保存到本地
      wx.setStorageSync('token', data.token);
      wx.setStorageSync('userInfo', data.user);
    } catch (err) {
      console.error('登录失败:', err);
      throw err;
    }
  },

  // 退出登录
  logout() {
    this.globalData.token = '';
    this.globalData.userInfo = null;
    wx.removeStorageSync('token');
    wx.removeStorageSync('userInfo');
  },
});