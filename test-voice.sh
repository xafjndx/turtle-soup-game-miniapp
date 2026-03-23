# 语音识别测试脚本

## 测试步骤

### 1. 获取登录 Token

首先需要登录获取 Token（可以使用微信开发者工具或 Postman）：

```bash
# 登录接口
curl -X POST https://turtle-soup-server-235023-9-1412292669.sh.run.tcloudbase.com/api/user/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser"
  }'
```

响应示例：
```json
{
  "code": 0,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {...}
  }
}
```

---

### 2. 测试语音识别

使用获取的 Token 测试语音识别：

```bash
# 替换 YOUR_TOKEN 为实际 Token
TOKEN="YOUR_TOKEN"

# 准备测试音频（需要 PCM 格式的 Base64 数据）
# 可以使用以下命令转换 WAV 到 PCM：
# ffmpeg -i test.wav -f s16le -acodec pcm_s16le -ar 16000 -ac 1 test.pcm
# 然后 Base64 编码：
# base64 test.pcm > test.pcm.b64

# 测试语音识别
curl -X POST https://turtle-soup-server-235023-9-1412292669.sh.run.tcloudbase.com/api/voice/recognize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "audio": "BASE64_ENCODED_PCM_AUDIO_DATA",
    "format": "pcm"
  }'
```

---

### 3. 预期响应

**成功响应：**
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "text": "识别出的文字内容",
    "format": "pcm",
    "size": 12345
  }
}
```

**失败响应：**
```json
{
  "code": 4003,
  "message": "语音识别失败",
  "data": {
    "errorType": "RECOGNITION_FAILED"
  }
}
```

---

### 4. 常见错误码

| Code | 说明 | 解决方案 |
|------|------|----------|
| 401 | 未登录 | 检查 Token 是否有效 |
| 400 | 音频格式错误 | 确保使用 PCM 格式 |
| 4003 | 识别失败 | 检查阿里云配置 |
| 503 | 服务不可用 | 检查环境变量配置 |

---

## 快速测试（使用真实音频）

### 方法 1：使用微信开发者工具

1. 打开微信开发者工具
2. 进入 Console 控制台
3. 运行以下代码：

```javascript
// 测试录音和识别
const recorderManager = wx.getRecorderManager();

recorderManager.onStart(() => {
  console.log('开始录音');
});

recorderManager.onStop((res) => {
  console.log('录音结束:', res);
  console.log('文件路径:', res.tempFilePath);
  console.log('时长:', res.duration);
  console.log('文件大小:', res.fileSize);
  
  // 读取为 Base64
  wx.getFileSystemManager().readFile({
    filePath: res.tempFilePath,
    encoding: 'base64',
    success: (fileRes) => {
      console.log('Base64 长度:', fileRes.data.length);
      // 这里可以调用 API 测试
    }
  });
});

// 开始录音 3 秒
recorderManager.start({
  duration: 3000,
  sampleRate: 16000,
  numberOfChannels: 1,
  format: 'pcm'
});
```

---

### 方法 2：使用测试音频文件

准备一个测试音频文件（PCM, 16kHz, 单声道）：

```bash
# 如果有 WAV 文件，转换为 PCM
ffmpeg -i test.wav -f s16le -acodec pcm_s16le -ar 16000 -ac 1 test.pcm

# 转为 Base64
base64 test.pcm > test.pcm.b64

# 读取 Base64 内容
AUDIO_DATA=$(cat test.pcm.b64 | tr -d '\n')

# 获取 Token（替换 username）
TOKEN_RESPONSE=$(curl -s -X POST https://turtle-soup-server-235023-9-1412292669.sh.run.tcloudbase.com/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test"}')

# 提取 Token（需要 jq）
TOKEN=$(echo $TOKEN_RESPONSE | jq -r '.data.token')

# 测试识别
curl -X POST https://turtle-soup-server-235023-9-1412292669.sh.run.tcloudbase.com/api/voice/recognize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"audio\": \"$AUDIO_DATA\",
    \"format\": \"pcm\"
  }" | jq .
```

---

## 调试日志

### 后端日志查看

在微信云托管控制台查看实时日志，搜索关键词：
- `语音识别`
- `VoiceService`
- `nls-gateway`

### 小程序日志查看

在微信开发者工具 Console 中查看：
- 录音文件路径
- Base64 长度
- API 响应

---

## 如果测试失败

1. **检查 Token 是否有效**：
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://turtle-soup-server-235023-9-1412292669.sh.run.tcloudbase.com/api/user/profile
   ```

2. **检查音频格式**：
   - 必须是 PCM 格式
   - 采样率 16000Hz
   - 单声道

3. **检查音频大小**：
   - 最大支持 5MB
   - 建议录音时长 < 60 秒

4. **联系支持**：
   - 邮箱：support@turtlesoup.com
