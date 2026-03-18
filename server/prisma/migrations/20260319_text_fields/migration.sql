-- 修改 questions 表字段类型
ALTER TABLE `questions` MODIFY COLUMN `title` VARCHAR(100);
ALTER TABLE `questions` MODIFY COLUMN `surface` TEXT;
ALTER TABLE `questions` MODIFY COLUMN `bottom` TEXT;
ALTER TABLE `questions` MODIFY COLUMN `hints` TEXT;
ALTER TABLE `questions` MODIFY COLUMN `keywords` TEXT;
ALTER TABLE `questions` MODIFY COLUMN `category` VARCHAR(20);
ALTER TABLE `questions` MODIFY COLUMN `source` VARCHAR(20);
ALTER TABLE `questions` MODIFY COLUMN `aiGeneratedBy` VARCHAR(100);
ALTER TABLE `questions` MODIFY COLUMN `crawlSource` VARCHAR(100);
ALTER TABLE `questions` MODIFY COLUMN `crawlUrl` VARCHAR(500);
ALTER TABLE `questions` MODIFY COLUMN `status` VARCHAR(20);

-- 修改 rounds 表字段类型
ALTER TABLE `rounds` MODIFY COLUMN `inputMode` VARCHAR(10);
ALTER TABLE `rounds` MODIFY COLUMN `playerInput` TEXT;
ALTER TABLE `rounds` MODIFY COLUMN `inputAudioUrl` VARCHAR(500);
ALTER TABLE `rounds` MODIFY COLUMN `answerType` VARCHAR(20);
ALTER TABLE `rounds` MODIFY COLUMN `aiResponse` TEXT;
ALTER TABLE `rounds` MODIFY COLUMN `action` VARCHAR(10);