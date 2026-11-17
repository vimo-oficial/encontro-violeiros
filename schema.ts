import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const registrations = sqliteTable('registrations', {
  id: text('id').primaryKey(),
  requestId: text('request_id').notNull().unique(),
  protocol: text('protocol').notNull().unique(),
  contactName: text('contact_name').notNull(),
  contactWhatsapp: text('contact_whatsapp').notNull(),
  status: text('status').notNull().default('pending'),
  totalParticipants: integer('total_participants').notNull(),
  totalAmount: integer('total_amount').notNull(),
  consent: integer('consent').notNull(),
  createdAt: text('created_at').notNull(),
});
export const participants = sqliteTable('participants', {
  id: text('id').primaryKey(),
  registrationId: text('registration_id').notNull().references(()=>registrations.id,{onDelete:'cascade'}),
  fullName: text('full_name').notNull(),
  city: text('city').notNull(),
  state: text('state').notNull(),
  isVioleiro: integer('is_violeiro').notNull().default(0),
  sortOrder: integer('sort_order').notNull(),
  checkedInAt: text('checked_in_at'),
});
export const tickets = sqliteTable('tickets', {
  number: integer('number').primaryKey({autoIncrement:true}),
  participantId: text('participant_id').notNull().unique().references(()=>participants.id,{onDelete:'cascade'}),
});
export const rateLimits = sqliteTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  expiresAt: integer('expires_at').notNull(),
});

export const raffleSettings = sqliteTable('raffle_settings', {
  id: integer('id').primaryKey(),
  noRepeat: integer('no_repeat').notNull().default(1),
});
export const raffleDraws = sqliteTable('raffle_draws', {
  id: text('id').primaryKey(),
  participantId: text('participant_id').notNull(),
  fullName: text('full_name').notNull(),
  city: text('city').notNull(),
  state: text('state').notNull(),
  participantNumber: integer('participant_number'),
  createdAt: text('created_at').notNull(),
});
