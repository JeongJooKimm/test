import { listUtmVisits, recordUtmVisit } from "@/app/lib/utm-store";

type UtmPayload = {
  campaign?: unknown;
  medium?: unknown;
  source?: unknown;
};

export const dynamic = "force-dynamic";

function normalizeValue(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, 120);
}

export async function GET() {
  try {
    const visits = await listUtmVisits();

    return Response.json({
      persistent: true,
      visits,
    });
  } catch {
    return Response.json(
      { message: "Failed to load UTM visits." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let payload: UtmPayload;

  try {
    payload = (await request.json()) as UtmPayload;
  } catch {
    return Response.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const source = normalizeValue(payload.source);
  const medium = normalizeValue(payload.medium);
  const campaign = normalizeValue(payload.campaign);

  if (!source || !medium || !campaign) {
    return Response.json(
      { message: "source, medium, and campaign are required." },
      { status: 400 },
    );
  }

  try {
    const count = await recordUtmVisit(source, medium, campaign);
    const visits = await listUtmVisits();

    return Response.json({
      count,
      persistent: true,
      visits,
    });
  } catch {
    return Response.json(
      { message: "Failed to record UTM visit." },
      { status: 500 },
    );
  }
}
