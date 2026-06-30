CREATE TABLE IF NOT EXISTS "job_search_cache" (
	"cache_key" text PRIMARY KEY NOT NULL,
	"items" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
