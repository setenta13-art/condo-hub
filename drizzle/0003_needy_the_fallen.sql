CREATE TABLE `blocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`condominiumId` int NOT NULL,
	`name` varchar(80) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `blocks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `units` (
	`id` int AUTO_INCREMENT NOT NULL,
	`condominiumId` int NOT NULL,
	`blockId` int,
	`identifier` varchar(40) NOT NULL,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `units_id` PRIMARY KEY(`id`)
);
