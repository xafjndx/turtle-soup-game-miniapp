-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "openId" TEXT,
    "username" TEXT NOT NULL,
    "nickname" TEXT,
    "avatarUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "totalGames" INTEGER NOT NULL DEFAULT 0,
    "winCount" INTEGER NOT NULL DEFAULT 0,
    "hitRate" REAL NOT NULL DEFAULT 0,
    "totalPlayTime" REAL NOT NULL DEFAULT 0,
    "avgPlayTime" REAL NOT NULL DEFAULT 0,
    "maxPlayTime" REAL NOT NULL DEFAULT 0,
    "totalHintsUsed" INTEGER NOT NULL DEFAULT 0,
    "avgHintsPerGame" REAL NOT NULL DEFAULT 0,
    "lastPlayedAt" DATETIME
);

-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'SUPER',
    "permissions" TEXT NOT NULL DEFAULT '["ALL"]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "surface" TEXT NOT NULL,
    "bottom" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'CLASSIC',
    "hints" TEXT NOT NULL,
    "keywords" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'PLATFORM',
    "aiGeneratedBy" TEXT,
    "aiGeneratedAt" DATETIME,
    "crawlSource" TEXT,
    "crawlUrl" TEXT,
    "crawledAt" DATETIME,
    "addedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "softDeletedAt" DATETIME,
    "quality" INTEGER NOT NULL DEFAULT 3,
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "game_histories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "playedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" TEXT NOT NULL,
    "hitRate" REAL NOT NULL DEFAULT 0,
    "playTime" REAL NOT NULL DEFAULT 0,
    "hintUsed" INTEGER NOT NULL DEFAULT 0,
    "revealedAnswer" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "game_histories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "game_histories_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "game_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "questionSource" TEXT NOT NULL DEFAULT 'BANK',
    "status" TEXT NOT NULL DEFAULT 'ONGOING',
    "hintUsed" INTEGER NOT NULL DEFAULT 0,
    "hintRemaining" INTEGER NOT NULL DEFAULT 3,
    "inputMode" TEXT,
    "result" TEXT,
    "hitRate" REAL,
    "revealedAnswer" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "totalTime" REAL,
    CONSTRAINT "game_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "game_sessions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "rounds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "inputMode" TEXT NOT NULL,
    "playerInput" TEXT NOT NULL,
    "inputAudioUrl" TEXT,
    "answerType" TEXT,
    "aiResponse" TEXT,
    "action" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rounds_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "game_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "prompt_library" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "generatedBy" TEXT NOT NULL DEFAULT 'AI_AUTO',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "system_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "operation_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "users_openId_key" ON "users"("openId");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_hitRate_totalGames_avgPlayTime_idx" ON "users"("hitRate", "totalGames", "avgPlayTime");

-- CreateIndex
CREATE UNIQUE INDEX "admins_userId_key" ON "admins"("userId");

-- CreateIndex
CREATE INDEX "questions_category_status_idx" ON "questions"("category", "status");

-- CreateIndex
CREATE INDEX "questions_source_status_idx" ON "questions"("source", "status");

-- CreateIndex
CREATE INDEX "game_histories_userId_playedAt_idx" ON "game_histories"("userId", "playedAt");

-- CreateIndex
CREATE INDEX "game_sessions_userId_status_idx" ON "game_sessions"("userId", "status");

-- CreateIndex
CREATE INDEX "rounds_sessionId_roundNumber_idx" ON "rounds"("sessionId", "roundNumber");

-- CreateIndex
CREATE INDEX "prompt_library_category_idx" ON "prompt_library"("category");

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_key_key" ON "system_configs"("key");

-- CreateIndex
CREATE INDEX "operation_logs_adminId_createdAt_idx" ON "operation_logs"("adminId", "createdAt");
