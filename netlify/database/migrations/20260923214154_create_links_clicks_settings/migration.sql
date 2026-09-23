CREATE TABLE "link_clicks" (
	"id" serial PRIMARY KEY,
	"link_id" integer NOT NULL,
	"referrer" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "links" (
	"id" serial PRIMARY KEY,
	"title" text NOT NULL,
	"subtitle" text DEFAULT '' NOT NULL,
	"url" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"glyph" text DEFAULT 'link' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY,
	"value" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "link_clicks_link_id_idx" ON "link_clicks" ("link_id");--> statement-breakpoint
CREATE INDEX "links_position_idx" ON "links" ("position");--> statement-breakpoint
ALTER TABLE "link_clicks" ADD CONSTRAINT "link_clicks_link_id_links_id_fkey" FOREIGN KEY ("link_id") REFERENCES "links"("id") ON DELETE CASCADE;