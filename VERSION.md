# 版本记录

## 当前版本: v6dc8b43

### 版本历史

| 版本号 | 时间 | 说明 |
|--------|------|------|
| **v6dc8b43** | 2026-03-19 23:15 | 修复多项bug |
| v172d92d | 2026-03-19 23:00 | 多项UI优化和bug修复 |
| 5e227df | 2026-03-19 22:15 | WebSocket实时语音识别 |
| e2cae04 | 2026-03-19 22:05 | 管理后台新增题目界面优化 |
| 2193b57 | 2026-03-19 22:00 | 标题必填，提示三个输入框 |
| bc92664 | 2026-03-19 21:45 | 修复微信登录功能 |
| a531325 | 2026-03-19 21:35 | 版本号管理 |
| 0fb45aa | 2026-03-19 21:30 | 多项问题修复 |
| b6c4c04 | 2026-03-19 21:00 | Dockerfile修复Prisma缓存 |
| 36e9826 | 2026-03-19 18:50 | 移除submittedBy字段 |
| e09ad8f | 2026-03-19 18:45 | 版本号更新 |
| cc9a773 | 2026-03-19 18:40 | 暂时移除submittedBy |

---

## 如何确认云托管版本

访问健康检查接口：
```
https://turtle-soup-server-235023-9-1412292669.sh.run.tcloudbase.com/health
```

返回示例：
```json
{
  "status": "ok",
  "version": "5e227df",
  "buildTime": "2026-03-19 22:15"
}
```

---

## 版本说明

### 5e227df - WebSocket实时语音识别
- 使用阿里云官方SDK实现WebSocket实时语音识别
- 添加 sr.js - WebSocket语音识别客户端
- 添加 token.js - Token管理
- 添加 /api/voice/token 接口
- 录音格式改为PCM，实时发送音频帧

### e2cae04 - 管理后台新增题目界面优化
- 添加标题输入框（必填）
- 提示改为三个独立输入框，分别对应提示1/2/3
- 后端支持title字段更新

### bc92664 - 修复微信登录功能
- 后端支持code参数，用code换取openId
- 前端使用wx.login()获取code
- 移除已废弃的wx.getUserProfile
- 恢复微信登录按钮

### 36e9826 - 移除submittedBy字段
- 从schema.prisma移除submittedBy字段
- 注释掉代码中对submittedBy的使用
- 解决数据库迁移问题