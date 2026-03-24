// pages/admin/admin.ts
import { getAdminStatistics, getPendingQuestions, updateQuestionStatus } from '../../api/index';

const ADMIN_PASSWORD = 'haiguitang';

interface User {
  id: string;
  username: string;
  nickname?: string;
  avatarUrl?: string;
  totalGames: number;
  winCount: number;
  hitRate: number;
  createdAt?: string;
}

interface Question {
  id: string;
  title?: string;
  surface: string;
  bottom: string;
  category: string;
  categoryName: string;
  status: string;
  statusName: string;
  surfaceShort: string;
  hints: string;
  keywords: string;
  source: string;
  submittedBy?: string;
  submitterName?: string;
  createdAt?: string;
  timeShort?: string;
  hintsText?: string;
  keywordsText?: string;
}

Page({
  data: {
    // 登录状态
    isLoggedIn: false,
    password: '',
    loginError: '',

    // 当前 tab
    currentTab: 'overview',

    // 统计数据
    stats: {
      users: { total: 0, active: 0 },
      questions: { total: 0, pending: 0, softDeleted: 0 },
      games: { total: 0, today: 0, winRate: '0%' },
    } as any,
    categoryCounts: {} as Record<string, number>,

    // 用户管理
    users: [] as User[],
    filteredUsers: [] as User[],
    userSearch: '',
    showUserDetailModal: false,
    userDetail: {} as any,

    // 题库管理
    questions: [] as Question[],
    filteredQuestions: [] as Question[],
    questionSearch: '',
    selectedCategory: '',
    showQuestionModal: false,
    showQuestionDetailModal: false,
    questionDetail: {} as any,
    editQuestion: {} as any,
    categoryIndex: 0,
    categories: [
      { value: 'CLASSIC', label: '经典推理' },
      { value: 'HORROR', label: '恐怖悬疑' },
      { value: 'LOGIC', label: '逻辑陷阱' },
      { value: 'WARM', label: '温情反转' },
    ],

    // 待审核
    pendingQuestions: [] as Question[],
    showPendingDetailModal: false,
    pendingDetail: {} as any,
  },

  onLoad() {
    // 每次进入都需要重新登录
    this.setData({ isLoggedIn: false });
  },

  onShow() {
    // 离开后返回需要重新登录
    if (!this.data.isLoggedIn) {
      this.setData({ password: '', loginError: '' });
    }
  },

  onHide() {
    // 离开管理界面时清除登录状态
    wx.removeStorageSync('admin_logged_in');
    this.setData({ isLoggedIn: false, password: '' });
  },

  // 密码输入
  onInputPassword(e: any) {
    this.setData({ password: e.detail.value, loginError: '' });
  },

  // 登录
  onLogin() {
    if (this.data.password === ADMIN_PASSWORD) {
      wx.setStorageSync('admin_logged_in', true);
      this.setData({ isLoggedIn: true, password: '', loginError: '' });
      this.loadData();
    } else {
      this.setData({ loginError: '密码错误' });
    }
  },

  // 切换 tab
  switchTab(e: any) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
    if (tab === 'users') this.loadUsers();
    if (tab === 'questions') this.loadQuestions();
  },

  // 加载所有数据
  async loadData() {
    try {
      const statsData = await getAdminStatistics();
      const stats = {
        users: { total: 0, active: 0, ...statsData.users },
        questions: { total: 0, pending: 0, softDeleted: 0, ...statsData.questions },
        games: { total: 0, today: 0, winRate: '0%', ...statsData.games },
      };
      const pendingQuestions = await getPendingQuestions(50);
      
      // 处理待审核数据
      const processedPending = this.processPendingQuestions(pendingQuestions);
      
      this.setData({ stats, pendingQuestions: processedPending, categoryCounts: statsData.questions.byCategory || {} });
    } catch (err) {
      console.error('加载数据失败:', err);
    }
  },

  // 处理待审核数据
  processPendingQuestions(list: any[]): Question[] {
    return list.map(item => ({
      ...item,
      title: item.title || '无标题',
      submitterName: item.submittedBy || '匿名',
      timeShort: item.createdAt ? item.createdAt.substring(0, 10) : '',
      categoryName: this.getCategoryName(item.category),
    }));
  },

  // 获取分类名称
  getCategoryName(category: string): string {
    const map: Record<string, string> = {
      'CLASSIC': '经典推理',
      'HORROR': '恐怖悬疑',
      'LOGIC': '逻辑陷阱',
      'WARM': '温情反转',
    };
    return map[category] || category;
  },

  // 获取状态名称
  getStatusName(status: string): string {
    const map: Record<string, string> = {
      'APPROVED': '已通过',
      'PENDING': '待审核',
      'REJECTED': '已驳回',
      'SOFT_DELETED': '已删除',
    };
    return map[status] || status;
  },

  // 加载用户列表
  loadUsers() {
    const token = wx.getStorageSync('token');
    
    console.log('开始加载用户列表，token:', token ? '已获取' : '未获取');
    
    wx.request({
      url: 'https://turtle-soup-server-235023-9-1412292669.sh.run.tcloudbase.com/api/admin/users',
      method: 'GET',
      header: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      success: (res) => {
        console.log('用户请求成功，statusCode:', res.statusCode);
        console.log('用户请求完整响应:', res);
        
        if (res.statusCode !== 200) {
          wx.showToast({ 
            title: `请求失败：${res.statusCode}`, 
            icon: 'none',
            duration: 3000
          });
          return;
        }
        
        const responseData = res.data;
        console.log('用户响应 data:', responseData);
        
        if (!responseData) {
          wx.showToast({ title: '响应数据为空', icon: 'none' });
          return;
        }
        
        if (responseData.code === 401) {
          wx.showToast({ title: '登录已过期', icon: 'none' });
          this.setData({ isLoggedIn: false });
          return;
        }
        
        const users = responseData?.data?.list || responseData?.data || [];
        console.log('加载用户列表:', users.length, '个用户');
        
        this.setData({ 
          users, 
          filteredUsers: users,
        });
        
        if (users.length === 0) {
          wx.showToast({ title: '暂无用户数据', icon: 'none' });
        }
      },
      fail: (err) => {
        console.error('用户请求失败:', err);
        wx.showToast({ 
          title: '网络错误：' + (err.errMsg || '未知错误'), 
          icon: 'none',
          duration: 3000
        });
      }
    });
  },

  // 加载题库列表
  loadQuestions() {
    const token = wx.getStorageSync('token');
    
    console.log('开始加载题库列表，token:', token ? '已获取' : '未获取');
    
    wx.request({
      url: 'https://turtle-soup-server-235023-9-1412292669.sh.run.tcloudbase.com/api/admin/questions',
      method: 'GET',
      header: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      success: (res) => {
        console.log('题库请求成功，statusCode:', res.statusCode);
        console.log('题库请求完整响应:', res);
        
        if (res.statusCode !== 200) {
          wx.showToast({ 
            title: `请求失败：${res.statusCode}`, 
            icon: 'none',
            duration: 3000
          });
          return;
        }
        
        const responseData = res.data;
        console.log('题库响应 data:', responseData);
        
        if (!responseData) {
          wx.showToast({ title: '响应数据为空', icon: 'none' });
          return;
        }
        
        if (responseData.code === 401) {
          wx.showToast({ title: '登录已过期', icon: 'none' });
          this.setData({ isLoggedIn: false });
          return;
        }
        
        const rawQuestions = responseData?.data?.list || responseData?.data || [];
        console.log('加载题库列表:', rawQuestions.length, '个题目');
        
        // 处理题目数据
        const questions: Question[] = rawQuestions.map((item: any) => ({
          ...item,
          categoryName: this.getCategoryName(item.category),
          statusName: this.getStatusName(item.status),
          surfaceShort: item.surface.length > 20 ? item.surface.substring(0, 20) + '...' : item.surface,
          hintsText: item.hints ? (Array.isArray(item.hints) ? item.hints.join(' | ') : item.hints) : '无提示',
          keywordsText: item.keywords ? (Array.isArray(item.keywords) ? item.keywords.join(', ') : item.keywords) : '无关键词',
        }));
        
        this.setData({ 
          questions, 
          filteredQuestions: questions,
        });
        
        if (questions.length === 0) {
          wx.showToast({ title: '题库为空，可添加题目', icon: 'none' });
        }
      },
      fail: (err) => {
        console.error('题库请求失败:', err);
        wx.showToast({ 
          title: '网络错误：' + (err.errMsg || '未知错误'), 
          icon: 'none',
          duration: 3000
        });
      }
    });
  },

  // 搜索用户
  onSearchUser(e: any) {
    const keyword = e.detail.value.toLowerCase();
    const filteredUsers = this.data.users.filter(u => 
      (u.nickname || u.username).toLowerCase().includes(keyword)
    );
    this.setData({ userSearch: keyword, filteredUsers });
  },

  // 搜索题目
  onSearchQuestion(e: any) {
    const keyword = e.detail.value.toLowerCase();
    let filteredQuestions = this.data.questions.filter(q => 
      q.surface.toLowerCase().includes(keyword) || q.bottom.toLowerCase().includes(keyword)
    );
    
    // 如果选中了分类，再过滤
    if (this.data.selectedCategory) {
      filteredQuestions = filteredQuestions.filter(q => q.category === this.data.selectedCategory);
    }
    
    this.setData({ questionSearch: keyword, filteredQuestions });
  },

  // 选择分类过滤
  onSelectCategoryFilter(e: any) {
    const category = e.currentTarget.dataset.category;
    this.setData({ selectedCategory: category });
    
    let filteredQuestions = this.data.questions;
    if (category) {
      filteredQuestions = filteredQuestions.filter(q => q.category === category);
    }
    
    // 如果有搜索关键词，也要应用
    if (this.data.questionSearch) {
      const keyword = this.data.questionSearch.toLowerCase();
      filteredQuestions = filteredQuestions.filter(q => 
        q.surface.toLowerCase().includes(keyword) || q.bottom.toLowerCase().includes(keyword)
      );
    }
    
    this.setData({ filteredQuestions });
  },

  // 查看用户详情
  onViewUserDetail(e: any) {
    const user = this.data.users.find(u => u.id === e.currentTarget.dataset.id);
    if (user) {
      this.setData({ 
        showUserDetailModal: true, 
        userDetail: {
          ...user,
          createdAt: user.createdAt ? user.createdAt.substring(0, 10) : '未知'
        }
      });
    }
  },

  closeUserDetailModal() {
    this.setData({ showUserDetailModal: false, userDetail: {} });
  },

  async onDeleteUser(e: any) {
    const res = await wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除这个用户吗？',
    });
    if (res.confirm) {
      try {
        await wx.request({
          url: `https://turtle-soup-server-235023-9-1412292669.sh.run.tcloudbase.com/api/admin/user/${e.currentTarget.dataset.id}`,
          method: 'DELETE',
          header: { Authorization: `Bearer ${wx.getStorageSync('token')}` },
        });
        wx.showToast({ title: '已删除', icon: 'success' });
        this.loadUsers();
      } catch (err) {
        wx.showToast({ title: '删除失败', icon: 'none' });
      }
    }
  },

  // 新增题目
  onAddQuestion() {
    this.setData({
      showQuestionModal: true,
      editQuestion: {
        title: '',
        category: 'CLASSIC',
        surface: '',
        bottom: '',
        hint1: '',
        hint2: '',
        hint3: '',
        keywordsText: '',
        surfaceLength: 0,
        bottomLength: 0,
      },
      categoryIndex: 0,
    });
  },

  // 查看题目详情
  onViewQuestion(e: any) {
    const q = this.data.questions.find(q => q.id === e.currentTarget.dataset.id);
    if (q) {
      const hints = typeof q.hints === 'string' ? JSON.parse(q.hints) : q.hints;
      const keywords = typeof q.keywords === 'string' ? JSON.parse(q.keywords) : q.keywords;
      this.setData({
        showQuestionDetailModal: true,
        questionDetail: {
          ...q,
          hintsText: Array.isArray(hints) ? hints.join(' | ') : hints,
          keywordsText: Array.isArray(keywords) ? keywords.join(', ') : keywords,
        }
      });
    }
  },

  closeQuestionDetailModal() {
    this.setData({ showQuestionDetailModal: false, questionDetail: {} });
  },

  editFromDetail() {
    const q = this.data.questionDetail;
    const hints = typeof q.hints === 'string' ? JSON.parse(q.hints) : q.hints;
    const categoryIndex = this.data.categories.findIndex(c => c.value === q.category);
    this.setData({
      showQuestionDetailModal: false,
      showQuestionModal: true,
      editQuestion: {
        id: q.id,
        title: q.title || '',
        category: q.category,
        surface: q.surface,
        bottom: q.bottom,
        hint1: Array.isArray(hints) ? (hints[0] || '') : '',
        hint2: Array.isArray(hints) ? (hints[1] || '') : '',
        hint3: Array.isArray(hints) ? (hints[2] || '') : '',
        keywordsText: q.keywordsText,
        surfaceLength: q.surface.length,
        bottomLength: q.bottom.length,
      },
      categoryIndex: categoryIndex >= 0 ? categoryIndex : 0,
    });
  },

  // 编辑题目
  onEditQuestion(e: any) {
    const q = this.data.questions.find(q => q.id === e.currentTarget.dataset.id);
    if (q) {
      const hints = typeof q.hints === 'string' ? JSON.parse(q.hints) : q.hints;
      const keywords = typeof q.keywords === 'string' ? JSON.parse(q.keywords) : q.keywords;
      const categoryIndex = this.data.categories.findIndex(c => c.value === q.category);
      this.setData({
        showQuestionModal: true,
        editQuestion: {
          id: q.id,
          title: q.title || '',
          category: q.category,
          surface: q.surface,
          bottom: q.bottom,
          hint1: Array.isArray(hints) ? (hints[0] || '') : '',
          hint2: Array.isArray(hints) ? (hints[1] || '') : '',
          hint3: Array.isArray(hints) ? (hints[2] || '') : '',
          keywordsText: Array.isArray(keywords) ? keywords.join(', ') : keywords,
          surfaceLength: q.surface.length,
          bottomLength: q.bottom.length,
        },
        categoryIndex: categoryIndex >= 0 ? categoryIndex : 0,
      });
    }
  },

  async onDeleteQuestion(e: any) {
    const res = await wx.showModal({
      title: '确认删除',
      content: '确定要删除这个题目吗？',
    });
    if (res.confirm) {
      try {
        await wx.request({
          url: `https://turtle-soup-server-235023-9-1412292669.sh.run.tcloudbase.com/api/admin/question/${e.currentTarget.dataset.id}`,
          method: 'DELETE',
          header: { Authorization: `Bearer ${wx.getStorageSync('token')}` },
        });
        wx.showToast({ title: '已删除', icon: 'success' });
        this.loadQuestions();
      } catch (err) {
        wx.showToast({ title: '删除失败', icon: 'none' });
      }
    }
  },

  // 查看待审核详情
  onViewPendingDetail(e: any) {
    const q = this.data.pendingQuestions.find(q => q.id === e.currentTarget.dataset.id);
    if (q) {
      const hints = typeof q.hints === 'string' ? JSON.parse(q.hints) : q.hints;
      const keywords = typeof q.keywords === 'string' ? JSON.parse(q.keywords) : q.keywords;
      this.setData({
        showPendingDetailModal: true,
        pendingDetail: {
          ...q,
          hintsText: Array.isArray(hints) ? hints.join(' | ') : hints,
          keywordsText: Array.isArray(keywords) ? keywords.join(', ') : keywords,
        }
      });
    }
  },

  closePendingDetailModal() {
    this.setData({ showPendingDetailModal: false, pendingDetail: {} });
  },

  // 从详情弹窗操作
  rejectPending() {
    this.setData({ showPendingDetailModal: false });
    this.onRejectQuestion({ currentTarget: { dataset: { id: this.data.pendingDetail.id } } });
  },

  editPendingFromDetail() {
    const q = this.data.pendingDetail;
    const categoryIndex = this.data.categories.findIndex(c => c.value === q.category);
    this.setData({
      showPendingDetailModal: false,
      showQuestionModal: true,
      editQuestion: {
        id: q.id,
        category: q.category,
        surface: q.surface,
        bottom: q.bottom,
        hintsText: q.hintsText,
        keywordsText: q.keywordsText,
        surfaceLength: q.surface.length,
        bottomLength: q.bottom.length,
        isPending: true,
      },
      categoryIndex: categoryIndex >= 0 ? categoryIndex : 0,
    });
  },

  approvePending() {
    this.setData({ showPendingDetailModal: false });
    this.onApproveQuestion({ currentTarget: { dataset: { id: this.data.pendingDetail.id } } });
  },

  // 编辑待审核
  onEditPending(e: any) {
    const q = this.data.pendingQuestions.find(q => q.id === e.currentTarget.dataset.id);
    if (q) {
      const hints = typeof q.hints === 'string' ? JSON.parse(q.hints) : q.hints;
      const keywords = typeof q.keywords === 'string' ? JSON.parse(q.keywords) : q.keywords;
      const categoryIndex = this.data.categories.findIndex(c => c.value === q.category);
      this.setData({
        showQuestionModal: true,
        editQuestion: {
          id: q.id,
          title: q.title || '',
          category: q.category,
          surface: q.surface,
          bottom: q.bottom,
          hint1: Array.isArray(hints) ? (hints[0] || '') : '',
          hint2: Array.isArray(hints) ? (hints[1] || '') : '',
          hint3: Array.isArray(hints) ? (hints[2] || '') : '',
          keywordsText: Array.isArray(keywords) ? keywords.join(', ') : keywords,
          surfaceLength: q.surface.length,
          bottomLength: q.bottom.length,
          isPending: true,
        },
        categoryIndex: categoryIndex >= 0 ? categoryIndex : 0,
      });
    }
  },

  onPickCategory(e: any) {
    const index = e.detail.value;
    this.setData({
      categoryIndex: index,
      'editQuestion.category': this.data.categories[index].value,
    });
  },

  onInputSurface(e: any) {
    this.setData({ 
      'editQuestion.surface': e.detail.value,
      'editQuestion.surfaceLength': e.detail.value.length
    });
  },

  onInputBottom(e: any) {
    this.setData({ 
      'editQuestion.bottom': e.detail.value,
      'editQuestion.bottomLength': e.detail.value.length
    });
  },

  onInputTitle(e: any) {
    this.setData({ 'editQuestion.title': e.detail.value });
  },

  onInputHint1(e: any) {
    this.setData({ 'editQuestion.hint1': e.detail.value });
  },

  onInputHint2(e: any) {
    this.setData({ 'editQuestion.hint2': e.detail.value });
  },

  onInputHint3(e: any) {
    this.setData({ 'editQuestion.hint3': e.detail.value });
  },

  onInputKeywords(e: any) {
    this.setData({ 'editQuestion.keywordsText': e.detail.value });
  },

  closeQuestionModal() {
    this.setData({ showQuestionModal: false, editQuestion: {} });
  },

  stopPropagation() {},

  async onSaveQuestion() {
    const { editQuestion, categoryIndex, categories } = this.data;
    
    // 验证必填字段
    if (!editQuestion.title || !editQuestion.title.trim()) {
      wx.showToast({ title: '请输入标题', icon: 'none' });
      return;
    }
    if (!editQuestion.surface || !editQuestion.surface.trim()) {
      wx.showToast({ title: '请输入汤面', icon: 'none' });
      return;
    }
    if (!editQuestion.bottom || !editQuestion.bottom.trim()) {
      wx.showToast({ title: '请输入汤底', icon: 'none' });
      return;
    }
    // 验证分类（必选项）
    if (!editQuestion.category || !editQuestion.category.trim()) {
      wx.showToast({ title: '请选择题目分类', icon: 'none' });
      return;
    }

    // 合并三个提示字段
    const hints = [editQuestion.hint1, editQuestion.hint2, editQuestion.hint3].filter((h: string) => h && h.trim());
    const keywords = editQuestion.keywordsText.split(/[,，]/).filter((k: string) => k.trim());

    try {
      if (editQuestion.id) {
        // 更新
        await wx.request({
          url: `https://turtle-soup-server-235023-9-1412292669.sh.run.tcloudbase.com/api/admin/question/${editQuestion.id}`,
          method: 'PUT',
          header: { Authorization: `Bearer ${wx.getStorageSync('token')}` },
          data: {
            title: editQuestion.title,
            category: editQuestion.category,
            surface: editQuestion.surface,
            bottom: editQuestion.bottom,
            hints: hints.length > 0 ? hints : ['暂无提示'],
            keywords,
            status: editQuestion.isPending ? 'APPROVED' : undefined,
          },
        });
      } else {
        // 新增
        await wx.request({
          url: 'https://turtle-soup-server-235023-9-1412292669.sh.run.tcloudbase.com/api/admin/question/create',
          method: 'POST',
          header: { Authorization: `Bearer ${wx.getStorageSync('token')}` },
          data: {
            title: editQuestion.title,
            category: editQuestion.category,
            surface: editQuestion.surface,
            bottom: editQuestion.bottom,
            hints: hints.length > 0 ? hints : ['暂无提示'],
            keywords: keywords.length > 0 ? keywords : ['海龟汤'],
          },
        });
      }
      wx.showToast({ title: '保存成功', icon: 'success' });
      this.closeQuestionModal();
      if (this.data.currentTab === 'questions') {
        this.loadQuestions();
      } else {
        this.loadData();
      }
    } catch (err) {
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  // 审核通过
  async onApproveQuestion(e: any) {
    try {
      await updateQuestionStatus(e.currentTarget.dataset.id, 'APPROVED');
      wx.showToast({ title: '已通过', icon: 'success' });
      this.loadData();
    } catch (err: any) {
      wx.showToast({ title: err.message || '操作失败', icon: 'none' });
    }
  },

  // 拒绝
  async onRejectQuestion(e: any) {
    try {
      await updateQuestionStatus(e.currentTarget.dataset.id, 'REJECTED');
      wx.showToast({ title: '已驳回', icon: 'success' });
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