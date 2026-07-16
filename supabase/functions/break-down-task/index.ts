// Supabase Edge Function: break-down-task
//
// Takes a single task (title + optional notes) and asks Claude to suggest
// 3-6 smaller sub-tasks that together accomplish the parent. Each sub-task
// gets the same fields as parse-brain-dump output.

import { corsHeaders } from "../_shared/cors.ts";
import { callClaude, stripJsonFences } from "../_shared/claude.ts";

const SYSTEM_PROMPT = `You are Quiet Hours, a gentle toolkit for burnout recovery. Given one big or scary task, you propose 3 to 6 smaller sub-tasks that together accomplish the parent. Each sub-task is a concrete next action, not a category.

Voice rules:
- No em dashes.
- No exclamation marks.
- No urgency language.
- No shame or grading.
- Notice, don't grade. Invitations, not commands.

For each sub-task, populate: title (short concrete action), notes (optional), spoon_estimate (1-10, energy cost including mental and emotional load), estimated_hours (15-min increments), complexity ("low"/"medium"/"high"), billable (boolean, inherit from parent if a client signal is present), break_down_hint (true only if the sub-task is still large enough to want another split; usually false).

Return ONLY valid JSON:
{
  "items": [
    {
      "title": "string",
      "notes": "string (optional)",
      "spoon_estimate": number,
      "estimated_hours": number,
      "complexity": "low" | "medium" | "high",
      "billable": boolean,
      "break_down_hint": boolean
    }
  ]
}

If the parent task can't be broken down further (already too small, or the request doesn't make sense), return {"items": []}.`;

interface BreakDownRequest {
  title: string;
  notes?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as BreakDownRequest;
    if (!body.title || typeof body.title !== "string") {
      return new Response(
        JSON.stringify({ error: "title required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }

    const userPrompt =
      `Parent task title: ${body.title}\n` +
      (body.notes ? `Parent task notes: ${body.notes}\n` : "") +
      `\nPropose 3 to 6 smaller sub-tasks. Return the JSON now.`;

    const text = await callClaude({
      system: SYSTEM_PROMPT,
      user: userPrompt,
      maxTokens: 2048,
      temperature: 0.2,
    });

    const rawJson = stripJsonFences(text);
    let parsed: { items: unknown[] };
    try {
      parsed = JSON.parse(rawJson);
    } catch (e) {
      return new Response(
        JSON.stringify({
          error: "Claude returned non-JSON.",
          debug: text.slice(0, 500),
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }
    const items = Array.isArray(parsed.items) ? parsed.items.slice(0, 10) : [];

    return new Response(
      JSON.stringify({ items }),
      {
        status: 200,
        headers: { ...corsHeaders, "content-type": "application/json" },
      },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      },
    );
  }
});
