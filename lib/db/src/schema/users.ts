import { pgTable, serial, text, timestamp, boolean, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  picture: text("picture"),
  authProvider: text("auth_provider").notNull().default("email"),
  googleId: text("google_id").unique(),
  // Basic profile
  preferredLanguage: text("preferred_language").default("English"),
  age: integer("age"),
  education: text("education"),
  careerGoal: text("career_goal"),
  location: text("location"),
  industryPreference: text("industry_preference"),
  // Extended profile
  gender: text("gender"),
  degree: text("degree"),
  branch: text("branch"),
  graduationYear: text("graduation_year"),
  university: text("university"),
  skills: text("skills"), // JSON array stored as text
  preferredRole: text("preferred_role"),
  preferredCity: text("preferred_city"),
  expectedSalary: text("expected_salary"),
  experienceLevel: text("experience_level").default("Fresher"),
  englishLevel: text("english_level").default("Beginner"),
  voiceGender: text("voice_gender").default("female"),
  voiceStyle: text("voice_style").default("priya"),
  preferredInterviewer: text("preferred_interviewer").default("raj"),
  preferredTutor: text("preferred_tutor").default("priya"),
  // Resume Intelligence
  resumeText: text("resume_text"),
  resumeFileName: text("resume_file_name"),
  resumeAnalysis: text("resume_analysis"), // JSON object stored as text
  experienceSummary: text("experience_summary"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const otpsTable = pgTable("otps", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const learningProgressTable = pgTable("learning_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id),
  tool: text("tool").notNull(),
  activityType: text("activity_type").notNull(),
  score: integer("score"),
  data: text("data"),
  duration: integer("duration"), // seconds
  tutorId: text("tutor_id"),
  mode: text("mode"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const interviewSessionsTable = pgTable("interview_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id),
  role: text("role").notNull(),
  experienceLevel: text("experience_level").notNull(),
  questionsData: text("questions_data"),
  overallScore: integer("overall_score"),
  interviewType: text("interview_type"),
  durationSeconds: integer("duration_seconds"),
  feedbackJson: text("feedback_json"),
  communicationScore: integer("communication_score"),
  grammarScore: integer("grammar_score"),
  confidenceScore: integer("confidence_score"),
  technicalScore: integer("technical_score"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const savedJobsTable = pgTable("saved_jobs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  jobId: text("job_id").notNull(),
  title: text("title").notNull(),
  company: text("company"),
  link: text("link").notNull(),
  location: text("location"),
  salary: text("salary"),
  jobType: text("job_type"),
  source: text("source"),
  applicationStatus: text("application_status").default("saved"),
  savedAt: timestamp("saved_at").defaultNow().notNull(),
});

export const historyItemsTable = pgTable("history_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  tool: text("tool").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  savedAt: timestamp("saved_at").defaultNow().notNull(),
});

export const analyticsEventsTable = pgTable("analytics_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id),
  anonymousId: text("anonymous_id").notNull(),
  event: text("event").notNull(),
  path: text("path").notNull(),
  properties: text("properties"), // JSON
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const lessonProgressTable = pgTable("lesson_progress", {
  id: serial("id").primaryKey(),
  // TEXT so both authenticated user IDs (numeric strings) and guest IDs work
  userId: text("user_id").notNull(),
  lessonId: text("lesson_id").notNull(),
  ease: text("ease").notNull().default("2.5"),     // stored as text to avoid float precision issues
  interval: integer("interval").notNull().default(0),
  repetitions: integer("repetitions").notNull().default(0),
  dueDate: text("due_date").notNull(),             // ISO "YYYY-MM-DD"
  lastScore: integer("last_score"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("lesson_progress_user_lesson_idx").on(table.userId, table.lessonId),
]);

export const webVitalsTable = pgTable("web_vitals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id),
  anonymousId: text("anonymous_id").notNull(),
  name: text("name").notNull(), // CLS, LCP, INP, FCP, TTFB
  value: text("value").notNull(), // stored as text to preserve precision
  rating: text("rating"), // good, needs-improvement, poor
  delta: text("delta"),
  navigationType: text("navigation_type"),
  path: text("path").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const jobSearchCacheTable = pgTable("job_search_cache", {
  cacheKey: text("cache_key").primaryKey(),
  items: text("items").notNull(), // JSON array of LiveItem
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOtpSchema = createInsertSchema(otpsTable).omit({ id: true, createdAt: true });
export const insertLearningProgressSchema = createInsertSchema(learningProgressTable).omit({ id: true, createdAt: true });
export const insertInterviewSessionSchema = createInsertSchema(interviewSessionsTable).omit({ id: true, createdAt: true });
export const insertSavedJobSchema = createInsertSchema(savedJobsTable).omit({ id: true, savedAt: true });
export const insertHistoryItemSchema = createInsertSchema(historyItemsTable).omit({ id: true, savedAt: true });
export const insertAnalyticsEventSchema = createInsertSchema(analyticsEventsTable).omit({ id: true, createdAt: true });
export const insertWebVitalSchema = createInsertSchema(webVitalsTable).omit({ id: true, createdAt: true });
export const insertLessonProgressSchema = createInsertSchema(lessonProgressTable).omit({ id: true, updatedAt: true });

export type User = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Otp = typeof otpsTable.$inferSelect;
export type LearningProgress = typeof learningProgressTable.$inferSelect;
export type InterviewSession = typeof interviewSessionsTable.$inferSelect;
export type SavedJob = typeof savedJobsTable.$inferSelect;
export type HistoryItem = typeof historyItemsTable.$inferSelect;
export type AnalyticsEvent = typeof analyticsEventsTable.$inferSelect;
export type WebVital = typeof webVitalsTable.$inferSelect;
export type LessonProgress = typeof lessonProgressTable.$inferSelect;
