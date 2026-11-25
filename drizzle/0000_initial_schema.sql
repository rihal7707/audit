CREATE TABLE `audit_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`audit_id` integer NOT NULL,
	`event_type` text NOT NULL,
	`message` text NOT NULL,
	`metadata` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`audit_id`) REFERENCES `audits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `audit_events_audit_created_idx` ON `audit_events` (`audit_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `audit_findings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`audit_id` integer NOT NULL,
	`category` text NOT NULL,
	`finding` text NOT NULL,
	`priority` text NOT NULL,
	`evidence_type` text NOT NULL,
	`confidence` text NOT NULL,
	`evidence` text NOT NULL,
	`recommendation` text NOT NULL,
	FOREIGN KEY (`audit_id`) REFERENCES `audits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `audit_findings_audit_id_idx` ON `audit_findings` (`audit_id`);--> statement-breakpoint
CREATE TABLE `audit_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`audit_id` integer NOT NULL,
	`note` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`audit_id`) REFERENCES `audits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `audit_notes_audit_id_idx` ON `audit_notes` (`audit_id`);--> statement-breakpoint
CREATE TABLE `audit_pages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`audit_id` integer NOT NULL,
	`page_label` text NOT NULL,
	`url` text NOT NULL,
	`page_title` text,
	`http_status` integer,
	`extracted_text` text,
	`extracted_metadata` text,
	`content_hash` text,
	`extraction_status` text NOT NULL,
	`fetched_at` text NOT NULL,
	FOREIGN KEY (`audit_id`) REFERENCES `audits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `audit_pages_audit_id_idx` ON `audit_pages` (`audit_id`);--> statement-breakpoint
CREATE TABLE `audit_stage_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`audit_id` integer NOT NULL,
	`from_stage` text,
	`to_stage` text NOT NULL,
	`reason` text,
	`changed_at` text NOT NULL,
	FOREIGN KEY (`audit_id`) REFERENCES `audits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `audit_stage_history_audit_id_idx` ON `audit_stage_history` (`audit_id`);--> statement-breakpoint
CREATE TABLE `audits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_token` text NOT NULL,
	`business_name` text NOT NULL,
	`website` text NOT NULL,
	`normalized_domain` text NOT NULL,
	`industry` text NOT NULL,
	`country` text NOT NULL,
	`location` text,
	`business_size` text,
	`business_description` text NOT NULL,
	`challenges` text NOT NULL,
	`goals` text NOT NULL,
	`tools_used` text,
	`enquiry_volume` text,
	`phone_volume` text,
	`team_size` text,
	`manual_processes` text,
	`timeframe` text,
	`contact_name` text NOT NULL,
	`contact_email` text NOT NULL,
	`contact_phone` text,
	`contact_role` text,
	`is_free_email_domain` integer DEFAULT false NOT NULL,
	`consent` integer NOT NULL,
	`consent_version` text NOT NULL,
	`consent_at` text NOT NULL,
	`marketing_consent` integer DEFAULT false NOT NULL,
	`audit_status` text DEFAULT 'QUEUED' NOT NULL,
	`current_stage_index` integer DEFAULT 0 NOT NULL,
	`current_stage_label` text DEFAULT 'Queued' NOT NULL,
	`heartbeat_at` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`crawl_coverage` text,
	`crawl_failure_reason` text,
	`lead_score` integer DEFAULT 0 NOT NULL,
	`lead_score_breakdown` text,
	`lead_reason` text,
	`lead_priority` text DEFAULT 'NURTURE' NOT NULL,
	`lead_priority_override` text,
	`lead_priority_override_reason` text,
	`pipeline_stage` text DEFAULT 'NEW' NOT NULL,
	`stage_entered_at` text NOT NULL,
	`follow_up_at` text,
	`consult_requested_at` text,
	`pilot_requested_at` text,
	`booking_clicked_at` text,
	`release_status` text DEFAULT 'AUTO' NOT NULL,
	`report_json` text,
	`report_version` text,
	`prompt_version` text,
	`model` text,
	`supplement_text` text,
	`supplement_count` integer DEFAULT 0 NOT NULL,
	`dedupe_key` text NOT NULL,
	`ip_hash` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `audits_public_token_idx` ON `audits` (`public_token`);--> statement-breakpoint
CREATE INDEX `audits_pipeline_stage_idx` ON `audits` (`pipeline_stage`);--> statement-breakpoint
CREATE INDEX `audits_status_idx` ON `audits` (`audit_status`);--> statement-breakpoint
CREATE INDEX `audits_created_at_idx` ON `audits` (`created_at`);--> statement-breakpoint
CREATE INDEX `audits_dedupe_key_idx` ON `audits` (`dedupe_key`);--> statement-breakpoint
CREATE TABLE `crawl_cache` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`origin_hash` text NOT NULL,
	`payload_json` text NOT NULL,
	`fetched_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crawl_cache_origin_hash_idx` ON `crawl_cache` (`origin_hash`);--> statement-breakpoint
CREATE TABLE `processing_locks` (
	`audit_id` integer PRIMARY KEY NOT NULL,
	`acquired_at` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`audit_id`) REFERENCES `audits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rate_limits_key_window_idx` ON `rate_limits` (`key`,`window_start`);