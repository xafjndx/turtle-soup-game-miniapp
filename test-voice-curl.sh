#!/bin/bash

# 语音识别测试脚本
# 使用方法：./test-voice-curl.sh

set -e

BASE_URL="https://turtle-soup-server-235023-9-1412292669.sh.run.tcloudbase.com"
API_URL="$BASE_URL/api"

echo "======================================"
echo "🎙️  语音识别测试脚本"
echo "======================================"
echo ""

# 步骤 1：获取 Token
echo "📝 步骤 1: 获取登录 Token..."
TOKEN_RESPONSE=$(curl -s -X POST "$API_URL/user/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"voice_test"}')

# 提取 Token（使用 grep 和 sed，避免依赖 jq）
TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"token":"[^"]*"' | sed 's/"token":"//;s/"$//')

if [ -z "$TOKEN" ]; then
  echo "❌ 获取 Token 失败"
  echo "响应：$TOKEN_RESPONSE"
  exit 1
fi

echo "✅ Token 获取成功：${TOKEN:0:20}..."
echo ""

# 步骤 2：测试语音配置
echo "📝 步骤 2: 测试语音服务配置..."
CONFIG_RESPONSE=$(curl -s "$API_URL/voice/test-config")
echo "配置响应：$CONFIG_RESPONSE"
echo ""

# 步骤 3：准备测试音频
echo "📝 步骤 3: 准备测试音频..."

# 检查是否有测试音频文件
TEST_WAV="test_voice.wav"
TEST_PCM="test_voice.pcm"
TEST_B64="test_voice.pcm.b64"

if [ ! -f "$TEST_WAV" ]; then
  echo "ℹ️  未找到测试音频文件 $TEST_WAV"
  echo ""
  echo "请准备一个 WAV 音频文件（1-5 秒的语音），然后："
  echo ""
  echo "1. 转换为 PCM 格式（16kHz, 单声道）："
  echo "   ffmpeg -i $TEST_WAV -f s16le -acodec pcm_s16le -ar 16000 -ac 1 $TEST_PCM"
  echo ""
  echo "2. 转为 Base64："
  echo "   base64 $TEST_PCM > $TEST_B64"
  echo ""
  echo "3. 再次运行此脚本"
  echo ""
  
  # 创建一个空的测试文件用于演示
  echo "🔧 创建一个测试用的空 PCM 文件（仅用于演示流程）..."
  dd if=/dev/zero of=$TEST_PCM bs=1024 count=16 2>/dev/null
  base64 $TEST_PCM > $TEST_B64
  echo "✅ 已创建测试文件（注意：这是静音数据，识别会失败，仅用于测试流程）"
  echo ""
fi

# 步骤 4：读取音频数据
echo "📝 步骤 4: 读取音频数据..."
if [ -f "$TEST_B64" ]; then
  AUDIO_DATA=$(cat $TEST_B64 | tr -d '\n')
  AUDIO_SIZE=${#AUDIO_DATA}
  echo "✅ Base64 数据长度：$AUDIO_SIZE 字符"
else
  echo "❌ 未找到 Base64 文件 $TEST_B64"
  exit 1
fi
echo ""

# 步骤 5：调用语音识别 API
echo "📝 步骤 5: 调用语音识别 API..."
echo "正在识别中..."
echo ""

RECOGNIZE_RESPONSE=$(curl -s -X POST "$API_URL/voice/recognize" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"audio\": \"$AUDIO_DATA\",
    \"format\": \"pcm\"
  }")

echo "======================================"
echo "📊 识别结果："
echo "======================================"
echo "$RECOGNIZE_RESPONSE"
echo ""

# 解析结果（简单检查）
if echo "$RECOGNIZE_RESPONSE" | grep -q '"code":0'; then
  echo "✅ 识别成功！"
  
  # 尝试提取识别的文字
  TEXT=$(echo "$RECOGNIZE_RESPONSE" | grep -o '"text":"[^"]*"' | sed 's/"text":"//;s/"$//' || echo "")
  if [ -n "$TEXT" ]; then
    echo "📝 识别出的文字：$TEXT"
  fi
else
  echo "❌ 识别失败"
  
  # 提取错误信息
  MESSAGE=$(echo "$RECOGNIZE_RESPONSE" | grep -o '"message":"[^"]*"' | sed 's/"message":"//;s/"$//' || echo "")
  if [ -n "$MESSAGE" ]; then
    echo "⚠️  错误信息：$MESSAGE"
  fi
fi

echo ""
echo "======================================"
echo "🔍 完整响应数据："
echo "======================================"
echo "$RECOGNIZE_RESPONSE" | fold -w 80
echo ""

# 清理临时文件（可选）
# rm -f $TEST_PCM $TEST_B64

echo "✅ 测试完成！"
