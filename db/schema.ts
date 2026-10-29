import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const arena = sqliteTable("arena", { id: text("id").primaryKey(), body: text("body").notNull(), version: integer("version").notNull().default(0) });
