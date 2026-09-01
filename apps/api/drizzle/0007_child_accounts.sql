ALTER TABLE children ADD COLUMN account_id text REFERENCES accounts(id) ON DELETE SET NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX children_account_id_unique ON children(account_id);
