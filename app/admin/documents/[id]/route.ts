import { getSession, isStaff } from "@/lib/server/auth";
import { documentForStaff, logStaffAccess } from "@/lib/server/claims";
import { getEvidence } from "@/lib/server/storage";

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

/** Decrypts and streams one evidence file to an MFA-verified reviewer. Every view is audited. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return notFound();
  const session = await getSession();
  if (!session || !isStaff(session.user.role) || !session.user.mfaEnabled || !session.mfaVerified) return notFound();

  const doc = await documentForStaff(id);
  if (!doc) return notFound();
  const body = await getEvidence(doc.storageKey);
  await logStaffAccess(session.user.id, "DOCUMENT_VIEWED", "claim", doc.claimId, { documentId: doc.id });

  const isImage = doc.mimeType.startsWith("image/");
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `${isImage ? "inline" : "attachment"}; filename="evidence-${doc.id.slice(0, 8)}.${doc.mimeType.split("/")[1]}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self'",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
