import type { DimensionKey, TrackId } from "./types";

export interface TrackDef {
  id: TrackId;
  name: string;
  blurb: string;
  defaultRole: string;
  examples: string;
  focusOptions: string[];
  // Offline question bank — used when no AI key is configured, and as seeds.
  bank: { c: string; q: string; followups: string[]; hint: string; keywords: string[] }[];
}

export const DIMENSIONS: Record<DimensionKey, { label: string; desc: string }> = {
  structure: {
    label: "Structure",
    desc: "Clear framing — e.g. STAR for behavioural, approach-first for technical.",
  },
  depth: {
    label: "Depth & correctness",
    desc: "Technical/analytical accuracy, trade-offs, edge cases.",
  },
  specificity: {
    label: "Specificity",
    desc: "Concrete examples, numbers, your own contribution.",
  },
  communication: {
    label: "Communication",
    desc: "Concise, easy to follow, answers the actual question.",
  },
  delivery: {
    label: "Delivery",
    desc: "Pace, filler words, confident (not hedging) language.",
  },
};

export const TRACKS: TrackDef[] = [
  {
    id: "general",
    name: "Any role (general)",
    blurb: "Type any role — the interviewer plans questions for it. Works for non-tech roles too.",
    defaultRole: "",
    examples: "Analyst, teacher, designer, marketing, research, MBA/PhD admission",
    focusOptions: [
      "Tell me about yourself",
      "Explaining my experience clearly",
      "Role-specific knowledge",
      "Behavioural (STAR) answers",
      "Sounding confident",
    ],
    bank: [
      {
        c: "Self-introduction",
        q: "To start, tell me about yourself and what brings you to this role.",
        followups: ["Which part of your background is most relevant to this role, and why?"],
        hint: "Present → past → future in about 90 seconds, focused on what matters for this role.",
        keywords: ["currently", "experience", "project", "interested", "role"],
      },
      {
        c: "Role knowledge",
        q: "What do you think are the most important skills for someone to succeed in this role, and how have you built them?",
        followups: ["Give me a concrete example where you used one of those skills."],
        hint: "Name 2–3 skills specific to the role, each backed by a real example.",
        keywords: ["skill", "example", "for instance", "result", "learned"],
      },
      {
        c: "Problem solving",
        q: "Tell me about a difficult problem you solved. How did you approach it?",
        followups: ["What alternatives did you consider, and why did you reject them?", "How did you know your solution worked?"],
        hint: "Situation → your approach → alternatives → result with evidence.",
        keywords: ["approach", "because", "result", "option", "measured"],
      },
      {
        c: "Teamwork & conflict",
        q: "Describe a time you disagreed with someone you worked with. What happened?",
        followups: ["What would you do differently next time?"],
        hint: "Use STAR and focus on how you listened and what you did.",
        keywords: ["listened", "agreed", "result", "situation", "i suggested"],
      },
      {
        c: "Motivation",
        q: "Why this role and this organisation, specifically?",
        followups: ["Where do you see yourself in three to five years?"],
        hint: "Connect a genuine experience to something specific about the organisation.",
        keywords: ["because", "mission", "experience", "growth", "specifically"],
      },
      {
        c: "Learning & growth",
        q: "Tell me about something you taught yourself recently. How did you go about it?",
        followups: ["How did you check that you had actually learned it well?"],
        hint: "Pick something concrete; describe resources, practice, and an outcome.",
        keywords: ["learned", "practice", "built", "course", "result"],
      },
    ],
  },
  {
    id: "swe",
    name: "Software Engineering",
    blurb: "DSA, problem solving, OOP, OS/DBMS/CN fundamentals, projects.",
    defaultRole: "SDE Intern",
    examples: "Google, Microsoft, Amazon, Atlassian, startups",
    focusOptions: [
      "Explaining my approach before coding",
      "Time/space complexity",
      "Edge cases",
      "CS fundamentals (OS/DBMS/CN)",
      "Talking about my projects",
    ],
    bank: [
      {
        c: "Problem solving (hashing)",
        q: "Given an array of integers and a target, return the indices of two numbers that add up to the target. Walk me through your approach before writing any code.",
        followups: [
          "What is the time and space complexity of your approach? Can you do better?",
          "How would your solution change if the array were already sorted?",
          "What edge cases would you test?",
        ],
        hint: "Think about what you need to remember about numbers you've already seen. Is there a data structure with O(1) lookup?",
        keywords: ["hash", "map", "o(n)", "complement", "sorted", "two pointer"],
      },
      {
        c: "OS fundamentals",
        q: "Explain the difference between a process and a thread. When would you prefer one over the other?",
        followups: [
          "What problems can arise when multiple threads share memory, and how do you prevent them?",
          "Can you explain what a deadlock is and the conditions required for it?",
        ],
        hint: "Think about memory isolation, creation cost, and communication between them.",
        keywords: ["memory", "address space", "context switch", "shared", "lock", "mutex"],
      },
      {
        c: "Project ownership",
        q: "Tell me about the most technically challenging project on your resume. What was your specific contribution?",
        followups: [
          "What was the hardest bug you hit in that project and how did you debug it?",
          "If you had to rebuild it today, what would you design differently?",
        ],
        hint: "Pick one project. Explain the problem, your design decision, a trade-off, and a measurable result.",
        keywords: ["i built", "i designed", "trade-off", "result", "users", "latency"],
      },
      {
        c: "Data structures",
        q: "How would you detect a cycle in a linked list? Explain your reasoning.",
        followups: [
          "Can you also find the node where the cycle begins?",
          "Why does the fast/slow pointer approach guarantee they meet?",
        ],
        hint: "What happens if two runners move at different speeds on a circular track?",
        keywords: ["fast", "slow", "pointer", "floyd", "hash set", "o(1)"],
      },
      {
        c: "Networking fundamentals",
        q: "What happens, step by step, when you type a URL into the browser and press Enter?",
        followups: [
          "Where can caching happen in that flow?",
          "How does HTTPS change what happens?",
        ],
        hint: "Go layer by layer: DNS, TCP, TLS, HTTP request, server, response, rendering.",
        keywords: ["dns", "tcp", "tls", "http", "handshake", "render"],
      },
      {
        c: "System design",
        q: "Design a URL shortener like a simple bit.ly. Start with the requirements you would clarify.",
        followups: [
          "How would you generate unique short codes at scale?",
          "How would you handle a link that suddenly gets millions of hits?",
        ],
        hint: "Clarify read/write ratio and scale first, then API, storage, key generation, caching.",
        keywords: ["hash", "base62", "cache", "database", "read heavy", "scale"],
      },
    ],
  },
  {
    id: "ml",
    name: "ML / Data Science",
    blurb: "ML theory, model evaluation, statistics, applied ML projects.",
    defaultRole: "ML / Data Science Intern",
    examples: "Quant/analytics firms, AI startups, research labs",
    focusOptions: [
      "Explaining intuition, not just formulas",
      "Model evaluation & metrics",
      "Statistics & probability",
      "Talking about my ML projects",
    ],
    bank: [
      {
        c: "ML fundamentals",
        q: "Explain the bias–variance trade-off. How have you seen it show up in a model you trained?",
        followups: [
          "Which techniques would you use to reduce variance without increasing bias too much?",
          "How would you detect overfitting in practice?",
        ],
        hint: "Relate model complexity to training vs validation error, then give a concrete example.",
        keywords: ["overfit", "underfit", "regularization", "validation", "complexity"],
      },
      {
        c: "Model evaluation",
        q: "You built a classifier with 98% accuracy for fraud detection. Why might that not be good news?",
        followups: [
          "Which metrics would you report instead, and why?",
          "How would you handle the class imbalance during training?",
        ],
        hint: "Think about how rare fraud is. What does a model that always says 'not fraud' score?",
        keywords: ["imbalance", "precision", "recall", "f1", "auc", "baseline"],
      },
      {
        c: "Applied ML project",
        q: "Walk me through an ML project you did end to end — from data to evaluation.",
        followups: [
          "What was the biggest data quality issue you hit?",
          "How would you deploy and monitor this model in production?",
        ],
        hint: "Problem → data → features → baseline → model → metric → result → what you'd improve.",
        keywords: ["baseline", "feature", "metric", "validation", "result"],
      },
      {
        c: "Optimization",
        q: "How does gradient descent work, and why might it fail to converge?",
        followups: [
          "What do momentum and Adam change compared to plain SGD?",
          "How would you choose a learning rate?",
        ],
        hint: "Describe the update rule, then think about learning rate and the shape of the loss surface.",
        keywords: ["learning rate", "gradient", "local minima", "momentum", "adam"],
      },
      {
        c: "Regularization",
        q: "What is the difference between L1 and L2 regularization?",
        followups: ["Why does L1 tend to produce sparse weights?"],
        hint: "Compare the penalty terms and think about their geometry.",
        keywords: ["sparse", "penalty", "lasso", "ridge", "weights"],
      },
    ],
  },
  {
    id: "core",
    name: "Core Engineering",
    blurb: "Mechanical, Electrical, Chemical, Civil, Materials — fundamentals + projects.",
    defaultRole: "Graduate Engineer Trainee",
    examples: "Tata, L&T, Reliance, Schlumberger, PSUs",
    focusOptions: [
      "Fundamentals of my branch",
      "Linking theory to my projects/internship",
      "Safety & practical constraints",
      "Why core engineering",
    ],
    bank: [
      {
        c: "Engineering project",
        q: "Tell me about your BTP or most relevant engineering project. What problem did it solve?",
        followups: [
          "What assumptions did you make, and how did you validate them?",
          "What would you need to change to take it from lab to industry scale?",
        ],
        hint: "Problem, approach, your role, key result with numbers, limitations.",
        keywords: ["result", "experiment", "simulation", "validated", "efficiency"],
      },
      {
        c: "Core fundamentals",
        q: "Explain a fundamental concept from your branch that you find most interesting, as if to a non-engineer.",
        followups: ["Where is this concept applied in industry today?"],
        hint: "Use an everyday analogy first, then add the technical detail.",
        keywords: ["for example", "like", "because", "application"],
      },
      {
        c: "Problem solving under failure",
        q: "Describe a time an experiment or design didn't work as expected. What did you do?",
        followups: ["What did you change in your process afterwards?"],
        hint: "Use STAR: situation, task, action, result — focus on your debugging logic.",
        keywords: ["root cause", "analysed", "changed", "learned"],
      },
      {
        c: "Motivation",
        q: "Why do you want a core engineering role instead of software or consulting?",
        followups: ["Where do you see yourself in five years in this field?"],
        hint: "Connect a genuine experience to the company's domain. Avoid generic answers.",
        keywords: ["internship", "project", "passion", "impact", "plant"],
      },
    ],
  },
  {
    id: "product",
    name: "Product Management",
    blurb: "Product sense, metrics, prioritisation, estimation.",
    defaultRole: "APM / Product Intern",
    examples: "Flipkart, Swiggy, Zomato, Razorpay, Microsoft",
    focusOptions: [
      "Structuring open-ended answers",
      "Choosing metrics",
      "User empathy",
      "Prioritisation",
    ],
    bank: [
      {
        c: "Product sense",
        q: "How would you improve the IITGN campus mess / food ordering experience with a product?",
        followups: [
          "Which single metric would tell you your product is working?",
          "If you could only build one feature in 4 weeks, which one and why?",
        ],
        hint: "Clarify goal → identify user segments → pain points → solutions → prioritise → metric.",
        keywords: ["users", "pain point", "metric", "prioritise", "segment"],
      },
      {
        c: "Metrics & root cause",
        q: "Daily active users of a food delivery app dropped 15% last week. How would you investigate?",
        followups: ["Suppose it's limited to one city. What next?"],
        hint: "Check data issues first, then internal vs external causes, then segment by platform/region/user.",
        keywords: ["segment", "external", "internal", "data", "hypothesis"],
      },
      {
        c: "Estimation",
        q: "Estimate the number of bicycles on the IIT Gandhinagar campus.",
        followups: ["How would you sanity-check your estimate?"],
        hint: "Break it down by population segments and ownership rate. State assumptions clearly.",
        keywords: ["assume", "students", "faculty", "percentage", "total"],
      },
    ],
  },
  {
    id: "consulting",
    name: "Consulting / Case",
    blurb: "Case interviews, guesstimates, structured problem solving.",
    defaultRole: "Business Analyst",
    examples: "McKinsey, BCG, Bain, Kearney, Accenture Strategy",
    focusOptions: [
      "MECE structuring",
      "Mental math & guesstimates",
      "Synthesising a recommendation",
    ],
    bank: [
      {
        c: "Case structuring",
        q: "Your client is a mid-size Indian cement manufacturer whose profits have fallen 20% in two years. How would you approach this?",
        followups: [
          "Revenue is flat; costs have risen. Where would you look first?",
          "What would your final recommendation to the CEO be?",
        ],
        hint: "Profit = Revenue − Cost. Break each down MECE before diving in.",
        keywords: ["revenue", "cost", "price", "volume", "fixed", "variable"],
      },
      {
        c: "Market sizing",
        q: "Estimate the annual market size of chai sold at roadside stalls in Ahmedabad.",
        followups: ["Which assumption is your estimate most sensitive to?"],
        hint: "Population → chai drinkers → cups/day → share from stalls → price.",
        keywords: ["population", "per day", "price", "assume", "crore"],
      },
    ],
  },
  {
    id: "hr",
    name: "HR / Behavioural",
    blurb: "Tell me about yourself, teamwork, conflict, failure, why us.",
    defaultRole: "Graduate Engineer / Analyst",
    examples: "Every company — usually the final round",
    focusOptions: [
      "Tell me about yourself",
      "STAR structure",
      "Reducing filler words",
      "Sounding confident",
    ],
    bank: [
      {
        c: "Self-introduction",
        q: "Tell me about yourself.",
        followups: ["Why are you interested in this role specifically?"],
        hint: "Present → past → future in ~90 seconds. Pick 2–3 highlights relevant to the role.",
        keywords: ["currently", "iit", "project", "interested", "role"],
      },
      {
        c: "Teamwork & conflict",
        q: "Tell me about a time you had a conflict with a teammate. How did you handle it?",
        followups: [
          "What would you do differently if it happened again?",
          "How did the relationship turn out afterwards?",
        ],
        hint: "STAR: keep situation short; spend most time on your actions and the result.",
        keywords: ["situation", "i spoke", "listened", "result", "agreed"],
      },
      {
        c: "Learning from failure",
        q: "Describe a failure you're proud of learning from.",
        followups: ["How have you applied that lesson since?"],
        hint: "Own the failure honestly, then show concrete change in behaviour.",
        keywords: ["failed", "learned", "since then", "now i"],
      },
      {
        c: "Leadership",
        q: "Tell me about a time you led a team or initiative — a club, fest, or project.",
        followups: ["How did you motivate someone who wasn't contributing?"],
        hint: "Mention team size, goal, what you specifically did, and a measurable outcome.",
        keywords: ["team", "led", "organised", "outcome", "members"],
      },
      {
        c: "Self-pitch",
        q: "Why should we hire you?",
        followups: ["What is one weakness you're actively working on?"],
        hint: "Match 2–3 of your strengths to what the role needs, each with quick evidence.",
        keywords: ["because", "experience", "skills", "evidence"],
      },
    ],
  },
];

export const getTrack = (id: TrackId) => TRACKS.find((t) => t.id === id) ?? TRACKS[0];
