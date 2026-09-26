CREATE TABLE `invitations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`condominiumId` int NOT NULL,
	`createdById` int NOT NULL,
	`acceptedById` int,
	`email` varchar(320),
	`token` varchar(96) NOT NULL,
	`role` enum('resident','staff','manager') NOT NULL DEFAULT 'resident',
	`unit` varchar(40),
	`block` varchar(40),
	`status` enum('pending','accepted','expired','revoked') NOT NULL DEFAULT 'pending',
	`expiresAt` timestamp NOT NULL,
	`acceptedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `invitations_token_unique` UNIQUE(`token`)
);
