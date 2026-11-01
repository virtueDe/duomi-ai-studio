-- Duomi uses Sub2API user ids and keeps its project/generation data separate from CanvasMind accounts.
CREATE TABLE `duomi_users` (
    `id` VARCHAR(36) NOT NULL,
    `sub_user_id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(100) NULL,
    `name` VARCHAR(100) NULL,
    `email` VARCHAR(191) NULL,
    `avatar_url` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    UNIQUE INDEX `uk_duomi_users_sub_user_id`(`sub_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='Duomi Sub2API 用户映射';

CREATE TABLE `duomi_projects` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `data_json` JSON NOT NULL,
    `metadata_json` JSON NOT NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    INDEX `idx_duomi_projects_user_updated_at`(`user_id`, `is_deleted`, `updated_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='Duomi 云端创作项目';

CREATE TABLE `duomi_generations` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NULL,
    `kind` ENUM('IMAGE', 'VIDEO') NOT NULL,
    `status` ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELED') NOT NULL DEFAULT 'PENDING',
    `model` VARCHAR(191) NULL,
    `prompt` TEXT NULL,
    `upstream_task_id` VARCHAR(191) NULL,
    `result_url` TEXT NULL,
    `thumbnail_url` TEXT NULL,
    `expires_at` DATETIME(3) NULL,
    `error_message` TEXT NULL,
    `request_json` JSON NULL,
    `response_json` JSON NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    INDEX `idx_duomi_generations_user_created_at`(`user_id`, `is_deleted`, `created_at`),
    INDEX `idx_duomi_generations_project_created_at`(`project_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='Duomi 图片视频生成记录';

CREATE TABLE `duomi_assets` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NULL,
    `kind` ENUM('IMAGE', 'VIDEO') NOT NULL,
    `source_url` TEXT NULL,
    `storage_key` VARCHAR(512) NULL,
    `expires_at` DATETIME(3) NULL,
    `metadata_json` JSON NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    INDEX `idx_duomi_assets_user_created_at`(`user_id`, `is_deleted`, `created_at`),
    INDEX `idx_duomi_assets_project_created_at`(`project_id`, `is_deleted`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='Duomi 媒体资产索引';

ALTER TABLE `duomi_projects` ADD CONSTRAINT `duomi_projects_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `duomi_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `duomi_generations` ADD CONSTRAINT `duomi_generations_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `duomi_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `duomi_generations` ADD CONSTRAINT `duomi_generations_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `duomi_projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `duomi_assets` ADD CONSTRAINT `duomi_assets_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `duomi_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `duomi_assets` ADD CONSTRAINT `duomi_assets_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `duomi_projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
