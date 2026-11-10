// Supabase Edge Function: coach ("Talk it through", part 1)
//
// The app sends the whole conversation so far, a short summary of the
// person's day, and their local date. This function:
//   1. checks who's asking (only signed-in people reach it),
//   2. checks the day's allowance (40 a day, see allowance.ts),
//   3. asks the AI for the coach's reply,
//   4. counts the message, only after a reply came back, so a failed reply
//      doesn't use one up.
//
// Nothing anyone says is saved or logged here. The only thing stored is the
// count (coach_usage, migration 019).

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { callClaudeChat } from "../_shared/claude.ts";
import { SUMMARY_HEADING, TALK_IT_THROUGH } from "./prompt.ts";
import { canSend } from "./allowance.ts";
import { isTodaySomewhere, readRequest, recentHistory } from "./request.ts";

// Problems come back as 200 with an error message, the same as the other AI
// functions, so the app can show the real reason instead of "non-2xx".
function reply(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("Authorization") ?? "";

  // Acts as the person: row-level security limits it to their own rows.
  const asPerson = createClient(url, anonKey, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: who } = await asPerson.auth.getUser();
  const userId = who.user?.id;
  if (!userId) return reply({ error: "Please sign in again." });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return reply({ error: "Nothing was sent." });
  }
  const request = readRequest(body);
  if ("problem" in request) return reply({ error: request.problem });
  if (!isTodaySomewhere(request.day, Date.now())) return reply({ error: "The day doesn't match today." });

  const { data: usage, error: usageErr } = await asPerson
    .from("coach_usage")
    .select("messages")
    .eq("day", request.day)
    .maybeSingle();
  if (usageErr) {
    console.error("coach: couldn't read the count", usageErr.code);
    return reply({ error: "The coach couldn't start. Please try again in a moment." });
  }
  const sentToday = Number(usage?.messages ?? 0);
  const continuing = request.messages.length > 1;
  if (!canSend(sentToday, continuing)) return reply({ limit: true, sentToday });

  let text: string;
  try {
    text = await callClaudeChat({
      system: `${TALK_IT_THROUGH}\n\n${SUMMARY_HEADING}\n\n${request.summary}`,
      messages: recentHistory(request.messages),
      maxTokens: 700,
      temperature: 0.5,
    });
  } catch (e) {
    // Only the status is logged (see callClaudeChat), never the conversation.
    console.error("coach: no reply", e instanceof Error ? e.message : "unknown");
    return reply({ error: "The coach couldn't reply just now. Please try again in a moment.", sentToday });
  }

  // Counted with the server's key: the app can't change counts itself.
  const asServer = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: total, error: countErr } = await asServer.rpc("coach_count_message", {
    p_user: userId,
    p_day: request.day,
  });
  if (countErr) {
    // The person still gets their reply. A missed count only means one free
    // message, so it's logged for Caroline to look into rather than shown.
    console.error("coach: couldn't count the message", countErr.code);
  }

  return reply({ reply: text.trim(), sentToday: countErr ? sentToday + 1 : Number(total) });
});
