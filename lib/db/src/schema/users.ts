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
  preferredLanguage: text("preferred_language").default("English"),
  age: integer("age"),
  education: text("education"),
  careerGoal: text("career_goal"),
  location: text("location"),
  industryPreference: text("industry_preference"),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const interviewSessionsTable = pgTable("interview_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id),
  role: text("role").notNull(),
  experienceLevel: text("experience_level").notNull(),
  questionsData: text("questions_data"),
  overallScore: integer("overall_score"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOtpSchema = createInsertSchema(otpsTable).omit({ id: true, createdAt: true });
export const insertLearningProgressSchema = createInsertSchema(learningProgressTable).omit({ id: true, createdAt: true });
export const insertInterviewSessionSchema = createInsertSchema(interviewSessionsTable).omit({ id: true, createdAt: true });

export type User = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Otp = typeof otpsTable.$inferSelect;
export type LearningProgress = typeof learningProgressTable.$inferSelect;
export type InterviewSession = typeof interviewSessionsTable.$inferSelect;
