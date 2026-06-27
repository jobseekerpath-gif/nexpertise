CREATE TABLE "analytics_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"anonymous_id" text NOT NULL,
	"event" text NOT NULL,
	"path" text NOT NULL,
	"properties" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "history_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"tool" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"saved_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"role" text NOT NULL,
	"experience_level" text NOT NULL,
	"questions_data" text,
	"overall_score" integer,
	"interview_type" text,
	"duration_seconds" integer,
	"feedback_json" text,
	"communication_score" integer,
	"grammar_score" integer,
	"confidence_score" integer,
	"technical_score" integer,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"tool" text NOT NULL,
	"activity_type" text NOT NULL,
	"score" integer,
	"data" text,
	"duration" integer,
	"tutor_id" text,
	"mode" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otps" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"job_id" text NOT NULL,
	"title" text NOT NULL,
	"company" text,
	"link" text NOT NULL,
	"location" text,
	"salary" text,
	"job_type" text,
	"source" text,
	"application_status" text DEFAULT 'saved',
	"saved_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"picture" text,
	"auth_provider" text DEFAULT 'email' NOT NULL,
	"google_id" text,
	"preferred_language" text DEFAULT 'English',
	"age" integer,
	"education" text,
	"career_goal" text,
	"location" text,
	"industry_preference" text,
	"gender" text,
	"degree" text,
	"branch" text,
	"graduation_year" text,
	"university" text,
	"skills" text,
	"preferred_role" text,
	"preferred_city" text,
	"expected_salary" text,
	"experience_level" text DEFAULT 'Fresher',
	"english_level" text DEFAULT 'Beginner',
	"voice_gender" text DEFAULT 'female',
	"voice_style" text DEFAULT 'priya',
	"preferred_interviewer" text DEFAULT 'raj',
	"preferred_tutor" text DEFAULT 'priya',
	"resume_text" text,
	"resume_file_name" text,
	"resume_analysis" text,
	"experience_summary" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id")
);
--> statement-breakpoint
CREATE TABLE "web_vitals" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"anonymous_id" text NOT NULL,
	"name" text NOT NULL,
	"value" text NOT NULL,
	"rating" text,
	"delta" text,
	"navigation_type" text,
	"path" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "history_items" ADD CONSTRAINT "history_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_progress" ADD CONSTRAINT "learning_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_jobs" ADD CONSTRAINT "saved_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_vitals" ADD CONSTRAINT "web_vitals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;