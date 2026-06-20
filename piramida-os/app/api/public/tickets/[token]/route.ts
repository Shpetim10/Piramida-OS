import { getTicketByToken } from "@/lib/services/publications";
import { AuthError } from "@/lib/auth/guards";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  try {
    const ticket = await getTicketByToken(token);
    return Response.json(ticket);
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
