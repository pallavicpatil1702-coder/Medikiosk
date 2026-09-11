import { pgTable, text, timestamp, boolean, integer, jsonb, uuid } from 'drizzle-orm/pg-core';

export const patients = pgTable('patients', {
  id: uuid('id').defaultRandom().primaryKey(),
  abhaId: text('abha_id'),
  name: text('name').notNull(),
  age: integer('age').notNull(),
  gender: text('gender').notNull(),
  contact: text('contact'),
  language: text('language'),
  consent: boolean('consent').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const consents = pgTable('consents', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id').references(() => patients.id).notNull(),
  given: boolean('given').notNull(),
  purpose: text('purpose').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

export const intakeSessions = pgTable('intake_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id').references(() => patients.id).notNull(),
  chiefComplaint: text('chief_complaint'),
  duration: text('duration'),
  associatedSymptoms: jsonb('associated_symptoms').$type<string[]>(),
  medicationTaken: text('medication_taken'),
  allergies: text('allergies'),
  pastMedicalHistory: text('past_medical_history'),
  otherInfo: text('other_info'),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  status: text('status').default('in_progress'), // in_progress, completed
});

export const answers = pgTable('answers', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').references(() => intakeSessions.id).notNull(),
  questionId: text('question_id').notNull(),
  answer: text('answer').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

export const medicalDocuments = pgTable('medical_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id').references(() => patients.id).notNull(),
  fileName: text('file_name').notNull(),
  fileType: text('file_type').notNull(),
  size: text('size').notNull(),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
  extractedData: jsonb('extracted_data'),
});

export const redFlags = pgTable('red_flags', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').references(() => intakeSessions.id).notNull(),
  type: text('type').notNull(),
  description: text('description').notNull(),
  severity: text('severity').notNull(), // high, medium
  detectedAt: timestamp('detected_at').defaultNow().notNull(),
});

export const clinicalSummaries = pgTable('clinical_summaries', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id').references(() => patients.id).notNull(),
  sessionId: uuid('session_id').references(() => intakeSessions.id).notNull(),
  generatedAt: timestamp('generated_at').defaultNow().notNull(),
  medications: text('medications'),
  allergies: text('allergies'),
  pastHistory: text('past_history'),
  investigationResults: text('investigation_results'),
  previousReports: jsonb('previous_reports').$type<string[]>(),
  aiNotes: text('ai_notes'),
  status: text('status').notNull().default('pending'), // pending, reviewed, confirmed
});

export const doctorReviews = pgTable('doctor_reviews', {
  id: uuid('id').defaultRandom().primaryKey(),
  summaryId: uuid('summary_id').references(() => clinicalSummaries.id).notNull(),
  doctorName: text('doctor_name').notNull(),
  doctorId: text('doctor_id').notNull(),
  reviewedAt: timestamp('reviewed_at').defaultNow().notNull(),
  edits: jsonb('edits'),
  confirmed: boolean('confirmed').notNull().default(false),
  notes: text('notes'),
});
