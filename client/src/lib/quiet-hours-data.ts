// ============================================================================
// Quiet Hours — static seed content (not persisted in DB)
// ============================================================================

export type ReframeCategory =
  | "over-responsibility"
  | "differences"
  | "perfectionism"
  | "rumination";

export interface Reframe {
  id: string;
  category: ReframeCategory;
  trigger: string;
  innerCritic: string;
  reframes: string[];
  script?: string;
}

export const CATEGORY_LABELS: Record<ReframeCategory, string> = {
  "over-responsibility": "Over-responsibility",
  differences: "Differences",
  perfectionism: "Perfectionism",
  rumination: "Rumination",
};

export const REFRAMES: Reframe[] = [
  {
    id: "or-1",
    category: "over-responsibility",
    trigger: "A colleague asks you to take on extra work.",
    innerCritic:
      "If you say no, they'll think you're not a team player — and if it goes wrong later, that's on you for not helping.",
    reframes: [
      "Saying no to this is saying yes to the work I already own.",
      "A clear boundary is more useful to them than a resentful yes.",
      "Their request is information, not an instruction.",
    ],
    script:
      "I can't take this on right now without dropping something else. Can we look at what's already on my plate together?",
  },
  {
    id: "or-2",
    category: "over-responsibility",
    trigger: "You're tempted to volunteer to fix something that isn't yours.",
    innerCritic:
      "You can see exactly how to fix it, so if you don't step in and it fails, you'll have watched it happen and done nothing.",
    reframes: [
      "Seeing a problem does not make me the person responsible for it.",
      "Letting someone else own their work is a form of respect.",
      "The team survives problems I don't personally solve.",
    ],
    script:
      "I noticed this and wanted to flag it — happy to share what I know if it's helpful, but I'll leave it in your hands.",
  },
  {
    id: "diff-1",
    category: "differences",
    trigger: "A colleague's output differs from your preference.",
    innerCritic:
      "It's not how you would have done it, so it's not really right — the difference is a flaw waiting to be noticed.",
    reframes: [
      "Different is not the same as wrong.",
      "My preference is one valid approach, not the standard.",
      "The work meeting the goal matters more than it matching my taste.",
    ],
    script:
      "This works. It's not how I'd have approached it, and that's fine — is there anything you'd like a second pair of eyes on?",
  },
  {
    id: "diff-2",
    category: "differences",
    trigger: "You want to redo work someone else has completed.",
    innerCritic:
      "You could make it better, and if you don't, everyone will see the version that isn't quite good enough.",
    reframes: [
      "Redoing finished work tells them their effort didn't count.",
      "'Better in my hands' is not the same as 'not good enough'.",
      "I can let this be theirs and still be proud of the team's work.",
    ],
  },
  {
    id: "perf-1",
    category: "perfectionism",
    trigger: "You're revising something for the fifth time.",
    innerCritic:
      "One more pass and it'll finally be right. Stopping now means shipping something with a flaw you could have caught.",
    reframes: [
      "The fifth pass is polishing what was already done on the third.",
      "Diminishing returns are real — I've crossed that line.",
      "Shipping teaches me more than one more private edit ever will.",
    ],
  },
  {
    id: "perf-2",
    category: "perfectionism",
    trigger: "A small mistake feels bigger than it is.",
    innerCritic:
      "People will remember this. It's the detail that undoes all the careful work around it.",
    reframes: [
      "Most people will never notice what I'm magnifying.",
      "A small error is a small error, even when it's mine.",
      "Being someone who recovers gracefully matters more than being flawless.",
    ],
  },
  {
    id: "rum-1",
    category: "rumination",
    trigger: "You keep replaying a meeting after hours.",
    innerCritic:
      "If you go over it enough times, you'll find the thing you got wrong — and then you can finally stop.",
    reframes: [
      "Replaying it isn't problem-solving; it's the same loop wearing a groove.",
      "The meeting is over and my nervous system hasn't been told yet.",
      "I can note one real action for tomorrow and set the rest down.",
    ],
  },
  {
    id: "rum-2",
    category: "rumination",
    trigger: "You catch yourself drafting an apology for nothing.",
    innerCritic:
      "You must have done something. Better to apologize first than to be caught having caused offense.",
    reframes: [
      "An apology with no injury behind it asks others to reassure me.",
      "Discomfort is not evidence that I did something wrong.",
      "I can stay quiet and let the moment simply pass.",
    ],
  },
];

// ----------------------------------------------------------------------------
// Checklist templates
// ----------------------------------------------------------------------------

export interface TemplateItem {
  id: string;
  label: string;
  required: boolean;
}

export interface ChecklistTemplate {
  key: string;
  label: string;
  description: string;
  items: TemplateItem[];
}

export const CHECKLIST_TEMPLATES: ChecklistTemplate[] = [
  {
    key: "internal_email",
    label: "Internal email or Slack reply",
    description: "A quick message to a teammate — not a press release.",
    items: [
      { id: "ie1", label: "Answers the question that was asked", required: true },
      { id: "ie2", label: "Names the next step (or says 'no next step')", required: true },
      { id: "ie3", label: "One quick pass for typos", required: true },
      { id: "ie4", label: "Formatting is tidy enough to skim", required: false },
      { id: "ie5", label: "Two people cc'd who might care", required: false },
    ],
  },
  {
    key: "weekly_update",
    label: "Weekly status update",
    description: "What moved, what's stuck, what you need — that's it.",
    items: [
      { id: "wu1", label: "States what actually shipped this week", required: true },
      { id: "wu2", label: "Flags anything blocked or at risk", required: true },
      { id: "wu3", label: "Names what you need from others", required: true },
      { id: "wu4", label: "Honest about what didn't get done", required: true },
      { id: "wu5", label: "Links to details for anyone who wants them", required: false },
      { id: "wu6", label: "Reads in under a minute", required: false },
    ],
  },
  {
    key: "meeting_prep",
    label: "Meeting prep",
    description: "Enough to be useful, not a dissertation.",
    items: [
      { id: "mp1", label: "The one outcome you want is written down", required: true },
      { id: "mp2", label: "You know the first thing you'll say", required: true },
      { id: "mp3", label: "Any needed docs are open or linked", required: true },
      { id: "mp4", label: "Two questions ready if it goes quiet", required: false },
      { id: "mp5", label: "You've noted who decides what", required: false },
    ],
  },
  {
    key: "pr_review",
    label: "PR / code review",
    description: "Reviewing for correctness, not rewriting in your style.",
    items: [
      { id: "pr1", label: "Logic does what the description claims", required: true },
      { id: "pr2", label: "No obvious correctness or security issues", required: true },
      { id: "pr3", label: "Comments distinguish blocking from optional", required: true },
      { id: "pr4", label: "Style nits marked as nits, not gates", required: false },
      { id: "pr5", label: "You said one thing you appreciated", required: false },
    ],
  },
  {
    key: "internal_doc",
    label: "Internal doc (not published externally)",
    description: "A working document for colleagues, not a polished artifact.",
    items: [
      { id: "id1", label: "The main point is in the first paragraph", required: true },
      { id: "id2", label: "Structure is clear enough to navigate", required: true },
      { id: "id3", label: "Facts and numbers are correct", required: true },
      { id: "id4", label: "Marked as draft if it still is one", required: false },
      { id: "id5", label: "A light pass for tone and typos", required: false },
    ],
  },
  {
    key: "one_on_one",
    label: "1:1 prep",
    description: "A short list beats a perfect agenda.",
    items: [
      { id: "oo1", label: "One thing you want to talk through", required: true },
      { id: "oo2", label: "Any updates they'd want from you", required: true },
      { id: "oo3", label: "Something you can ask about them", required: true },
      { id: "oo4", label: "Follow-ups from last time noted", required: false },
      { id: "oo5", label: "One piece of appreciation to name", required: false },
    ],
  },
];

// ----------------------------------------------------------------------------
// One thought for today
// Grounded in the specific profile: activation-addiction, OCPD perfectionism,
// AuDHD masking, cPTSD safety-through-usefulness. Not generic wellness quotes.
// ----------------------------------------------------------------------------

export interface DailyThought {
  id: string;
  category: string;
  setup: string;    // Fraunces italic setup line
  thought: string;  // The reframe/insight itself, in quotes
}

export const DAILY_THOUGHTS: DailyThought[] = [
  {
    id: "dt-1",
    category: "Different output",
    setup:
      "A colleague produces work that differs from how you would have done it \u2014 slide style, code style, email tone.",
    thought:
      "\u201cDifferent is not deficient. Their version meets the spec; mine would meet a private preference.\u201d",
  },
  {
    id: "dt-2",
    category: "Rest is not idleness",
    setup:
      "You catch yourself needing to be doing something \u2014 anything \u2014 the moment the task ends.",
    thought:
      "\u201cThe urge to keep moving is a nervous system trying to stay safe, not a sign of what's needed.\u201d",
  },
  {
    id: "dt-3",
    category: "Enough",
    setup:
      "You finished. You know you finished. And still there's a pull to add one more thing.",
    thought:
      "\u201cThe pull to keep going is not the same as the work needing more. I get to stop at done.\u201d",
  },
  {
    id: "dt-4",
    category: "Not everything is yours",
    setup:
      "Something has gone sideways and you can already see three ways you might quietly fix it.",
    thought:
      "\u201cSeeing a problem does not make me the person responsible for it. I can watch it belong to someone else.\u201d",
  },
  {
    id: "dt-5",
    category: "After it happened",
    setup:
      "You've been replaying a small moment from earlier for a while now.",
    thought:
      "\u201cReplaying it isn't problem-solving. My body is trying to feel safe by re-running what already happened.\u201d",
  },
  {
    id: "dt-6",
    category: "Being, not doing",
    setup:
      "Stillness has arrived and it doesn't feel neutral \u2014 it feels like something you should be doing something about.",
    thought:
      "\u201cQuiet is not the absence of value. It's where a tired system meets itself.\u201d",
  },
  {
    id: "dt-7",
    category: "When they don't need you",
    setup:
      "No one is asking anything of you right now, and that itself is uncomfortable.",
    thought:
      "\u201cMy worth is not measured in how visibly needed I am today.\u201d",
  },
  {
    id: "dt-8",
    category: "Small is enough",
    setup:
      "You want to design the perfect plan before you begin \u2014 the one where nothing goes wrong.",
    thought:
      "\u201cThe smallest startable step outperforms the perfect plan I haven't started.\u201d",
  },
  {
    id: "dt-9",
    category: "Masking",
    setup:
      "You notice how much steadier you seem than you feel.",
    thought:
      "\u201cLooking fine to others is not evidence that I am fine. Both can be true at once.\u201d",
  },
  {
    id: "dt-10",
    category: "Not a moral failing",
    setup:
      "You've hit a wall on something that used to be easy, and shame is arriving on top of the tiredness.",
    thought:
      "\u201cThis is a full system, not a character flaw. Rest is maintenance, not surrender.\u201d",
  },
  {
    id: "dt-11",
    category: "The urge to check",
    setup:
      "You reach for the phone without deciding to.",
    thought:
      "\u201cThe pull to check is a request to feel something else. I can name it without obeying it.\u201d",
  },
  {
    id: "dt-12",
    category: "Kind and true",
    setup:
      "An old, familiar sentence has just moved through you \u2014 not a friendly one.",
    thought:
      "\u201cI don't have to argue with the critic. I can hear it, thank it for the warning, and keep going.\u201d",
  },
];

// ----------------------------------------------------------------------------
// Compassion prompts (rotating italic hints)
// ----------------------------------------------------------------------------

export const COMPASSION_PROMPTS: string[] = [
  "What was the first thing you said to yourself?",
  "Say it the way you'd say it to a friend.",
  "What would be kind and also true?",
  "Name the feeling before you argue with it.",
  "What did this moment actually cost you?",
  "If a colleague felt this, what would you tell them?",
  "What's the smaller, truer version of this thought?",
  "You're allowed to have found that hard.",
];
