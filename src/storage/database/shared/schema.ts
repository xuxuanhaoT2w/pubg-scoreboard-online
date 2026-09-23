import { pgTable, serial, timestamp, varchar, jsonb, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 房间：固定车队一个开黑房间，通过房间码 / 链接加入
export const rooms = pgTable(
	"rooms",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		name: varchar("name", { length: 64 }).notNull().default("开黑计分板"),
		join_code: varchar("join_code", { length: 8 }).notNull(),
		created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
	},
	(table) => [index("rooms_join_code_idx").on(table.join_code)],
);

// 房间队员
export const players = pgTable(
	"players",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		room_id: varchar("room_id", { length: 36 }).notNull().references(() => rooms.id, { onDelete: "cascade" }),
		name: varchar("name", { length: 40 }).notNull(),
		created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
	},
	(table) => [index("players_room_id_idx").on(table.room_id)],
);

// 已结算对局：data 存整局明细（参战/击杀/吃鸡/每人得分）
export const games = pgTable(
	"games",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		room_id: varchar("room_id", { length: 36 }).notNull().references(() => rooms.id, { onDelete: "cascade" }),
		data: jsonb("data").notNull(),
		played_at: timestamp("played_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
	},
	(table) => [
		index("games_room_id_idx").on(table.room_id),
		index("games_played_at_idx").on(table.played_at),
	],
);

// 当前进行中的一局草稿：所有人实时协同填写（击杀/吃鸡/参战）
export const drafts = pgTable(
	"drafts",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		room_id: varchar("room_id", { length: 36 }).notNull().unique().references(() => rooms.id, { onDelete: "cascade" }),
		payload: jsonb("payload").notNull(),
		updated_by: varchar("updated_by", { length: 36 }),
		updated_at: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
	},
	(table) => [index("drafts_room_id_idx").on(table.room_id)],
);
