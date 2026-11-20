import "server-only";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { getDb } from "@/db";
import { claims, identifiers, products } from "@/db/schema";
import { IDENTIFIER_ERROR_MESSAGES, planSearch, type IdentifierError, type IdentifierType } from "@/lib/identifiers";
import { identifierHmac } from "@/lib/server/crypto";
import { getEnv } from "@/lib/server/env";

export type PublicRecord = {
  category: string;
  brand: string;
  model: string;
  identifierType: IdentifierType;
  lastFour: string;
  incidentType: "THEFT" | "ROBBERY" | "LOST" | null;
  incidentDate: string | null;
  location: string | null;
};

export type SearchResult =
  | { status: "invalid"; error: IdentifierError; message: string }
  | { status: "clear" }
  | { status: "reported" | "disputed"; record: PublicRecord };

/**
 * Exact-match lookup. Only products whose report a reviewer approved
 * (REPORTED) or that are under appeal (DISPUTED) are ever visible; drafts,
 * pending and rejected claims behave exactly like "no record".
 */
export async function searchRegistry(rawQuery: string): Promise<SearchResult> {
  const plan = planSearch(rawQuery);
  if (!plan.ok) return { status: "invalid", error: plan.error, message: IDENTIFIER_ERROR_MESSAGES[plan.error] };

  const secret = getEnv().IDENTIFIER_HMAC_SECRET;
  const db = getDb();

  const [hit] = await db
    .select({
      productId: products.id,
      productStatus: products.status,
      category: products.category,
      brand: products.brand,
      model: products.model,
      identifierType: identifiers.type,
      lastFour: identifiers.lastFour,
    })
    .from(identifiers)
    .innerJoin(products, eq(products.id, identifiers.productId))
    .where(
      and(
        inArray(products.status, ["REPORTED", "DISPUTED"]),
        or(
          ...plan.types.map((type) =>
            and(eq(identifiers.type, type), eq(identifiers.valueHmac, identifierHmac(secret, type, plan.value))),
          ),
        ),
      ),
    )
    .limit(1);

  if (!hit) {
    // Most 15-digit inputs are IMEIs; "no record" for a mistyped one would be falsely reassuring.
    if (plan.warning) return { status: "invalid", error: plan.warning, message: IDENTIFIER_ERROR_MESSAGES[plan.warning] };
    return { status: "clear" };
  }

  const [claim] = await db
    .select({ incidentType: claims.incidentType, incidentAt: claims.incidentAt, location: claims.location })
    .from(claims)
    .where(and(eq(claims.productId, hit.productId), eq(claims.reviewStatus, "APPROVED")))
    .orderBy(desc(claims.incidentAt))
    .limit(1);

  return {
    status: hit.productStatus === "DISPUTED" ? "disputed" : "reported",
    record: {
      category: hit.category,
      brand: hit.brand,
      model: hit.model,
      identifierType: hit.identifierType,
      lastFour: hit.lastFour,
      incidentType: claim?.incidentType ?? null,
      incidentDate: claim ? claim.incidentAt.toISOString().slice(0, 10) : null,
      location: claim?.location ?? null,
    },
  };
}
