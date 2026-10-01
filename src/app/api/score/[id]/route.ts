import { NextResponse } from "next/server";
import { scoreCandidate } from "@/lib/pipeline";

// One CV per request keeps each call well inside Vercel's function time limit.
export const maxDuration = 60;

export async function POST(_req: Request, ctx: RouteContext<"/api/score/[id]">) {
  const { id } = await ctx.params;
  try {
    await scoreCandidate(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
