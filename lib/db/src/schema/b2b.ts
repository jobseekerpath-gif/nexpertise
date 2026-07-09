import {
  pgTable, serial, text, timestamp, boolean, integer, uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * B2B company accounts — separate from student users.
 * Companies buy credits and send interview links to candidates.
 */
export const b2bCompaniesTable = pgTable("b2b_companies", {
  id:           serial("id").primaryKey(),
  name:         text("name").notNull(),
  email:        text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),   // PBKDF2-SHA256
  passwordSalt: text("password_salt").notNull(),
  credits:      integer("credits").notNull().default(0),
  phone:        text("phone"),
  industry:     text("industry"),
  website:      text("website"),
  /** When true the company name is hidden from candidates on the interview landing page */
  isAnonymous:  boolean("is_anonymous").notNull().default(false),
  signupIp:     text("signup_ip"),
  signupLocation: text("signup_location"),
  lastLoginIp:  text("last_login_ip"),
  lastLoginLocation: text("last_login_location"),
  lastLoginAt:  timestamp("last_login_at"),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
  updatedAt:    timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Interview campaigns — each campaign is a reusable template
 * (role, type, duration, interviewer) that multiple invites share.
 */
export const b2bCampaignsTable = pgTable("b2b_campaigns", {
  id:               serial("id").primaryKey(),
  companyId:        integer("company_id").references(() => b2bCompaniesTable.id, { onDelete: "cascade" }).notNull(),
  title:            text("title").notNull(),
  role:             text("role").notNull(),
  experienceLevel:  text("experience_level").notNull().default("Fresher"),
  interviewType:    text("interview_type").notNull().default("hr"),
  /** Coach ID from INTERVIEW_COACHES — e.g. "raj", "priya" */
  coachId:          text("coach_id").notNull().default("raj"),
  durationMinutes:  integer("duration_minutes").notNull().default(15),
  description:      text("description"),
  isActive:         boolean("is_active").notNull().default(true),
  createdAt:        timestamp("created_at").defaultNow().notNull(),
});

/**
 * Individual invite links — one per candidate. Each has a unique token
 * that the candidate clicks to reach the pre-configured interview.
 */
export const b2bInvitesTable = pgTable("b2b_invites", {
  id:                  serial("id").primaryKey(),
  companyId:           integer("company_id").references(() => b2bCompaniesTable.id, { onDelete: "cascade" }).notNull(),
  campaignId:          integer("campaign_id").references(() => b2bCampaignsTable.id, { onDelete: "cascade" }).notNull(),
  /** UUID used as the URL token — never guessable. */
  token:               text("token").notNull().unique(),
  candidateEmail:      text("candidate_email"),
  candidateName:       text("candidate_name"),
  /** pending | sent | started | completed | expired */
  status:              text("status").notNull().default("pending"),
  /** Linked after the candidate completes the interview. */
  interviewSessionId:  integer("interview_session_id"),
  /** IP of the candidate when they started the interview. */
  candidateIp:         text("candidate_ip"),
  candidateLocation:   text("candidate_location"),
  sentAt:              timestamp("sent_at"),
  startedAt:           timestamp("started_at"),
  completedAt:         timestamp("completed_at"),
  createdAt:           timestamp("created_at").defaultNow().notNull(),
});

/** Credit transactions for B2B companies — audit ledger. */
export const b2bCreditTransactionsTable = pgTable("b2b_credit_transactions", {
  id:           serial("id").primaryKey(),
  companyId:    integer("company_id").references(() => b2bCompaniesTable.id, { onDelete: "cascade" }).notNull(),
  amount:       integer("amount").notNull(),        // signed: + grant, - spend
  balanceAfter: integer("balance_after").notNull(),
  type:         text("type").notNull(),             // purchase | spend_interview | signup_grant | adjustment
  description:  text("description"),
  reference:    text("reference"),                  // idempotency key
  createdAt:    timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("b2b_credit_tx_type_ref_idx").on(table.type, table.reference),
]);

/** UPI top-up requests from B2B companies — admin approves. */
export const b2bUpiPaymentsTable = pgTable("b2b_upi_payments", {
  id:               serial("id").primaryKey(),
  companyId:        integer("company_id").references(() => b2bCompaniesTable.id, { onDelete: "cascade" }).notNull(),
  credits:          integer("credits").notNull(),
  amountInr:        integer("amount_inr").notNull(),
  utr:              text("utr").notNull(),
  status:           text("status").notNull().default("pending"),
  rejectionReason:  text("rejection_reason"),
  approvedBy:       integer("approved_by"),
  reversedBy:       integer("reversed_by"),
  reversedAt:       timestamp("reversed_at"),
  createdAt:        timestamp("created_at").defaultNow().notNull(),
  updatedAt:        timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("b2b_upi_payments_utr_idx").on(table.utr),
]);

export type B2BCompany    = typeof b2bCompaniesTable.$inferSelect;
export type B2BCampaign   = typeof b2bCampaignsTable.$inferSelect;
export type B2BInvite     = typeof b2bInvitesTable.$inferSelect;
export type B2BUpiPayment = typeof b2bUpiPaymentsTable.$inferSelect;
