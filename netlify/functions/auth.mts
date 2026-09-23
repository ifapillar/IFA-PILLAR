import type { Config, Context } from "@netlify/functions";
import {
  clearSessionCookie,
  isAuthenticated,
  isConfigured,
  issueSessionCookie,
  setPasscode,
  verifyPasscode,
} from "../lib/auth.mjs";

const MIN_PASSCODE = 8;

export default async (req: Request, context: Context) => {
  const action = context.params.action;

  if (action === "status") {
    return Response.json({
      configured: await isConfigured(),
      signedIn: await isAuthenticated(req),
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (action === "logout") {
    return new Response(null, { status: 204, headers: { "Set-Cookie": clearSessionCookie() } });
  }

  const body = (await req.json().catch(() => ({}))) as { passcode?: string };
  const passcode = typeof body.passcode === "string" ? body.passcode : "";

  if (action === "setup") {
    if (await isConfigured()) {
      return Response.json({ error: "A passcode is already set for this studio." }, { status: 409 });
    }
    if (passcode.length < MIN_PASSCODE) {
      return Response.json(
        { error: `Choose a passcode of at least ${MIN_PASSCODE} characters.` },
        { status: 400 },
      );
    }
    await setPasscode(passcode);
    return Response.json({ signedIn: true }, { headers: { "Set-Cookie": await issueSessionCookie() } });
  }

  if (action === "login") {
    if (!(await verifyPasscode(passcode))) {
      return Response.json({ error: "That passcode does not match." }, { status: 401 });
    }
    return Response.json({ signedIn: true }, { headers: { "Set-Cookie": await issueSessionCookie() } });
  }

  return new Response("Not found", { status: 404 });
};

export const config: Config = {
  path: "/api/auth/:action",
};
