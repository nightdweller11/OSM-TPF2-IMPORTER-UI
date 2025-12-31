import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
} from "drizzle-orm/sqlite-core";

// ============================================
// SQLite Schema (used for both SQLite and as base types)
// When using PostgreSQL, we use the same table structure
// ============================================

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: integer("email_verified", { mode: "timestamp" }),
  image: text("image"),
  role: text("role").$type<"USER" | "ADMIN">().default("USER").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export const accounts = sqliteTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<"oauth" | "oidc" | "email">().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

export const sessions = sqliteTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp" }).notNull(),
});

export const verificationTokens = sqliteTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

export const conversions = sqliteTable("conversions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  minLat: real("min_lat").notNull(),
  minLon: real("min_lon").notNull(),
  maxLat: real("max_lat").notNull(),
  maxLon: real("max_lon").notNull(),
  centerLat: real("center_lat").notNull(),
  centerLon: real("center_lon").notNull(),
  mapWidth: integer("map_width").notNull(),
  mapHeight: integer("map_height").notNull(),
  mapPreset: text("map_preset"),
  config: text("config").$type<string>().default("{}"),
  stats: text("stats"),
  osmFile: text("osm_file"),
  luaFile: text("lua_file"),
  logFile: text("log_file"),
  thumbnail: text("thumbnail"),
  status: text("status").$type<"PENDING" | "DOWNLOADING_OSM" | "PROCESSING" | "OPTIMIZING" | "COMPLETED" | "FAILED">().default("PENDING").notNull(),
  progress: integer("progress").default(0).notNull(),
  errorMsg: text("error_msg"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  isPublic: integer("is_public", { mode: "boolean" }).default(true).notNull(),
  featured: integer("featured", { mode: "boolean" }).default(false).notNull(),
  downloads: integer("downloads").default(0).notNull(),
});

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Conversion = typeof conversions.$inferSelect;
export type NewConversion = typeof conversions.$inferInsert;
export type ConversionStatus = "PENDING" | "DOWNLOADING_OSM" | "PROCESSING" | "OPTIMIZING" | "COMPLETED" | "FAILED";
