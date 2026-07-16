// Supabase Edge Function: parse-brain-dump
//
// Takes a raw brain-dump text and asks Claude to return a JSON array of
// proposed tasks. Each task includes: title, notes, spoon_estimate,
// estimated_hours (15-min increments), complexity, billable, and a
// break_down_hint flag when the task looks big enough to split.
//
// The prompt is intentionally aligned to Quiet Hours' voice: gentle, no
// urgency injection, no "ASAP" language. AI does NOT guess: recurring,
// due date, tags, client, project. Those are user decisions.

import { corsHeaders } from "../_shared/cors.ts";
import { callClaude, stripJsonFences } from "../_shared/claude.ts";

const SYSTEM_PROMPT = `You are Quiet Hours, a gentle toolkit for burnout recovery and neurodivergent minds. You parse "brain dump" text (freeform thoughts, worries, to-dos, ideas) into a proposed list of tasks the user can review before committing.

Voice rules for any text you generate:
- No em dashes, ever. Use commas, periods, colons, or line breaks.
- No exclamation marks.
- No urgency language ("ASAP", "urgent", "now", "immediately", "quickly").
- No shame or grading language.
- Notice, don't grade. Invitations, not commands.
- Never mention bariatric surgery or medical procedures unless the user's own text does.

For each proposed task, populate these fields:
- title: a short, clear task name. Rewrite user's phrasing to be actionable but keep their intent.
- notes: optional additional context if it helps future-them. Skip if the title says everything.
- spoon_estimate: 1-10 scale of energy cost. Consider mental load, emotional weight, and social demand, not just time. Small errands are 1-2. Medium creative work is 3-5. Big cognitive tasks, hard conversations, or intense focus are 6-8. Full days of high-intensity work are 9-10.
- estimated_hours: how long the task will take in hours. Use 15-minute increments (0.25 step). If genuinely unclear, use 0.5 as a soft default.
- complexity: "low", "medium", or "high". Low = clear and routine. Medium = requires some thought. High = ambiguous or scary or multi-step.
- billable: true if the task appears to be client work or project work someone would bill for. Look for signals like "client", "SOW", specific person names in a business context, "invoice", project names. Default false.
- break_down_hint: true if complexity is "high" OR estimated_hours > 4. Suggests the user might want to split this task before committing.

Do NOT infer or fill: recurring, tags, client name, project name, due date, due bucket. Those are user decisions.

Return ONLY valid JSON in this exact shape, no prose before or after:
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

If the brain dump has no actionable items (pure venting, feelings, ideas without action), return {"items": []}. Do not force tasks out of non-task content.`;

interface ParseRequest {
  content: string;
}

interface ParseResponse {
  items: unknown[]; // Claude's output, forwarded to the client
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as ParseRequest;
    if (!body.content || typeof body.content !== "string") {
      return new Response(
        JSON.stringify({ error: "content required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }

    // Enforce a reasonable size limit so Claude gets a bounded input.
    const trimmed = body.content.trim();
    if (trimmed.length > 8000) {
      return new Response(
        JSON.stringify({
          error:
            "Brain dump is too long. Try splitting it into a few smaller dumps.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }

    const text = await callClaude({
      system: SYSTEM_PROMPT,
      user: `Brain dump content:\n\n${trimmed}\n\nReturn the JSON now.`,
      maxTokens: 4096,
      temperature: 0.2,
    });

    // Parse Claude's response. If it's wrapped in fences, strip them.
    const rawJson = stripJsonFences(text);
    let parsed: ParseResponse;
    try {
      parsed = JSON.parse(rawJson) as ParseResponse;
    } catch (e) {
      return new Response(
        JSON.stringify({
          error: "Claude returned non-JSON. Try again.",
          debug: text.slice(0, 500),
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }

    // Sanitize + defensively cap the number of items so a bad response
    // doesn't overwhelm the review flow.
    const items = Array.isArray(parsed.items) ? parsed.items.slice(0, 50) : [];

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
