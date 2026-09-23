import type { Config, Context } from "@netlify/functions";
import { eq, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { linkClicks, links } from "../../db/schema.js";

/**
 * Records an outbound tap. Fired with `navigator.sendBeacon` from the hub, so it
 * must stay cheap and must never block the visitor reaching the destination.
 */
export default async (req: Request, context: Context) => {
  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id < 1) return new Response(null, { status: 204 });

  const [link] = await db.select({ id: links.id }).from(links).where(eq(links.id, id)).limit(1);
  if (!link) return new Response(null, { status: 204 });

  const referrer = (req.headers.get("referer") ?? "").slice(0, 300);

  await Promise.all([
    db.update(links).set({ clicks: sql`${links.clicks} + 1` }).where(eq(links.id, id)),
    db.insert(linkClicks).values({ linkId: id, referrer }),
  ]);

  return new Response(null, { status: 204 });
};

export const config: Config = {
  path: "/api/links/:id/click",
  method: "POST",
};
