// pages/game/game.ts
import { 
  getCurrentSession, 
  submitRound, 
  useHint, 
  endGame,
  saveAIQuestion 
} from '../../api/index';
import SpeechRecognition from '../../utils/sr';
import { getToken } from '../../utils/token';

const APPKEY = '9VjrIoolPvwUSKyX';

Page({
  data: {
    session: null as any,
    question: null as any,
    hasPlayed: false,
    
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
    showEndChoice: false,  // 结束选择弹窗
    gameResult: null as any,
    revealedAnswer: false,
    savedToBank: false,  // 是否已加入题库
    
    // 录音
    isRecording: false,
    recorderManager: null as any,
    sr: null as any,  // 语音识别实例
  },

  onLoad(options) {
    const { sessionId, hasPlayed } = options;
    this.setData({ hasPlayed: hasPlayed === 'true' });
    
    // 加载会话信息
    this.loadSession();
    
    // 初始化录音管理器
    this.setData({
      recorderManager: wx.getRecorderManager(),
    });
    
    // 录音帧回调 - 实时发送音频数据
    this.data.recorderManager.onFrameRecorded((res: any) => {
      if (this.data.sr && this.data.isRecording) {
        this.data.sr.sendAudio(res.frameBuffer);
      }
    });
    
    // 录音结束回调
    this.data.recorderManager.onStop((res: any) => {
      this.handleRecordingEnd(res);
    });
  },

  async loadSession() {
    try {
      // 优先从 storage 获取题目信息（开始游戏时保存的）
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
        // 如果 storage 没有，尝试从 API 获取
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

  // 显示输入方式选择
  showInputModeSelector() {
    this.setData({ showInputSelector: true });
  },

  // 隐藏输入方式选择
  hideInputModeSelector() {
    this.setData({ showInputSelector: false });
  },

  // 输入文字
  onInputChange(e: any) {
    this.setData({ playerInput: e.detail.value });
  },

  // 开始录音
  async startRecording() {
    this.setData({ isRecording: true });
    
    try {
      // 获取 Token
      const token = await getToken();
      
      // 创建语音识别实例
      const sr = new SpeechRecognition({
        url: 'wss://nls-gateway-cn-shanghai.aliyuncs.com/ws/v1',
        token: token,
        appkey: APPKEY,
      });
      
      // 注册事件回调
      sr.on('started', (msg: string) => {
        console.log('识别开始:', msg);
      });
      
      sr.on('changed', (msg: string) => {
        console.log('中间结果:', msg);
        // 显示中间结果
        this.setData({ playerInput: msg });
      });
      
      sr.on('completed', (msg: string) => {
        console.log('识别完成:', msg);
        this.setData({ playerInput: msg });
        wx.hideLoading();
      });
      
      sr.on('failed', (msg: string) => {
        console.error('识别失败:', msg);
        wx.hideLoading();
        wx.showModal({
          title: '语音识别失败',
          content: msg || '请使用文字输入',
          confirmText: '切换文字',
          showCancel: true,
          success: (modalRes) => {
            if (modalRes.confirm) {
              this.setData({ inputMode: 'TEXT' });
            }
          },
        });
      });
      
      sr.on('closed', () => {
        console.log('连接关闭');
      });
      
      this.setData({ sr });
      
      // 开始识别
      await sr.start(sr.defaultStartParams());
      
      // 开始录音（PCM 格式，实时发送帧）
      this.data.recorderManager.start({
        duration: 60000,
        sampleRate: 16000,
        numberOfChannels: 1,
        format: 'PCM',
        frameSize: 4,  // 每 4 帧回调一次
      });
      
    } catch (err: any) {
      console.error('语音识别初始化失败:', err);
      this.setData({ isRecording: false });
      wx.showModal({
        title: '语音识别失败',
        content: err.message || '请检查网络后重试',
        confirmText: '切换文字',
        showCancel: true,
        success: (modalRes) => {
          if (modalRes.confirm) {
            this.setData({ inputMode: 'TEXT' });
          }
        },
      });
    }
  },

  // 停止录音
  async stopRecording() {
    this.setData({ isRecording: false });
    
    // 停止录音
    this.data.recorderManager.stop();
    
    // 停止识别
    if (this.data.sr) {
      try {
        await this.data.sr.close();
      } catch (e) {
        console.error('停止识别失败:', e);
      }
    }
  },

  // 录音结束处理
  async handleRecordingEnd(res: any) {
    // WebSocket 模式下，识别结果在 completed 回调中处理
    // 这里不需要额外处理
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

      // 判断是否命中
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

  // 关闭提示
  onCloseHint() {
    this.setData({ currentHint: '' });
  },

  // 隐藏结束弹窗
  hideEndModal() {
    this.setData({ showEndModal: false });
  },

  // 点击结束
  onEndGame() {
    this.setData({ showEndModal: true });
  },

  // 查看汤底
  async onViewAnswer() {
    this.setData({ showEndModal: false, revealedAnswer: true });
    await this.finishGame('QUIT', true);
    // 显示结果弹窗（包含汤底和加入题库按钮）
    this.setData({ showResultModal: true });
  },

  // 保留神秘感
  async onKeepMystery() {
    this.setData({ showEndModal: false, revealedAnswer: false });
    await this.finishGame('QUIT', false);
    // 直接显示结束选择
    this.setData({ showEndChoice: true });
  },

  // 游戏胜利
  async handleGameWin(hitRate: number) {
    this.setData({ 
      gameResult: { hitRate, result: 'WIN' },
      showResultModal: true,
      revealedAnswer: false,  // 默认不显示汤底
      savedToBank: false,
    });
    // 不立即结束游戏，让玩家选择
  },

  // 从结果弹窗查看汤底
  async onViewAnswerFromResult() {
    this.setData({ revealedAnswer: true });
    await this.finishGame('WIN', true);
  },

  // 继续游戏（不查看汤底）
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
      
      // 更新游戏结果
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

  // 不保存题目
  onSkipSave() {
    this.setData({ savedToBank: true });
  },

  // 再来一局
  onPlayAgain() {
    // 清除当前游戏数据
    wx.removeStorageSync('currentSession');
    wx.removeStorageSync('currentQuestion');
    // 首页是 tabBar 页面，必须用 switchTab
    wx.switchTab({ url: '/pages/index/index' });
  },

  // 返回首页
  onBackHome() {
    wx.removeStorageSync('currentSession');
    wx.removeStorageSync('currentQuestion');
    wx.switchTab({ url: '/pages/index/index' });
  },
});