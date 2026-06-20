import { NextRequest } from "next/server";
import { getTicketByToken } from "@/lib/services/publications";
import { ok, handleApiError } from "@/lib/api/respond";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const ticket = await getTicketByToken(token);
    return ok(ticket);
  } catch (err) {
    return handleApiError(err);
  }
}
