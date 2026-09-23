import { pgTable, serial, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";

/**
 * Every link that appears on the public hub. `position` drives display order,
 * `clicks` is a denormalised counter so the public page never has to aggregate.
 */
export const links = pgTable(
  "links",
  {
    id: serial().primaryKey(),
    title: text().notNull(),
    subtitle: text().notNull().default(""),
    url: text().notNull(),
    category: text().notNull().default("general"),
    glyph: text().notNull().default("link"),
    featured: boolean().notNull().default(false),
    active: boolean().notNull().default(true),
    position: integer().notNull().default(0),
    clicks: integer().notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("links_position_idx").on(table.position)],
);

/** One row per outbound click, kept for the 30-day activity chart in the studio. */
export const linkClicks = pgTable(
  "link_clicks",
  {
    id: serial().primaryKey(),
    linkId: integer("link_id")
      .notNull()
      .references(() => links.id, { onDelete: "cascade" }),
    referrer: text().notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("link_clicks_link_id_idx").on(table.linkId)],
);

/** Key/value store for the profile header and the studio passcode credentials. */
export const settings = pgTable("settings", {
  key: text().primaryKey(),
  value: text().notNull().default(""),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
