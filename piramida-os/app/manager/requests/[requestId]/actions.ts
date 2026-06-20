"use server";

import { revalidatePath } from "next/cache";
import { createEventFromRequest } from "@/lib/services/event-requests";

export async function createDraftEventFromReviewedRequest(requestId: string, reviewedFields: unknown) {
  const event = await createEventFromRequest(requestId, reviewedFields);
  revalidatePath(`/manager/requests/${requestId}`);
  revalidatePath(`/manager/events/${event.id}/understand`);
  return { eventId: event.id };
}
