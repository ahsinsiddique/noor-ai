/**
 * Request authentication helper.
 *
 * Every /api/* route (except a few that are explicitly public) extracts the
 * Supabase JWT from the `Authorization: Bearer <token>` header, verifies it,
 * and returns the user's identity. Downstream queries use `userClient(token)`
 * so Row Level Security does the actual authorisation — we just confirm the
 * token is valid and pull out the user id for convenience.
 */

import { adminClient, userClient } from "./server";

export interface AuthedRequest {
  token: string;
  userId: string;
  email: string;
}

export async function authFromRequest(
  req: Request,
): Promise<AuthedRequest | { error: string; status: number }> {
  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
    return { error: "Missing Authorization header", status: 401 };
  }

  const token = auth.slice(7).trim();
  if (!token) return { error: "Empty bearer token", status: 401 };

  // Validate with admin client so we don't need a round-trip to the auth API
  // with the user's own client — adminClient.auth.getUser(token) does a
  // stateless JWT verify + user lookup.
  const admin = adminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) {
    return { error: "Invalid or expired token", status: 401 };
  }

  return { token, userId: data.user.id, email: data.user.email ?? "" };
}

/** Helper to short-circuit in a route when auth fails. */
export function authErrorResponse(err: { error: string; status: number }): Response {
  return Response.json({ error: err.error }, { status: err.status });
}

/** Re-export so routes can do `const sb = clientForRequest(authed.token)`. */
export function clientForRequest(token: string) {
  return userClient(token);
}
