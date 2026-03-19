// pages/admin/admin.ts
import { getAdminStatistics, getPendingQuestions, updateQuestionStatus } from '../../api/index';

const ADMIN_PASSWORD = 'haiguitang';

interface User {
  id: string;
  username: string;
  nickname?: string;
  avatarUrl?: string;
  totalGames: number;
  hitRate: number;
}

interface Question {
  id: string;
  surface: string;
  bottom: string;
  category: string;
  status: string;
  hints: string;
  keywords: string;
  source: string;
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
    stats: {} as any,

    // 用户管理
    users: [] as User[],
    filteredUsers: [] as User[],
    userSearch: '',
    showUserModal: false,
    editUser: {} as any,

    // 题库管理
    questions: [] as Question[],
    filteredQuestions: [] as Question[],
    questionSearch: '',
    showQuestionModal: false,
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
  },

  onLoad() {
    // 检查是否已登录（使用 storage 缓存）
    const loggedIn = wx.getStorageSync('admin_logged_in');
    if (loggedIn) {
      this.setData({ isLoggedIn: true });
      this.loadData();
    }
  },

  onShow() {
    if (this.data.isLoggedIn) {
      this.loadData();
    }
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
      const stats = await getAdminStatistics();
      const pendingQuestions = await getPendingQuestions(50);
      this.setData({ stats, pendingQuestions });
    } catch (err) {
      console.error('加载数据失败:', err);
    }
  },

  // 加载用户列表
  async loadUsers() {
    try {
      const res = await wx.request({
        url: 'https://turtle-soup-server-235023-9-1412292669.sh.run.tcloudbase.com/api/admin/users',
        method: 'GET',
        header: { Authorization: `Bearer ${wx.getStorageSync('token')}` },
      });
      // @ts-ignore
      const users = res.data?.data || [];
      this.setData({ users, filteredUsers: users });
    } catch (err) {
      console.error('加载用户失败:', err);
    }
  },

  // 加载题库列表
  async loadQuestions() {
    try {
      const res = await wx.request({
        url: 'https://turtle-soup-server-235023-9-1412292669.sh.run.tcloudbase.com/api/admin/questions',
        method: 'GET',
        header: { Authorization: `Bearer ${wx.getStorageSync('token')}` },
      });
      // @ts-ignore
      const questions = res.data?.data?.list || [];
      this.setData({ questions, filteredQuestions: questions });
    } catch (err) {
      console.error('加载题目失败:', err);
    }
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
    const filteredQuestions = this.data.questions.filter(q => 
      q.surface.toLowerCase().includes(keyword) || q.bottom.toLowerCase().includes(keyword)
    );
    this.setData({ questionSearch: keyword, filteredQuestions });
  },

  // 编辑用户
  onEditUser(e: any) {
    const user = this.data.users.find(u => u.id === e.currentTarget.dataset.id);
    if (user) {
      this.setData({ showUserModal: true, editUser: { ...user } });
    }
  },

  onInputUserNickname(e: any) {
    this.setData({ 'editUser.nickname': e.detail.value });
  },

  closeUserModal() {
    this.setData({ showUserModal: false, editUser: {} });
  },

  async onSaveUser() {
    try {
      await wx.request({
        url: `https://turtle-soup-server-235023-9-1412292669.sh.run.tcloudbase.com/api/admin/user/${this.data.editUser.id}`,
        method: 'PUT',
        header: { Authorization: `Bearer ${wx.getStorageSync('token')}` },
        data: { nickname: this.data.editUser.nickname },
      });
      wx.showToast({ title: '保存成功', icon: 'success' });
      this.closeUserModal();
      this.loadUsers();
    } catch (err) {
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
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
        category: 'CLASSIC',
        surface: '',
        bottom: '',
        hintsText: '',
        keywordsText: '',
      },
      categoryIndex: 0,
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
          category: q.category,
          surface: q.surface,
          bottom: q.bottom,
          hintsText: Array.isArray(hints) ? hints.join('\n') : hints,
          keywordsText: Array.isArray(keywords) ? keywords.join(', ') : keywords,
        },
        categoryIndex: categoryIndex >= 0 ? categoryIndex : 0,
      });
    }
  },

  // 编辑待审核题目
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
          category: q.category,
          surface: q.surface,
          bottom: q.bottom,
          hintsText: Array.isArray(hints) ? hints.join('\n') : hints,
          keywordsText: Array.isArray(keywords) ? keywords.join(', ') : keywords,
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
    this.setData({ 'editQuestion.surface': e.detail.value });
  },

  onInputBottom(e: any) {
    this.setData({ 'editQuestion.bottom': e.detail.value });
  },

  onInputHints(e: any) {
    this.setData({ 'editQuestion.hintsText': e.detail.value });
  },

  onInputKeywords(e: any) {
    this.setData({ 'editQuestion.keywordsText': e.detail.value });
  },

  closeQuestionModal() {
    this.setData({ showQuestionModal: false, editQuestion: {} });
  },

  stopPropagation() {},

  async onSaveQuestion() {
    const { editQuestion } = this.data;
    if (!editQuestion.surface?.trim()) {
      wx.showToast({ title: '请输入汤面', icon: 'none' });
      return;
    }
    if (!editQuestion.bottom?.trim()) {
      wx.showToast({ title: '请输入汤底', icon: 'none' });
      return;
    }

    const hints = editQuestion.hintsText.split('\n').filter((h: string) => h.trim());
    const keywords = editQuestion.keywordsText.split(/[,，]/).filter((k: string) => k.trim());

    try {
      if (editQuestion.id) {
        // 更新
        await wx.request({
          url: `https://turtle-soup-server-235023-9-1412292669.sh.run.tcloudbase.com/api/admin/question/${editQuestion.id}`,
          method: 'PUT',
          header: { Authorization: `Bearer ${wx.getStorageSync('token')}` },
          data: {
            category: editQuestion.category,
            surface: editQuestion.surface,
            bottom: editQuestion.bottom,
            hints,
            keywords,
          },
        });
      } else {
        // 新增
        await wx.request({
          url: 'https://turtle-soup-server-235023-9-1412292669.sh.run.tcloudbase.com/api/admin/question/create',
          method: 'POST',
          header: { Authorization: `Bearer ${wx.getStorageSync('token')}` },
          data: {
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

  onViewQuestion(e: any) {
    const q = this.data.questions.find(q => q.id === e.currentTarget.dataset.id);
    if (q) {
      const hints = typeof q.hints === 'string' ? JSON.parse(q.hints) : q.hints;
      const keywords = typeof q.keywords === 'string' ? JSON.parse(q.keywords) : q.keywords;
      wx.showModal({
        title: '题目详情',
        content: `汤面：${q.surface}\n\n汤底：${q.bottom}\n\n提示：${Array.isArray(hints) ? hints.join(' | ') : hints}\n\n关键词：${Array.isArray(keywords) ? keywords.join(', ') : keywords}`,
        showCancel: false,
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