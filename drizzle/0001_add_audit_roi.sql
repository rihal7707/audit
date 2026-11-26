CREATE TABLE `audit_roi` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`audit_id` integer NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`inputs_json` text NOT NULL,
	`scenarios_json` text NOT NULL,
	`selected_scenario` text DEFAULT 'moderate' NOT NULL,
	`outputs_json` text NOT NULL,
	`calc_version` text NOT NULL,
	`interacted` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`audit_id`) REFERENCES `audits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `audit_roi_audit_id_idx` ON `audit_roi` (`audit_id`);