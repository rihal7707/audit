CREATE TABLE `assistant_analytics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`audit_id` integer NOT NULL,
	`event_type` text NOT NULL,
	`opportunity_category` text,
	`chip_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`audit_id`) REFERENCES `audits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `assistant_analytics_audit_idx` ON `assistant_analytics` (`audit_id`);--> statement-breakpoint
CREATE TABLE `assistant_conversations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`audit_id` integer NOT NULL,
	`conversation_token` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`audit_id`) REFERENCES `audits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `assistant_conversations_audit_id_idx` ON `assistant_conversations` (`audit_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `assistant_conversations_token_idx` ON `assistant_conversations` (`conversation_token`);--> statement-breakpoint
CREATE TABLE `assistant_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conversation_id` integer NOT NULL,
	`role` text NOT NULL,
	`message` text NOT NULL,
	`related_finding_ids` text,
	`metadata_json` text,
	`status` text DEFAULT 'COMPLETED' NOT NULL,
	`model` text,
	`prompt_version` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `assistant_conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `assistant_messages_conv_created_idx` ON `assistant_messages` (`conversation_id`,`created_at`);