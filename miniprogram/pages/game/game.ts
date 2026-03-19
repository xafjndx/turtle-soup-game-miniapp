// pages/game/game.ts
import { 
  getCurrentSession, 
  submitRound, 
  useHint, 
  endGame,
  saveAIQuestion 
} from '../../api/index';

// 暂时禁用语音识别功能，确保游戏页面正常运行
// const SpeechRecognition = require('../../utils/sr');
// const { getToken } = require('../../utils/token');

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

  // 开始录音 - 暂时使用HTTP API方式
  startRecording() {
    this.setData({ isRecording: true });
    this.data.recorderManager.start({
      duration: 60000,
      sampleRate: 16000,
      numberOfChannels: 1,
      format: 'mp3',
    });
  },

  // 停止录音
  stopRecording() {
    this.setData({ isRecording: false });
    this.data.recorderManager.stop();
  },

  // 录音结束处理
  async handleRecordingEnd(res: any) {
    wx.showLoading({ title: '语音识别中...', icon: 'loading' });
    
    try {
      // 读取音频文件并转为 base64
      const fileInfo = await new Promise<string>((resolve, reject) => {
        wx.getFileSystemManager().readFile({
          filePath: res.tempFilePath,
          encoding: 'base64',
          success: (fileRes) => resolve(fileRes.data as string),
          fail: reject,
        });
      });
      
      // 调用后端语音识别 API
      const token = wx.getStorageSync('token');
      const response = await new Promise<any>((resolve, reject) => {
        wx.request({
          url: 'https://turtle-soup-server-235023-9-1412292669.sh.run.tcloudbase.com/api/voice/recognize',
          method: 'POST',
          data: {
            audio: fileInfo,
            format: 'mp3',
          },
          header: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : '',
          },
          success: (res: any) => resolve(res.data),
          fail: reject,
        });
      });
      
      wx.hideLoading();
      
      if (response.code === 0 && response.data && response.data.text) {
        this.setData({ playerInput: response.data.text });
        wx.showToast({ title: '识别成功', icon: 'success', duration: 1000 });
      } else if (response.data && response.data.fallback) {
        // 语音识别失败，提示用户
        wx.showModal({
          title: '语音识别失败',
          content: response.data.error || '请使用文字输入',
          confirmText: '切换文字',
          showCancel: true,
          success: (modalRes) => {
            if (modalRes.confirm) {
              this.setData({ inputMode: 'TEXT' });
            }
          },
        });
      } else {
        throw new Error(response.message || '识别失败');
      }
    } catch (err: any) {
      wx.hideLoading();
      console.error('语音识别失败:', err);
      wx.showModal({
        title: '语音识别失败',
        content: '请使用文字输入，或检查网络后重试',
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