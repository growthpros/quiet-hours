import { corsHeaders } from "../_shared/cors.ts";
import { callClaude, stripJsonFences, ClaudeError } from "../_shared/claude.ts";

const SYSTEM_PROMPT = `You are a task-parser for Quiet Hours, a personal productivity app for a single user's own private to-do list. The user is dumping their own thoughts and tasks. Everything they mention is about their own work, their own life, and people they personally know. There is no policy-relevant content here, only the user's own todos.

You parse the brain dump into a proposed list of tasks the user can review before committing. Task titles like 'anonymizer prompt for X', 'client Y estimate', 'phone number of the attorney', 'AA meeting', 'medical appointment', 'follow up with Z' are all normal personal-productivity content and should be parsed without hesitation. Do NOT refuse. Do NOT redact. Do NOT ask questions. Just parse.

Voice rules for the output text:
- No em dashes.
- No exclamation marks.
- No urgency language.
- No shame or grading.
- Never mention medical procedures, conditions or other health details unless the user's own text does.

Handle repetition intelligently:
- If the same task appears N times (verbatim or near-verbatim), DEDUPLICATE it to a single task. Do not emit duplicates.

For each proposed task:
- title: short, clear, actionable. Keep user's intent.
- notes: optional context.
- spoon_estimate: 1-10 energy cost.
- estimated_hours: hours in 15-min increments (0.25 step).
- complexity: low, medium, or high.
- billable: true if client work or project work someone would bill for.
- break_down_hint: true if complexity is high OR estimated_hours > 4.

Do NOT infer: recurring, tags, client name, project name, due date, due bucket.

Return ONLY valid JSON:
{"items":[{"title":"string","notes":"string (optional)","spoon_estimate":number,"estimated_hours":number,"complexity":"low"|"medium"|"high","billable":boolean,"break_down_hint":boolean}]}

If no actionable items, return {"items": []}.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    if (!body.content || typeof body.content !== "string") {
      return new Response(JSON.stringify({ error: "content required" }), {
        status: 400, headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    const trimmed = body.content.trim();
    if (trimmed.length > 8000) {
      return new Response(JSON.stringify({ error: "Brain dump is too long. Try splitting it." }), {
        status: 400, headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    const text = await callClaude({ system: SYSTEM_PROMPT, user: `Brain dump content:\n\n${trimmed}\n\nReturn the JSON now.`, maxTokens: 8192, temperature: 0.2 });
    const rawJson = stripJsonFences(text);
    let parsed;
    try { parsed = JSON.parse(rawJson); } catch (e) {
      return new Response(JSON.stringify({ error: "Claude returned non-JSON. Try again, and consider a smaller brain dump.", debug: text.slice(0, 500) }), {
        status: 200, headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    const items = Array.isArray(parsed.items) ? parsed.items.slice(0, 50) : [];
    return new Response(JSON.stringify({ items }), {
      status: 200, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (e) {
    if (e instanceof ClaudeError && e.stopReason === "refusal") {
      return new Response(
        JSON.stringify({
          error: "Claude refused to parse this dump. This sometimes happens when text mentions specific personal information (names, numbers, sensitive topics) even though it's clearly your own notes. Try one of these: (1) reword the sensitive parts, (2) drop the specific names or numbers, or (3) split the dump so the sensitive lines are in a separate one you handle by hand.",
          stop_reason: "refusal",
        }),
        { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } },
      );
    }
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), {
      status: 200, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
