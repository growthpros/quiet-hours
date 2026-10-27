// The words behind each ⓘ, in one place so they're easy to review and keep
// in the app's voice. Plain language, no em dashes, no exclamation marks.

export const EXPLAIN = {
  ordinaryDay:
    "An ordinary okay day is a normal day when nothing is especially hard or especially easy. Each day's spoons start from it, then adjust for how you are when you check in. One spoon is about 30 minutes of ordinary, medium-effort activity, so 12 spoons is about 6 hours.",
  estimateNote: "Spoons are an estimate to help you plan, not a measure of your body.",

  // Spoon meter
  total: "Today's spoons: the number from your check-in, plus anything you've earned back.",
  spent: "Spoons from tasks you've finished today.",
  committed: "Spoons for the tasks still planned for today.",
  earnedBack: "Spoons added back by things on your earn-back list, like a nap or time outside.",
  free: "What's left: total, minus spent and committed.",
  budgetMath:
    "Your ordinary okay day, scaled by your energy at check-in, minus other load: sensory input, your state, body signals, and whether yesterday was a big day. Other load never takes off more than 30%. A later check-in can lower today, never raise it.",
  beforeCheckin:
    "Until you check in, the app plans with your ordinary okay day. Checking in sets today's real number from how you are right now.",

  // Check-in
  energy:
    "Your energy sets most of today's spoons. Depleted is 60% of your ordinary okay day, Low 80%, Steady 100%, Present 105% and Bright 110%. Bright only adds a little, because good days are when it's easiest to overdo it.",
  sensory:
    "How much noise, light, crowds and other input you're taking in. Noticeable takes 5% off today's spoons, A lot 10% and Overloaded 20%.",
  state:
    "Where your attention is right now. Drifting and Chasing take 5% off today's spoons, Numbing 10% and Frozen 15%. Grounded takes nothing off.",
  bodySignals: "Each body signal you notice takes 5% off today's spoons, up to 15%.",
  bigDay:
    "A big day is one that went past 110% of its spoons. Overdoing it often shows up a day or two later, so the next day starts 10% lighter.",

  // Task form
  effort:
    "How hard the task is on your mind and body. Low is 1 spoon an hour, Medium 2 and High 3. Something new or unfamiliar usually goes up a level.",
  withPeople:
    "Being with people, on camera, masking, or somewhere noisy or busy takes more out of you. It counts 1.5 times.",
  dread: "Dreading something costs energy before you start. It adds 1 spoon, however long the task is.",
  taskSpoons:
    "Worked out from time and effort, and your own number always wins. Hours past 2 in one go count 1.25 times, because tiredness builds over long stretches.",
} as const;
