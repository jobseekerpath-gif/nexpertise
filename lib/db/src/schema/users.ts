import { pgTable, serial, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
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

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOtpSchema = createInsertSchema(otpsTable).omit({ id: true, createdAt: true });
export const insertLearningProgressSchema = createInsertSchema(learningProgressTable).omit({ id: true, createdAt: true });
export const insertInterviewSessionSchema = createInsertSchema(interviewSessionsTable).omit({ id: true, createdAt: true });
export const insertSavedJobSchema = createInsertSchema(savedJobsTable).omit({ id: true, savedAt: true });
export const insertHistoryItemSchema = createInsertSchema(historyItemsTable).omit({ id: true, savedAt: true });

export type User = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Otp = typeof otpsTable.$inferSelect;
export type LearningProgress = typeof learningProgressTable.$inferSelect;
export type InterviewSession = typeof interviewSessionsTable.$inferSelect;
export type SavedJob = typeof savedJobsTable.$inferSelect;
export type HistoryItem = typeof historyItemsTable.$inferSelect;
