-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `openId` VARCHAR(191) NULL,
    `username` VARCHAR(191) NOT NULL,
    `nickname` VARCHAR(191) NULL,
    `avatarUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `totalGames` INTEGER NOT NULL DEFAULT 0,
    `winCount` INTEGER NOT NULL DEFAULT 0,
    `hitRate` DOUBLE NOT NULL DEFAULT 0,
    `totalPlayTime` DOUBLE NOT NULL DEFAULT 0,
    `avgPlayTime` DOUBLE NOT NULL DEFAULT 0,
    `maxPlayTime` DOUBLE NOT NULL DEFAULT 0,
    `totalHintsUsed` INTEGER NOT NULL DEFAULT 0,
    `avgHintsPerGame` DOUBLE NOT NULL DEFAULT 0,
    `lastPlayedAt` DATETIME(3) NULL,

    UNIQUE INDEX `users_openId_key`(`openId`),
    UNIQUE INDEX `users_username_key`(`username`),
    INDEX `users_hitRate_totalGames_avgPlayTime_idx`(`hitRate`, `totalGames`, `avgPlayTime`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admins` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'SUPER',
    `permissions` VARCHAR(191) NOT NULL DEFAULT '["ALL"]',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `admins_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `questions` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `surface` VARCHAR(191) NOT NULL,
    `bottom` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL DEFAULT 'CLASSIC',
    `hints` VARCHAR(191) NOT NULL,
    `keywords` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'PLATFORM',
    `aiGeneratedBy` VARCHAR(191) NULL,
    `aiGeneratedAt` DATETIME(3) NULL,
    `crawlSource` VARCHAR(191) NULL,
    `crawlUrl` VARCHAR(191) NULL,
    `crawledAt` DATETIME(3) NULL,
    `addedAt` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'APPROVED',
    `softDeletedAt` DATETIME(3) NULL,
    `quality` INTEGER NOT NULL DEFAULT 3,
    `playCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `questions_category_status_idx`(`category`, `status`),
    INDEX `questions_source_status_idx`(`source`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `game_histories` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `playedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `result` VARCHAR(191) NOT NULL,
    `hitRate` DOUBLE NOT NULL DEFAULT 0,
    `playTime` DOUBLE NOT NULL DEFAULT 0,
    `hintUsed` INTEGER NOT NULL DEFAULT 0,
    `revealedAnswer` BOOLEAN NOT NULL DEFAULT false,

    INDEX `game_histories_userId_playedAt_idx`(`userId`, `playedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `game_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `questionSource` VARCHAR(191) NOT NULL DEFAULT 'BANK',
    `status` VARCHAR(191) NOT NULL DEFAULT 'ONGOING',
    `hintUsed` INTEGER NOT NULL DEFAULT 0,
    `hintRemaining` INTEGER NOT NULL DEFAULT 3,
    `inputMode` VARCHAR(191) NULL,
    `result` VARCHAR(191) NULL,
    `hitRate` DOUBLE NULL,
    `revealedAnswer` BOOLEAN NOT NULL DEFAULT false,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endedAt` DATETIME(3) NULL,
    `totalTime` DOUBLE NULL,

    INDEX `game_sessions_userId_status_idx`(`userId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rounds` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `roundNumber` INTEGER NOT NULL,
    `inputMode` VARCHAR(191) NOT NULL,
    `playerInput` VARCHAR(191) NOT NULL,
    `inputAudioUrl` VARCHAR(191) NULL,
    `answerType` VARCHAR(191) NULL,
    `aiResponse` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `rounds_sessionId_roundNumber_idx`(`sessionId`, `roundNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `prompt_library` (
    `id` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `prompt` VARCHAR(191) NOT NULL,
    `usageCount` INTEGER NOT NULL DEFAULT 0,
    `generatedBy` VARCHAR(191) NOT NULL DEFAULT 'AI_AUTO',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `prompt_library_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_configs` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `system_configs_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `operation_logs` (
    `id` VARCHAR(191) NOT NULL,
    `adminId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `target` VARCHAR(191) NULL,
    `detail` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `operation_logs_adminId_createdAt_idx`(`adminId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `admins` ADD CONSTRAINT `admins_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `game_histories` ADD CONSTRAINT `game_histories_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `game_histories` ADD CONSTRAINT `game_histories_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `game_sessions` ADD CONSTRAINT `game_sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `game_sessions` ADD CONSTRAINT `game_sessions_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rounds` ADD CONSTRAINT `rounds_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `game_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;