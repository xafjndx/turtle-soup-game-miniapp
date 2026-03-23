# 语音识别问题排查指南

## 当前实现方式

### 方案 B：HTTP 一句话识别（当前使用）

**流程：**
```
小程序录音 (PCM) → 读取为 Base64 → POST /api/voice/recognize → 阿里云 HTTP API → 返回文字
```

**优点：**
- 实现简单
- 适合短句识别（60 秒内）

**缺点：**
- 需要等待录音结束才上传
- 大音频文件上传慢

---

## 常见问题排查

### 1. 检查后端配置

```bash
# 在服务器检查.env 配置
cat server/.env | grep ALIYUN
```

**必须配置：**
- `ALIYUN_ACCESS_KEY_ID`
- `ALIYUN_ACCESS_KEY_SECRET`
- `ALIYUN_NLS_APP_KEY`
- `ALIYUN_NLS_REGION`（可选，默认 cn-shanghai）

---

### 2. 测试语音识别服务

**测试配置接口：**
```bash
curl https://turtle-soup-server-235023-9-1412292669.sh.run.tcloudbase.com/api/voice/test-config
```

**预期响应：**
```json
{
  "code": 0,
  "data": {
    "configured": true,
    "config": {
      "accessKeyId": "LTAI5t****",
      "appKey": "9Vjr****",
      ...
    }
  }
}
```

---

### 3. 小程序端调试

**在 game.ts 中添加日志：**

```typescript
async handleRecordingEnd(res: any) {
  console.log('录音文件路径:', res.tempFilePath);
  console.log('录音时长:', res.duration);
  console.log('录音文件大小:', res.fileSize);
  
  wx.showLoading({ title: '语音识别中...', icon: 'loading' });
  
  try {
    const audioBase64 = await this.readAudioFile(res.tempFilePath);
    console.log('Base64 长度:', audioBase64.length);
    
    const response = await this.callVoiceRecognitionAPI(audioBase64, RECORDER_CONFIG.format);
    console.log('API 响应:', response);
    
    wx.hideLoading();
    
    if (response.code === 0 && response.data?.text) {
      this.setData({ playerInput: response.data.text });
      wx.showToast({ title: '识别成功', icon: 'success', duration: 1000 });
    } else {
      console.error('识别失败:', response.message);
      throw new Error(response.message || '识别失败');
    }
  } catch (err: any) {
    wx.hideLoading();
    console.error('语音识别完整错误:', err);
    this.handleRecognitionFailure(err.message);
  }
}
```

---

### 4. 常见错误及解决方案

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| `语音识别服务未配置` | 后端环境变量未设置 | 检查微信云托管控制台的环境变量 |
| `音频数据格式错误` | Base64 编码问题 | 检查录音格式是否为 PCM |
| `识别失败` | 阿里云 API 返回错误 | 查看后端日志中的详细错误信息 |
| `网络连接失败` | 云托管网络问题 | 检查云托管服务是否正常运行 |
| `录音失败` | 小程序权限问题 | 检查 app.json 是否添加录音权限 |

---

### 5. 替代方案：WebSocket 实时识别

如果 HTTP 方式持续失败，可以切换到 WebSocket 方案（`utils/sr.js`）：

**优点：**
- 实时识别，边说边转文字
- 更适合长语音

**修改步骤：**
1. 在 game.ts 中引入 `SpeechRecognition`
2. 修改 `initRecorder()` 使用 WebSocket
3. 实时接收识别结果

---

## 快速测试命令

```bash
# 1. 检查后端是否正常运行
curl https://turtle-soup-server-235023-9-1412292669.sh.run.tcloudbase.com/health

# 2. 测试语音配置
curl https://turtle-soup-server-235023-9-1412292669.sh.run.tcloudbase.com/api/voice/health

# 3. 获取 Token（需要登录）
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://turtle-soup-server-235023-9-1412292669.sh.run.tcloudbase.com/api/voice/token
```
