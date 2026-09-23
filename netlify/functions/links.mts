import type { Config, Context } from "@netlify/functions";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { links } from "../../db/schema.js";
import { isAuthenticated, unauthorized } from "../lib/auth.mjs";
import { bad, normaliseUrl, text } from "../lib/validate.mjs";

const MAX_LINKS = 200;

type LinkPayload = {
  title?: unknown;
  subtitle?: unknown;
  url?: unknown;
  category?: unknown;
  glyph?: unknown;
  featured?: unknown;
  active?: unknown;
};

export default async (req: Request, context: Context) => {
  const id = context.params.id ? Number(context.params.id) : null;
  if (context.params.id && (!Number.isInteger(id) || id! < 1)) return bad("Unknown link.");

  const authed = await isAuthenticated(req);

  if (req.method === "GET") {
    const includeHidden = new URL(req.url).searchParams.get("all") === "1";
    if (includeHidden && !authed) return unauthorized();

    const rows = await db
      .select()
      .from(links)
      .orderBy(asc(links.position), asc(links.id));

    return Response.json(includeHidden ? rows : rows.filter((row) => row.active), {
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (!authed) return unauthorized();

  if (req.method === "POST") {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(links);
    if (count >= MAX_LINKS) return bad(`This hub holds a maximum of ${MAX_LINKS} links.`);

    const body = (await req.json().catch(() => ({}))) as LinkPayload;
    const title = text(body.title, 80);
    const url = normaliseUrl(body.url);
    if (!title) return bad("Give the link a title.");
    if (!url) return bad("That web address does not look right. Use a full https:// link.");

    const [{ next }] = await db
      .select({ next: sql<number>`coalesce(max(${links.position}), -1)::int + 1` })
      .from(links);

    const [created] = await db
      .insert(links)
      .values({
        title,
        subtitle: text(body.subtitle, 120),
        url,
        category: text(body.category, 40) || "general",
        glyph: text(body.glyph, 24) || "link",
        featured: body.featured === true,
        active: body.active !== false,
        position: next,
      })
      .returning();

    return Response.json(created, { status: 201 });
  }

  if (req.method === "PATCH") {
    if (!id) return bad("Unknown link.");
    const body = (await req.json().catch(() => ({}))) as LinkPayload;
    const patch: Record<string, unknown> = { updatedAt: new Date() };

    if (body.title !== undefined) {
      const title = text(body.title, 80);
      if (!title) return bad("Give the link a title.");
      patch.title = title;
    }
    if (body.url !== undefined) {
      const url = normaliseUrl(body.url);
      if (!url) return bad("That web address does not look right. Use a full https:// link.");
      patch.url = url;
    }
    if (body.subtitle !== undefined) patch.subtitle = text(body.subtitle, 120);
    if (body.category !== undefined) patch.category = text(body.category, 40) || "general";
    if (body.glyph !== undefined) patch.glyph = text(body.glyph, 24) || "link";
    if (body.featured !== undefined) patch.featured = body.featured === true;
    if (body.active !== undefined) patch.active = body.active === true;

    const [updated] = await db.update(links).set(patch).where(eq(links.id, id)).returning();
    if (!updated) return Response.json({ error: "That link no longer exists." }, { status: 404 });
    return Response.json(updated);
  }

  if (req.method === "DELETE") {
    if (!id) return bad("Unknown link.");
    const [deleted] = await db.delete(links).where(eq(links.id, id)).returning({ id: links.id });
    if (!deleted) return Response.json({ error: "That link no longer exists." }, { status: 404 });
    return new Response(null, { status: 204 });
  }

  // PUT /api/links reorders the whole hub in one call: { order: [id, id, ...] }
  if (req.method === "PUT") {
    const body = (await req.json().catch(() => ({}))) as { order?: unknown };
    const order = Array.isArray(body.order) ? body.order.map(Number) : [];
    if (!order.length || order.some((value) => !Number.isInteger(value))) return bad("Send a list of link ids.");

    const existing = await db.select({ id: links.id }).from(links).where(inArray(links.id, order));
    if (existing.length !== order.length) return bad("That ordering refers to a link that no longer exists.");

    await Promise.all(
      order.map((linkId, index) =>
        db.update(links).set({ position: index, updatedAt: new Date() }).where(eq(links.id, linkId)),
      ),
    );

    const rows = await db.select().from(links).orderBy(asc(links.position), asc(links.id));
    return Response.json(rows);
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: ["/api/links", "/api/links/:id"],
};
