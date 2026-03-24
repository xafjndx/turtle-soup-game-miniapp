// pages/game/game.ts
import { 
  getCurrentSession, 
  submitRound, 
  useHint, 
  endGame,
  saveAIQuestion 
} from '../../api/index';

// 后端地址配置（应从环境或配置文件读取）
const API_BASE_URL = 'https://turtle-soup-server-235023-9-1412292669.sh.run.tcloudbase.com/api';

// 录音配置
const RECORDER_CONFIG = {
  duration: 60000,      // 最长录音时长 60秒
  sampleRate: 16000,    // 采样率 16kHz（阿里云推荐）
  numberOfChannels: 1,  // 单声道
  format: 'pcm' as const, // PCM 格式（阿里云推荐，识别率更高）
};

Page({
  data: {
    session: null as any,
    question: null as any,
    hasPlayed: false,
    showPlayedNotice: false, // 玩过提示横幅
    
    // 游戏状态
    inputMode: 'TEXT' as 'VOICE' | 'TEXT',
    showInputSelector: false,
    playerInput: '',
    hintRemaining: 3,
    currentHint: '',
    rounds: [] as any[],
    
    // 结束弹窗
    showEndModal: false,
    showResultModal: false,
    showEndChoice: false,
    gameResult: null as any,
    revealedAnswer: false,
    savedToBank: false,
    
    // 录音
    isRecording: false,
    recorderManager: null as any,
  },

  onLoad(options) {
    const { sessionId, hasPlayed } = options;
    const played = hasPlayed === 'true';
    
    // 如果已玩过，显示提示横幅
    this.setData({ 
      hasPlayed: played,
      showPlayedNotice: played 
    });
    
    this.loadSession();
    this.initRecorder();
  },

  // 禁止用户通过右上角菜单分享或退出
  onShareAppMessage() {
    return {
      title: '海龟汤推理游戏',
      path: '/pages/index/index',
    };
  },

  // 禁止下拉刷新
  onPullDownRefresh() {
    // 不执行任何操作，阻止下拉刷新
  },

  /**
   * 初始化录音管理器
   */
  initRecorder() {
    const recorderManager = wx.getRecorderManager();
    
    // 录音结束回调
    recorderManager.onStop((res: any) => {
      this.handleRecordingEnd(res);
    });
    
    // 录音错误回调
    recorderManager.onError((err: any) => {
      console.error('录音错误:', err);
      this.setData({ isRecording: false });
      wx.showToast({ title: '录音失败', icon: 'none' });
    });
    
    this.setData({ recorderManager });
  },

  async loadSession() {
    try {
      const question = wx.getStorageSync('currentQuestion');
      const session = wx.getStorageSync('currentSession');
      
      if (question && session) {
        this.setData({
          session,
          question,
          hintRemaining: session.hintRemaining || 3,
          rounds: [],
        });
        console.log('从 storage 加载游戏数据:', { question, session });
      } else {
        const apiSession = await getCurrentSession();
        if (apiSession) {
          this.setData({
            session: apiSession,
            question: apiSession.question,
            hintRemaining: apiSession.hintRemaining || 3,
            rounds: apiSession.rounds || [],
          });
        }
      }
    } catch (err) {
      console.error('加载会话失败:', err);
    }
  },

  // 选择输入方式
  onSelectInputMode(e: any) {
    const { mode } = e.currentTarget.dataset;
    this.setData({ 
      inputMode: mode,
      showInputSelector: false 
    });
  },

  showInputModeSelector() {
    this.setData({ showInputSelector: true });
  },

  hideInputModeSelector() {
    this.setData({ showInputSelector: false });
  },

  onInputChange(e: any) {
    this.setData({ playerInput: e.detail.value });
  },

  /**
   * 开始录音
   */
  startRecording() {
    if (!this.data.recorderManager) {
      wx.showToast({ title: '录音功能初始化失败', icon: 'none' });
      return;
    }
    
    this.setData({ isRecording: true });
    this.data.recorderManager.start(RECORDER_CONFIG);
  },

  /**
   * 停止录音
   */
  stopRecording() {
    if (!this.data.recorderManager) return;
    
    this.setData({ isRecording: false });
    this.data.recorderManager.stop();
  },

  /**
   * 录音结束处理
   */
  async handleRecordingEnd(res: any) {
    wx.showLoading({ title: '语音识别中...', icon: 'loading' });
    
    try {
      // 读取音频文件并转为 base64
      const audioBase64 = await this.readAudioFile(res.tempFilePath);
      
      // 调用后端语音识别 API
      const response = await this.callVoiceRecognitionAPI(audioBase64, RECORDER_CONFIG.format);
      
      wx.hideLoading();
      
      if (response.code === 0 && response.data?.text) {
        this.setData({ playerInput: response.data.text });
        wx.showToast({ title: '识别成功', icon: 'success', duration: 1000 });
      } else if (response.data?.fallback) {
        this.handleRecognitionFailure(response.data.error);
      } else {
        throw new Error(response.message || '识别失败');
      }
    } catch (err: any) {
      wx.hideLoading();
      console.error('语音识别失败:', err);
      this.handleRecognitionFailure(err.message);
    }
  },

  /**
   * 读取音频文件为 Base64
   */
  readAudioFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      wx.getFileSystemManager().readFile({
        filePath,
        encoding: 'base64',
        success: (res) => resolve(res.data as string),
        fail: (err) => reject(new Error('读取音频文件失败')),
      });
    });
  },

  /**
   * 调用语音识别 API
   */
  callVoiceRecognitionAPI(audioBase64: string, format: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const token = wx.getStorageSync('token');
      
      wx.request({
        url: `${API_BASE_URL}/voice/recognize`,
        method: 'POST',
        data: { audio: audioBase64, format },
        header: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        success: (res: any) => resolve(res.data),
        fail: (err) => reject(new Error('网络请求失败')),
      });
    });
  },

  /**
   * 处理识别失败
   */
  handleRecognitionFailure(errorMsg: string) {
    wx.showModal({
      title: '语音识别失败',
      content: errorMsg || '请使用文字输入',
      confirmText: '切换文字',
      showCancel: true,
      success: (modalRes) => {
        if (modalRes.confirm) {
          this.setData({ inputMode: 'TEXT' });
        }
      },
    });
  },

  // 提交提问
  async onSubmitAsk() {
    const { playerInput, session } = this.data;
    
    if (!playerInput.trim()) {
      wx.showToast({ title: '请输入内容', icon: 'none' });
      return;
    }

    try {
      wx.showLoading({ title: '思考中...' });
      
      const result = await submitRound(
        session.id,
        this.data.inputMode,
        playerInput,
        'ASK'
      );
      
      wx.hideLoading();
      
      this.setData({
        rounds: [...this.data.rounds, result.round],
        playerInput: '',
      });

      if (result.sessionEnded) {
        this.handleGameWin(result.judgment.hitRate);
      }
    } catch (err: any) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '提交失败', icon: 'none' });
    }
  },

  // 提交猜测
  async onSubmitGuess() {
    const { playerInput, session } = this.data;
    
    if (!playerInput.trim()) {
      wx.showToast({ title: '请输入你的猜测', icon: 'none' });
      return;
    }

    try {
      wx.showLoading({ title: '判定中...' });
      
      const result = await submitRound(
        session.id,
        this.data.inputMode,
        playerInput,
        'GUESS'
      );
      
      wx.hideLoading();
      
      this.setData({
        rounds: [...this.data.rounds, result.round],
        playerInput: '',
      });

      if (result.sessionEnded) {
        this.handleGameWin(result.judgment.hitRate);
      } else {
        wx.showToast({ 
          title: `重合率 ${result.judgment.hitRate}%`, 
          icon: 'none' 
        });
      }
    } catch (err: any) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '提交失败', icon: 'none' });
    }
  },

  // 使用提示
  async onUseHint() {
    const { session, hintRemaining } = this.data;
    
    if (hintRemaining <= 0) {
      wx.showToast({ title: '提示次数已用完', icon: 'none' });
      return;
    }

    try {
      const result = await useHint(session.id);
      this.setData({
        currentHint: result.hint,
        hintRemaining: result.hintRemaining,
      });
    } catch (err: any) {
      wx.showToast({ title: err.message || '获取提示失败', icon: 'none' });
    }
  },

  onCloseHint() {
    this.setData({ currentHint: '' });
  },

  hideEndModal() {
    this.setData({ showEndModal: false });
  },

  onEndGame() {
    this.setData({ showEndModal: true });
  },

  // 继续游戏（关闭提示横幅）
  onContinueGame() {
    this.setData({ showPlayedNotice: false });
  },

  // 再来一局（返回抽题页面）
  onRestartGame() {
    wx.navigateBack({ delta: 1 });
  },

  // 查看汤底
  async onViewAnswer() {
    this.setData({ showEndModal: false, revealedAnswer: true });
    await this.finishGame('QUIT', true);
    this.setData({ showResultModal: true });
  },

  // 保留神秘感
  async onKeepMystery() {
    this.setData({ showEndModal: false, revealedAnswer: false });
    await this.finishGame('QUIT', false);
    this.setData({ showEndChoice: true });
  },

  // 游戏胜利
  async handleGameWin(hitRate: number) {
    this.setData({ 
      gameResult: { hitRate, result: 'WIN' },
      showResultModal: true,
      revealedAnswer: false,
      savedToBank: false,
    });
  },

  // 从结果弹窗查看汤底
  async onViewAnswerFromResult() {
    this.setData({ revealedAnswer: true });
    await this.finishGame('WIN', true);
  },

  onContinueGame() {
    this.setData({ showResultModal: false });
  },

  // 结束游戏
  async finishGame(result: 'WIN' | 'QUIT', revealedAnswer: boolean) {
    try {
      const { session } = this.data;
      
      if (!session || !session.id) {
        wx.showToast({ title: '会话信息丢失', icon: 'none' });
        return;
      }
      
      const res = await endGame(session.id, result, revealedAnswer);
      
      this.setData({
        gameResult: {
          ...this.data.gameResult,
          result,
          answer: res.question?.bottom,
          hitRate: this.data.gameResult?.hitRate,
        },
        revealedAnswer,
      });
      
      console.log('游戏结束，结果:', this.data.gameResult);
    } catch (err: any) {
      console.error('结束游戏失败:', err);
      wx.showToast({ title: err.message || '结束游戏失败', icon: 'none' });
    }
  },

  // 保存 AI 题目到题库
  async onSaveQuestion() {
    try {
      const { session } = this.data;
      if (!session || !session.id) {
        wx.showToast({ title: '会话信息丢失', icon: 'none' });
        return;
      }
      await saveAIQuestion(session.id);
      wx.showToast({ title: '已加入题库', icon: 'success' });
      this.setData({ savedToBank: true });
    } catch (err: any) {
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
    }
  },

  onSkipSave() {
    this.setData({ savedToBank: true });
  },

  onPlayAgain() {
    wx.removeStorageSync('currentSession');
    wx.removeStorageSync('currentQuestion');
    wx.switchTab({ url: '/pages/index/index' });
  },

  onBackHome() {
    wx.removeStorageSync('currentSession');
    wx.removeStorageSync('currentQuestion');
    wx.switchTab({ url: '/pages/index/index' });
  },
});