# 微信登录配置指南

## 问题原因
当前微信登录显示"微信登录服务不可用"是因为服务器的微信配置未设置。

## 配置步骤

### 1. 获取微信小程序 AppSecret

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 使用小程序管理员账号登录
3. 进入 **开发** -> **开发管理** -> **开发设置**
4. 找到 **开发者 ID** 区域
5. 复制 **AppID(小程序 ID)** 和 **AppSecret(小程序密钥)**

当前小程序 AppID: `wx1671cca066fba8d7`

### 2. 配置服务器环境变量

编辑服务器上的 `.env` 文件：

```bash
# 微信小程序配置
WECHAT_APPID=wx1671cca066fba8d7
WECHAT_SECRET=你的小程序密钥（32 位字符）
```

### 3. 配置服务器域名（重要！）

在微信公众平台配置服务器域名：

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入 **开发** -> **开发管理** -> **开发设置**
3. 找到 **服务器域名** 区域
4. 配置 **request 合法域名**：
   - `https://turtle-soup-server-235023-9-1412292669.sh.run.tcloudbase.com`

### 4. 重启服务器

配置完成后，重启后端服务：

```bash
cd /home/xiaifeng/.openclaw/agents/coder/turtle-soup-game/server
pm2 restart turtle-soup-server
# 或者
npm run build && npm start
```

## 临时解决方案

在微信配置完成前，可以使用以下方式登录：

1. **用户名登录**：输入任意用户名即可创建账号
2. **选择已有账号**：点击之前创建的用户账号

## 验证配置

配置完成后，可以通过以下方式验证：

```bash
# 测试微信登录配置
curl https://turtle-soup-server-235023-9-1412292669.sh.run.tcloudbase.com/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"code":"test-code"}'
```

如果配置正确，会返回微信相关的错误信息（因为 code 是假的），但不会显示"未配置"错误。

## 注意事项

- ⚠️ AppSecret 是敏感信息，不要提交到 Git
- ⚠️ 服务器域名必须使用 HTTPS
- ⚠️ 小程序版本必须是已发布或体验版才能使用微信登录
- ⚠️ 开发版小程序需要在微信公众平台配置开发版服务器域名
