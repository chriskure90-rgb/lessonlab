import { Fragment, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import './App.css'

type PageId =
  | 'lesson-generator'
  | 'lesson-workspace'
  | 'class-feedback-dashboard'

const PAGE_CONFIG = [
  { id: 'lesson-generator', label: 'Lesson Planning' },
  { id: 'lesson-workspace', label: 'Lesson Workspace' },
  { id: 'class-feedback-dashboard', label: 'Class Feedback' },
] as const

type PlanningTab = 'form' | 'ai-chat'

// Teacher-facing practice options for the planning Form. Labels and
// descriptions are deliberately plain-language ("Do not require teachers to
// understand the term 'epistemic practice'") — the id is how the prototype
// still represents each one conceptually as an epistemic practice elsewhere
// (e.g. lessonPractices, the bold terms inside the generated lesson).
type PracticeOption = { id: string; label: string; description: string }

const practiceOptions: PracticeOption[] = [
  {
    id: 'modeling',
    label: 'Develop & Use Models',
    description: 'Students build a model to represent their current thinking, then test and revise it as they learn more.',
  },
  {
    id: 'evidence',
    label: 'Use Evidence',
    description: 'Students support their ideas with specific data or observations, not just opinions.',
  },
  {
    id: 'explanation',
    label: 'Construct Explanations',
    description: 'Students connect a claim to evidence with clear reasoning about why it’s true.',
  },
  {
    id: 'argumentation',
    label: 'Engage in Argumentation',
    description: 'Students defend their thinking and weigh alternative ideas using evidence.',
  },
  {
    id: 'revision',
    label: 'Revise Thinking',
    description: 'Students update their models or explanations when new evidence challenges their first ideas.',
  },
]

const lessonContextTags = ['Grade 9', 'Ecosystems', 'Energy Flow', 'Initial Modeling', 'Model Revision']

const planningConversation = [
  {
    role: 'ai',
    text: 'What activity do you want to plan today, and what science practices are we focusing on?',
  },
  {
    role: 'teacher',
    text: 'I want my high school biology students to model how energy flows through an ecosystem — from the sun through producers, consumers, and decomposers.',
  },
  {
    role: 'ai',
    text: 'That’s a strong fit for Initial Modeling. Would you like students to build an initial model first, then revise it after examining new evidence — and explain how their model shows that energy is conserved but not recycled?',
  },
  {
    role: 'teacher',
    text: 'Yes. I also want them to argue for their modeling choices using evidence, not just describe the diagram.',
  },
] as const

const metricCards = [
  { label: 'Submissions', value: '128', trend: '+14%' },
  { label: 'Average Time on Task', value: '27 min', trend: '+5 min' },
  { label: 'Average Word Count', value: '1,420', trend: '+18%' },
  { label: 'Resubmissions', value: '24', trend: '+7' },
  { label: 'AI Feedback Requests', value: '41', trend: '+9' },
]

const dashboardTask = {
  topic: 'Modeling Energy Flow in Ecosystems',
  question:
    'Prompt: Build a model showing how energy flows from the sun through producers, consumers, and decomposers. Then explain how your model shows that energy is conserved but not recycled.',
}

type ClassTrend = {
  id: string
  label: string
  percent: number
  count: number
  total: number
}

const classTrends: ClassTrend[] = [
  { id: 'argumentation', label: 'Argumentation', percent: 78, count: 22, total: 28 },
  { id: 'model-revision', label: 'Substantive model revision', percent: 43, count: 12, total: 28 },
  { id: 'scientific-explanation', label: 'Scientific explanation', percent: 61, count: 17, total: 28 },
  { id: 'use-of-evidence', label: 'Use of evidence', percent: 71, count: 20, total: 28 },
]

type StudentExample = {
  name: string
  level: string
  quote: string
  note: string
}

const studentExamplesByTrend: Record<string, StudentExample[]> = {
  argumentation: [
    {
      name: 'Maya T.',
      level: 'Strong',
      quote:
        'I told my partner our model was more accurate because we showed energy leaving as heat at every arrow, and the data table backs that up.',
      note: 'Defends a modeling choice using the class data table, not just opinion.',
    },
    {
      name: 'Ethan R.',
      level: 'Strong',
      quote:
        'My group argued that decomposers had to be included, because otherwise the matter in dead organisms would just vanish from the model — and that’s not what the reading said.',
      note: 'Uses a counterexample from the reading to justify a modeling decision.',
    },
    {
      name: 'Grace L.',
      level: 'Developing',
      quote: 'I think our model is right because it looks like the one in the textbook.',
      note: 'Appeals to a familiar diagram rather than evidence or reasoning.',
    },
  ],
  'model-revision': [
    {
      name: 'Jordan P.',
      level: 'Strong',
      quote:
        'I added an arrow showing decomposers releasing energy as heat, because my first model made it look like decomposers stored all the leftover energy forever.',
      note: 'Revised the model to fix a conservation-of-energy error, not just relabel it.',
    },
    {
      name: 'Lena M.',
      level: 'Strong',
      quote:
        'My first model stopped at the consumers, but after we read about decomposers I added them and an arrow showing energy still being lost as heat.',
      note: 'Used new evidence to add a missing step in the energy pathway.',
    },
    {
      name: 'Noah T.',
      level: 'Developing',
      quote: 'I just made my energy arrows thicker at the bottom of the model instead of changing what the model actually shows.',
      note: 'Adjusted the model’s appearance without changing its structure or reasoning.',
    },
  ],
  'scientific-explanation': [
    {
      name: 'Sofia R.',
      level: 'Strong',
      quote:
        'Claim: energy is conserved but not recycled in our ecosystem. Evidence: our model shows energy leaving as heat at every arrow, and none of it flows back to the sun. Reasoning: once energy is used or lost as heat, it can’t be reused by the ecosystem the way matter can.',
      note: 'Complete claim-evidence-reasoning structure distinguishing energy flow from matter cycling.',
    },
    {
      name: 'Diego H.',
      level: 'Strong',
      quote:
        'Energy keeps decreasing at each trophic level because organisms use most of the energy they get just to survive, so only a little is left for the next level to eat.',
      note: 'Links the 10% rule to a causal mechanism, not just a pattern.',
    },
    {
      name: 'Emma K.',
      level: 'Developing',
      quote: 'Energy is conserved because it just keeps going around the ecosystem forever.',
      note: 'States a conclusion that confuses energy flow with matter cycling — a key misconception.',
    },
  ],
  'use-of-evidence': [
    {
      name: 'Diego H.',
      level: 'Strong',
      quote:
        'The class data table shows only about 10% of energy moves from producers to consumers, so that’s why our model has smaller arrows higher up.',
      note: 'Cites the specific 10% figure from the data table to justify the model.',
    },
    {
      name: 'Maya T.',
      level: 'Strong',
      quote:
        'I used both the reading and the class data to show that decomposers release energy as heat, not back into the food chain.',
      note: 'Synthesizes evidence across two different sources.',
    },
    {
      name: 'Grace L.',
      level: 'Developing',
      quote: 'The data kind of shows that energy goes down the further you go in the food chain.',
      note: 'References the data only in general terms, without a specific figure.',
    },
  ],
}

const suggestedQuestions = [
  'What evidence in your model best supports the claim that energy is conserved but not recycled?',
  'How does your model compare to the one we examined in the reading?',
  'Which part of your model could be tested or revised with more data?',
  'How could you explain your model to a classmate who thinks energy just disappears?',
]

type QuickPrompt = { question: string; answer: string }

const trendMisconceptions: Record<string, string> = {
  argumentation:
    'Several students defend a modeling choice by pointing to how familiar or "textbook" it looks, rather than to evidence or a mechanism. A few treat a partner’s agreement as proof, without checking whether the underlying reasoning holds up.',
  'model-revision':
    'A common misconception is that energy or matter can simply disappear from a system, so models often stop at consumers without decomposers or without any arrow showing energy leaving as heat.',
  'scientific-explanation':
    'A few responses treat energy as something that cycles back through the ecosystem the way matter does, rather than something that is ultimately lost as heat at each transfer.',
  'use-of-evidence':
    'Some students treat a general downward trend across trophic levels as evidence enough, without citing the specific percentage of energy transferred at each step.',
}

type TrendQuickPromptContent = {
  patterns: string
  whyNotMoreQuestion: string
  whyNotMoreAnswer: string
  strongVsDeveloping: string
  evidenceUse: string
}

const trendQuickPromptContent: Record<string, TrendQuickPromptContent> = {
  argumentation: {
    patterns:
      'Stronger responses defend a modeling choice by pointing to a specific data point or a counterexample from the reading. Weaker responses appeal to how familiar a model looks, or to a partner agreeing, rather than to evidence.',
    whyNotMoreQuestion: 'Why might some students still be defending their models without evidence?',
    whyNotMoreAnswer:
      'Many students are used to describing what a model shows rather than arguing for it — pointing to evidence and weighing a counter-argument is a less familiar move than just explaining the diagram.',
    strongVsDeveloping:
      'Stronger responses name a specific data point or counterexample and address a rival explanation. Developing responses restate their claim more confidently without adding new evidence.',
    evidenceUse:
      'Most students who argue well cite the class data table directly. A few still treat a partner agreeing with them as if it were evidence.',
  },
  'model-revision': {
    patterns:
      'Students who substantively revise usually point to a specific new piece of evidence that changed their thinking. Students who don’t tend to make only cosmetic changes — different colors or thicker arrows — without changing what the model represents.',
    whyNotMoreQuestion: 'Why might only 43% of students be substantively revising their models?',
    whyNotMoreAnswer:
      'Many students treat their first model as "done" once it looks complete, so revision reads as correcting a mistake rather than as a normal part of building a stronger explanation.',
    strongVsDeveloping:
      'Stronger responses name the exact piece of evidence that changed their model and explain what it fixed. Developing responses describe a visual change without connecting it to new evidence or reasoning.',
    evidenceUse:
      'Students revising substantively cite specific new data — like energy-loss figures — and tie it to a concrete change. Others revise without referencing any new evidence at all.',
  },
  'scientific-explanation': {
    patterns:
      'Strong explanations follow claim, evidence, and reasoning explicitly. Weaker ones state a claim and skip straight to a conclusion without explaining the mechanism in between.',
    whyNotMoreQuestion: 'Why might only 61% of students be writing complete scientific explanations?',
    whyNotMoreAnswer:
      'Students often know the right claim but haven’t practiced spelling out the reasoning that connects evidence to that claim — that middle step is usually the one that gets skipped under time pressure.',
    strongVsDeveloping:
      'Stronger responses explicitly separate claim, evidence, and reasoning. Developing responses blend them into a single sentence or leave the reasoning step out entirely.',
    evidenceUse:
      'Strong explanations tie a specific piece of evidence to the reasoning step. Weaker ones mention evidence in passing without using it to justify the claim.',
  },
  'use-of-evidence': {
    patterns:
      'Students with strong evidence use cite specific numbers or ranges and often combine more than one source. Weaker responses gesture at "the data" as a whole without naming a figure.',
    whyNotMoreQuestion: 'Why might only 71% of students be using evidence effectively?',
    whyNotMoreAnswer:
      'Some students can identify a general trend in the data but haven’t yet practiced pulling out the one specific number or data point that best supports their claim.',
    strongVsDeveloping:
      'Stronger responses cite an exact figure or range from the data. Developing responses describe the data only in general terms, like "it kind of goes down."',
    evidenceUse:
      'Students with strong evidence use synthesize more than one source — for example, the reading and the class data table together. Others rely on only one, described in general terms.',
  },
}

function trendOpeningMessage(trend: ClassTrend): string {
  const patternClauses: Record<string, string> = {
    argumentation:
      'students who back up their claims with evidence from those who rely on how familiar or convincing a model looks',
    'model-revision':
      'students who meaningfully revised their models from those who made only surface-level changes',
    'scientific-explanation':
      'students who connect claim, evidence, and reasoning from those who state a claim without explaining the mechanism',
    'use-of-evidence':
      'students who cite specific data from those who describe the data only in general terms',
  }
  const clause = patternClauses[trend.id] ?? `stronger and developing responses for ${trend.label.toLowerCase()}`
  return `${trend.count} of ${trend.total} students demonstrated ${trend.label.toLowerCase()}. Looking across the student responses, several patterns distinguish ${clause}. What would you like to investigate?`
}

function trendQuickPrompts(trend: ClassTrend): QuickPrompt[] {
  const content = trendQuickPromptContent[trend.id]
  return [
    { question: 'What patterns do you see across the class?', answer: content.patterns },
    { question: content.whyNotMoreQuestion, answer: content.whyNotMoreAnswer },
    { question: 'What distinguishes stronger and developing responses?', answer: content.strongVsDeveloping },
    {
      question: 'What common misconceptions appear?',
      answer: trendMisconceptions[trend.id] ?? 'No specific misconception stands out across these responses.',
    },
    { question: 'How are students using evidence when revising their models?', answer: content.evidenceUse },
  ]
}

// A fully scripted example teacher<->AI conversation for a trend, shown as
// the starting point when a teacher opens "Analyze with AI" for that trend
// instead of a single generic opener — it demonstrates class analytics ->
// representative student evidence -> interpretation -> instructional
// action, ending each AI turn with a reflective question rather than a
// directive, so the teacher stays the one deciding what to do next. Kept
// deliberately short (2-4 sentences per AI turn, one student example, one
// short "Pattern:" line) so the full exchange fits without much scrolling.
const trendExampleConversations: Partial<Record<string, ChatMessage[]>> = {
  argumentation: [
    { role: 'teacher', text: 'Show me a typical response and where students are struggling.' },
    {
      role: 'ai',
      text: 'Typical response — Maya T.\n“I think our model is correct because the data table shows that less energy reaches each higher trophic level.”\n\nPattern: Students cite evidence but often don’t explain why it supports their claim.\n\nWhat do you think is causing this?',
    },
    {
      role: 'teacher',
      text: 'They understood the model but couldn’t explain how their evidence backed it up.',
    },
    {
      role: 'ai',
      text: 'Try reframing “How do you know?” as “What evidence convinced you, and why does it support your claim?”\n\nThis pushes students to explain the evidence-claim connection instead of only naming it. Would this fit how you facilitate discussion?',
    },
  ],
  'scientific-explanation': [
    { role: 'teacher', text: 'Show me a typical response and where students are struggling.' },
    {
      role: 'ai',
      text: 'Typical response — Diego H.\n“Energy keeps moving through the ecosystem because organisms use it and pass it on.”\n\nPattern: Students understand energy flow, but many cite ideas without explaining how their evidence supports their reasoning.\n\nWhat do you think is causing this difficulty?',
    },
    {
      role: 'teacher',
      text: 'They had trouble explaining why their evidence supported their models.',
    },
    {
      role: 'ai',
      text: 'Try reframing “How do you know?” as “What evidence helped you decide, and why?”\n\nThis encourages students to connect evidence to reasoning. Would this fit how you facilitate discussion?',
    },
  ],
}

type FacilitationFocus = 'model-revision' | 'use-of-evidence' | 'misconceptions' | 'argumentation'

const facilitationFocusOptions: { id: FacilitationFocus; label: string }[] = [
  { id: 'model-revision', label: 'Focus on model revision' },
  { id: 'use-of-evidence', label: 'Focus on use of evidence' },
  { id: 'misconceptions', label: 'Address misconceptions' },
  { id: 'argumentation', label: 'Encourage scientific argumentation' },
]

const facilitationFocusQuestionSets: Record<FacilitationFocus, string[]> = {
  'model-revision': [
    'What specific piece of evidence made you add or change a step in your energy-flow model?',
    'What part of your original model do you think was already correct?',
    'If you got one more data point about energy loss, what would you check next?',
  ],
  'use-of-evidence': [
    'Which piece of evidence about energy transfer was hardest to interpret?',
    'How do the reading and the class data agree or disagree about how much energy reaches each trophic level?',
    'What additional data would make your evidence for energy loss more convincing?',
  ],
  misconceptions: [
    'Where might energy seem to "disappear" or get "recycled" in your model, and how would you fix that?',
    'What would you say to a classmate who thinks energy cycles back through the ecosystem the way matter does?',
    'What data would prove or disprove that idea?',
  ],
  argumentation: [
    'What evidence would someone who disagrees with your model point to?',
    'How would you defend your model if a classmate challenged where you placed the decomposers?',
    'What is the strongest counter-argument to your claim about energy loss, and how would you respond?',
  ],
}

function customFacilitationQuestions(requestText: string): string[] {
  return [
    `Based on that request — "${requestText}" — which specific evidence would you point to first, and why?`,
    'What is one claim from today’s responses that needs stronger evidence, and how would you probe it?',
    'How would you rewrite your claim to make the evidence you’re using explicit?',
  ]
}

// A compact, two-line explanation of *why* AI proposed a given set of
// facilitation questions — the specific pattern in student work that
// prompted them, plus the instructional focus that follows from it. Shown
// alongside the proposed questions so the evidence -> question link is
// visible without adding full student-response cards.
type FacilitationEvidenceBasis = { evidence: string; instructionalFocus: string }

const facilitationFocusEvidence: Record<FacilitationFocus, FacilitationEvidenceBasis> = {
  'model-revision': {
    evidence: 'Several students changed how their model looks without citing new evidence for the change.',
    instructionalFocus: 'Strengthen connections between evidence and model revisions.',
  },
  'use-of-evidence': {
    evidence: 'Several students cited energy-transfer data but did not explain how the evidence supported their models.',
    instructionalFocus: 'Strengthen connections between evidence and scientific reasoning.',
  },
  misconceptions: {
    evidence: 'Several students described energy as cycling back through the ecosystem the way matter does.',
    instructionalFocus: 'Address the energy-versus-matter-cycling misconception directly.',
  },
  argumentation: {
    evidence: 'Several students stated a claim about their model without addressing a likely counter-argument.',
    instructionalFocus: 'Strengthen argumentation by requiring a response to an alternative view.',
  },
}

function customFacilitationEvidence(requestText: string): FacilitationEvidenceBasis {
  return {
    evidence: `Several student responses relate to “${requestText}.”`,
    instructionalFocus: 'Refine facilitation questions to target this pattern directly.',
  }
}

// `bold` marks an epistemic-practice term (existing convention). `added`
// marks text that AI actually inserted or substantially reworded in the AI
// Revised baseline — only segments with `added: true` get the yellow
// AI-highlight; everything else renders as the teacher's normal, unhighlighted
// text, even inside an otherwise-"revised" section. A segment can be both
// (e.g. a newly-introduced practice term like "Initial Model"). `flagged`
// marks the specific sentence/phrase in the ORIGINAL baseline text that the
// AI Suggestions tab points to as an opportunity — only that phrase becomes
// the clickable/highlighted trigger there, not the whole section, and it's
// chosen to line up with whatever lessonRevisionSegments later adds or
// changes for that same section (same pedagogical opportunity, two states).
type LessonSegment = { text: string; bold?: boolean; added?: boolean; flagged?: boolean }

type LessonVersion = 'original' | 'suggestions' | 'revised'
type LessonSource = 'ai-generated' | 'uploaded'

const lessonVersionLabels: Record<LessonVersion, string> = {
  original: 'Original',
  suggestions: 'AI Suggestions',
  revised: 'AI Revised',
}

const lessonSourceLabels: Record<LessonSource, string> = {
  'ai-generated': 'AI Generated',
  uploaded: 'Teacher Uploaded',
}

// Lesson Overview: Title, Grade Level, and Total Duration (the per-phase
// breakdown lives inline on each 5E phase below — see `duration` on
// lessonSteps — so this one line is the only place total time is stated).
const lessonMeta = [
  'Lesson Title: Modeling Energy Flow in Ecosystems',
  'Grade Level: 9th Grade Biology',
  'Total Duration: 55 minutes',
]

const lessonPractices = [
  'Initial Modeling',
  'Use of Evidence',
  'Argumentation',
  'Model Revision',
  'Scientific Explanation',
]

// A complete science lesson-plan structure, ordered the way a teacher scans
// a lesson plan: Standards & Learning Objectives, Materials & Equipment, the
// 5E instructional sequence (Engage, Explore, Explain, Elaborate, Evaluate —
// each carrying its own `duration` in minutes, shown inline next to the
// phase name instead of in a separate Pacing section), then Assessment.
// Each entry is one of the "major editable sections" a teacher can edit
// directly (Edit Lesson) or discuss with AI (Ask AI about this).
//
// `sectionHeading` renders a group heading above a step (used once per
// group, at the group's first entry). `leadIn` renders a plain, static,
// non-editable line above a step's own content (used for the "By the end
// of the lesson..." lead-in above the first learning objective).
// `displayPrefix` overrides the default "Label:" text shown before a
// step's content (used for "1."/"2."/"3." on individual, independently
// editable learning objectives instead of their internal label). `afterSection`
// marks the step after which the "Science Practices to Emphasize" chip block
// should render (previously hard-coded to right after the first step).
// `listStyle: 'bullet'` renders the step's segments as individual bullet
// list items instead of one flowing paragraph — used for Materials and
// Equipment & Technology, where each segment is one list item; the same
// per-segment `flagged`/`added` highlighting still applies per item.
const lessonSteps: {
  label: string
  duration?: number
  segments: readonly LessonSegment[]
  sectionHeading?: string
  leadIn?: string
  displayPrefix?: string
  afterSection?: 'practices'
  listStyle?: 'bullet'
}[] = [
  {
    label: 'Standards',
    sectionHeading: 'Standards & Learning Objectives',
    segments: [
      {
        text: 'NGSS HS-LS2-3 — Construct and revise an explanation based on evidence for the cycling of matter and flow of energy in ecosystems.',
      },
    ],
  },
  {
    label: 'Crosscutting Concept',
    segments: [{ text: 'Energy and Matter: Flows, Cycles, and Conservation.', flagged: true }],
  },
  {
    label: 'Learning Objective 1',
    leadIn: 'By the end of the lesson, students will be able to:',
    displayPrefix: '1.',
    segments: [
      {
        text: 'Construct an initial model showing energy flow from the sun through producers, consumers, and decomposers.',
      },
    ],
  },
  {
    label: 'Learning Objective 2',
    displayPrefix: '2.',
    segments: [{ text: 'Use evidence to explain why energy availability decreases at higher trophic levels.' }],
  },
  {
    label: 'Learning Objective 3',
    displayPrefix: '3.',
    afterSection: 'practices',
    segments: [
      { text: 'Revise their model based on new evidence and explain how energy is conserved but not recycled.' },
    ],
  },
  {
    label: 'Materials',
    sectionHeading: 'Materials & Equipment',
    listStyle: 'bullet',
    segments: [
      { text: 'Energy-flow model worksheet or poster paper' },
      { text: 'Colored markers' },
      { text: 'Class data table showing percent energy transfer between trophic levels' },
      { text: 'Short reading on the 10% rule' },
      { text: 'Sticky notes for evidence annotations' },
    ],
  },
  {
    label: 'Equipment & Technology',
    listStyle: 'bullet',
    segments: [
      { text: 'Document camera or projector to share student models' },
      { text: 'Class set of tablets or laptops for groups to build digital models', flagged: true },
    ],
  },
  {
    label: 'Safety Considerations',
    segments: [{ text: 'None — no lab materials are used in this activity.' }],
  },
  {
    label: 'Engage',
    duration: 5,
    segments: [
      { text: 'Teacher opens with ' },
      { text: 'a short overview of how energy and matter move through an ecosystem', flagged: true },
      {
        text: ', and previews the question students will need to answer with their model: How does your model show that energy is conserved but not recycled?',
      },
    ],
  },
  {
    label: 'Explore',
    duration: 15,
    segments: [
      { text: 'Students construct an initial ' },
      { text: 'model', bold: true, flagged: true },
      {
        text: ' that traces energy from the sun through producers, consumers, and at least one decomposer, using arrows to show the direction of energy transfer, the energy lost as heat at each step, and why less energy is available at higher trophic levels.',
      },
    ],
  },
  {
    label: 'Explain',
    duration: 10,
    segments: [
      {
        text: 'Students read a short article explaining the 10% rule — that only about 10% of energy is transferred from one trophic level to the next — and ',
      },
      { text: 'identify ', flagged: true },
      { text: 'evidence', bold: true, flagged: true },
      { text: ' in the reading for why less energy is available at higher trophic levels.', flagged: true },
    ],
  },
  {
    label: 'Elaborate',
    duration: 15,
    segments: [
      { text: 'In small groups, students ' },
      { text: 'argue', bold: true },
      {
        text: ' about which parts of their initial models are supported by the new evidence and which require revision. Students then ',
      },
      { text: 'revise their models', bold: true },
      { text: ' to reflect the evidence and ' },
      { text: 'annotate at least one change explaining why they made it.', flagged: true },
    ],
  },
  {
    label: 'Evaluate',
    duration: 5,
    segments: [
      {
        text: 'Teacher circulates during group work with a short checklist, listening for two things: whether a student names a specific piece of evidence for their claim, and whether they can say what they changed in their model and why. ',
      },
      {
        text: 'Two or three groups briefly share one revision and the evidence behind it with the whole class before moving on.',
        flagged: true,
      },
    ],
  },
  {
    label: 'Assessment',
    segments: [
      { text: 'Students write a scientific ' },
      { text: 'explanation', bold: true },
      {
        text: ', based on their revised model, answering the question: How does your model show that energy is conserved but not recycled? ',
      },
      { text: 'This is collected and graded as the lesson’s summative assessment.', flagged: true },
      {
        text: ' Look for: a claim, at least one specific piece of evidence from the model or data table, and reasoning that connects the two.',
      },
    ],
  },
]

function segmentsToText(segments: readonly LessonSegment[]): string {
  return segments.map((segment) => segment.text).join('')
}

// A 5E phase shows its duration as a small pill/badge next to the heading
// (not written into the sentence as "— 15 min") — there's no separate
// Pacing & Duration section. `step.label` itself remains the key used for
// every data lookup (lessonSuggestions, stepWorkflow, manualEditsByVersion).
function DurationBadge({ duration }: { duration?: number }) {
  if (duration === undefined) return null
  return <span className="badge duration-badge">{duration} min</span>
}

const lessonSuggestions: Record<string, string> = {
  'Crosscutting Concept':
    'This names the crosscutting concept but doesn’t yet say why it matters here. Consider adding a short line connecting it to the specific distinction this lesson hinges on — that energy flows one direction while matter cycles — so students see the concept as a lens for the model, not just a label.',
  'Equipment & Technology':
    'Listing tablets or laptops as a requirement could leave the activity inaccessible if your classroom doesn’t have reliable device access. Consider offering a low-tech alternative — poster paper and markers — as the default, with digital tools as an optional upgrade rather than a requirement.',
  Engage:
    'Right now, this opens by previewing the assessment question, so students may complete the modeling activity by simply reproducing a familiar ecosystem/energy-flow diagram without reasoning about mechanism, evidence, or explanatory purpose. Consider opening instead with an authentic driving question, such as: "Our school/community produces waste every day. Where does that matter go—and where does it come from in the first place?" This gives students a real phenomenon to investigate, with their model as an explanatory tool rather than something to reproduce.',
  Explore:
    'As written, this risks becoming a one-and-done diagram — students may reproduce a familiar energy-flow picture without reasoning about mechanism, evidence, or purpose. Frame it explicitly as an Initial Model representing students’ current ideas, which they will return to and revise later in the lesson once they have new evidence — positioning them as knowledge builders, not just diagram-makers.',
  Explain:
    'Consider having students flag one piece of evidence from the reading that they predict will either support or challenge their initial model, so they have something concrete to return to later, during Elaborate.',
  Elaborate:
    'This already asks students to argue and then revise, which is exactly the progression you want — but the annotation could be more specific. Consider asking students to name the exact piece of evidence in their annotation, not just note that something changed, so the connection between evidence and revision is explicit and easy to assess.',
  Evaluate:
    'This check is a good instinct, but without something specific to listen for, it’s easy to default to checking whether the diagram looks complete rather than whether students can justify it. Consider giving yourself a short checklist of exactly two things to listen for as you circulate.',
  Assessment:
    'As written, this is entirely summative — students only find out how they did after the lesson ends, with no chance to act on feedback. Consider adding a quick formative checkpoint earlier in the lesson (during Elaborate) so students can adjust their thinking before the graded explanation, rather than only being assessed at the very end.',
}

// The AI Revised baseline for each section. This is the teacher's ORIGINAL
// wording (see lessonSteps above) with only targeted AI edits layered in —
// most segments here are plain, unmarked, and textually identical to the
// original; only the specific phrase(s) AI actually added or substantially
// reworded carry `added: true`, which is the only thing LessonRichText
// renders with the yellow AI-highlight. This is deliberate: AI Revised
// should read as "existing teacher lesson + targeted AI improvements," not
// as a lesson AI generated from scratch. segmentsToText(...) below still
// concatenates to one continuous string for chat-apply / preview / the
// Original-vs-Revised diff plain-text uses, exactly as before.
const lessonRevisionSegments: Record<string, readonly LessonSegment[]> = {
  'Crosscutting Concept': [
    { text: 'Energy and Matter: Flows, Cycles, and Conservation.' },
    {
      text: ' This lesson asks students to distinguish energy flow, which moves in one direction and is lost as heat, from matter cycling, which is conserved and reused.',
      added: true,
    },
  ],
  'Equipment & Technology': [
    { text: 'Document camera or projector to share student models' },
    { text: 'Class set of tablets or laptops for groups to build digital models' },
    {
      text: 'Poster paper and markers are a sufficient low-tech alternative to the tablets/laptops above — treat digital modeling as optional, not required.',
      added: true,
    },
  ],
  Engage: [
    { text: 'Teacher opens with ' },
    {
      text: 'an authentic driving question — "Our school/community produces waste every day. Where does that matter go—and where does it come from in the first place?"',
      added: true,
    },
    {
      text: ' — then previews the question students will need to answer with their model: How does your model show that energy is conserved but not recycled?',
    },
  ],
  Explore: [
    { text: 'Students construct an ' },
    { text: 'Initial Model', bold: true, added: true },
    {
      text: ' that traces energy from the sun through producers, consumers, and at least one decomposer, using arrows to show the direction of energy transfer, the energy lost as heat at each step, and why less energy is available at higher trophic levels.',
    },
    {
      text: ' Students who need a starting point can use a template with the sun and three labeled boxes for producer, consumer, and decomposer.',
      added: true,
    },
  ],
  Explain: [
    {
      text: 'Students read a short article explaining the 10% rule — that only about 10% of energy is transferred from one trophic level to the next — and identify ',
    },
    { text: 'evidence', bold: true },
    { text: ' in the reading for why less energy is available at higher trophic levels.' },
    {
      text: ' Students then flag that evidence and predict whether it will support or challenge their initial model, underlining the sentence and writing a one-line prediction in the margin.',
      added: true,
    },
  ],
  Elaborate: [
    { text: 'In small groups, students ' },
    { text: 'argue', bold: true },
    {
      text: ' about which parts of their initial models are supported by the new evidence and which require revision. Students then ',
    },
    { text: 'revise their models', bold: true },
    { text: ' to reflect the evidence' },
    {
      text: ', annotating each change with the sentence starter "I changed ___ because the data showed ___" so the evidence behind the revision is explicit.',
      added: true,
    },
  ],
  Evaluate: [
    {
      text: 'Teacher circulates during group work with a short checklist, listening for two things: whether a student names a specific piece of evidence for their claim, and whether they can say what they changed in their model and why. Two or three groups briefly share one revision and the evidence behind it with the whole class before moving on.',
    },
    {
      text: ' This quick check flags who may need support before the written explanation.',
      added: true,
    },
  ],
  Assessment: [
    { text: 'Students ' },
    {
      text: 'exchange a quick draft claim with a partner during Elaborate for ungraded feedback, then ',
      added: true,
    },
    { text: 'write a scientific ' },
    { text: 'explanation', bold: true },
    {
      text: ', based on their revised model, answering the question: How does your model show that energy is conserved but not recycled? ',
    },
    {
      text: 'The draft exchange serves as a formative check; the final explanation is collected as the summative assessment.',
      added: true,
    },
    {
      text: ' Look for: a claim, at least one specific piece of evidence from the model or data table, and reasoning that connects the two.',
    },
  ],
}

const lessonRevisions: Record<string, string> = Object.fromEntries(
  Object.entries(lessonRevisionSegments).map(([label, segments]) => [label, segmentsToText(segments)]),
)

const chatSuggestionSummary: Record<string, string> = {
  'Crosscutting Concept':
    'connecting the crosscutting concept explicitly to the energy-flow-versus-matter-cycling distinction this lesson hinges on',
  'Equipment & Technology':
    'offering a low-tech, poster-and-markers alternative as the default instead of requiring tablets or laptops',
  Engage:
    'opening with an authentic driving question about where the school’s waste and matter come from, instead of previewing the assessment question',
  Explore: 'framing this as an Initial Model students will revisit later, and offering a starter template so a blank page doesn’t stall them',
  Explain: 'having students flag one piece of evidence from the reading that they predict will support or challenge their initial model',
  Elaborate: 'asking students to name the exact piece of evidence in their annotation, not just describe what changed',
  Evaluate: 'giving yourself a short two-item checklist — a specific piece of evidence, and what changed and why — to listen for while circulating',
  Assessment: 'adding an earlier, ungraded peer-feedback checkpoint before the final graded explanation, so the assessment isn’t only summative',
}

const stepWorkflow: Record<string, { teacherFollowUp: string; aiProposal: string }> = {
  'Crosscutting Concept': {
    teacherFollowUp: 'Can you connect this to why energy and matter behave differently in this lesson?',
    aiProposal:
      'Add a line noting that this lesson asks students to distinguish energy flow, which is one-directional and lost as heat, from matter cycling, which is conserved and reused — that’s the core idea the crosscutting concept is pointing at here.',
  },
  'Equipment & Technology': {
    teacherFollowUp: "I don't have access to this equipment.",
    aiProposal:
      'No problem — poster paper, markers, and the printed data table are enough to run the full activity. Skip the digital modeling tool entirely; a document camera, or just holding models up to the class, works fine for sharing.',
  },
  Engage: {
    teacherFollowUp:
      "I like that, but I don't want it to feel disconnected from the biology. How do I tie it back to energy and matter?",
    aiProposal:
      'Right after students react to the waste question, ask them to name where they think the matter and energy in that waste originally came from — that’s the thread they’ll trace all the way to the sun in their model.',
  },
  Explore: {
    teacherFollowUp: 'Some of my students freeze up with a blank page — can I give them a starter structure?',
    aiProposal:
      'Yes — give them a simple starter template with the sun and three empty boxes labeled producer, consumer, and decomposer, and ask them to add arrows and labels showing energy transfer and loss between each.',
  },
  Explain: {
    teacherFollowUp: "That's a good idea, but I don't want it to feel like a worksheet. Can it stay lightweight?",
    aiProposal:
      'We can keep it simple — students just underline one sentence in the article about energy transfer and write a one-line prediction about whether their model already shows that idea.',
  },
  Elaborate: {
    teacherFollowUp: 'How can I make sure the annotation actually connects to evidence, not just describes what changed?',
    aiProposal:
      'Have students finish the sentence "I changed ___ because the data showed ___" for their annotation — that structure forces them to name the evidence, not just describe the visual change.',
  },
  Evaluate: {
    teacherFollowUp: 'I like that, but I only have about 5 minutes for this. What should I actually listen for?',
    aiProposal:
      'Listen for two things: whether a student names a specific piece of evidence (not just "the data"), and whether they can say what they changed and why. That’s enough to flag who needs support before the written explanation.',
  },
  Assessment: {
    teacherFollowUp: 'Make this assessment more formative.',
    aiProposal:
      'Turn the written explanation into a two-part check: a quick draft claim students exchange with a partner for feedback partway through Elaborate — formative and ungraded — followed by the final explanation based on their revised model. The explanation you grade is really their second attempt.',
  },
}

function LessonRichText({ segments }: { segments: readonly LessonSegment[] }) {
  return (
    <>
      {segments.map((segment, index) => {
        const content = segment.bold ? <strong>{segment.text}</strong> : segment.text
        return segment.added ? (
          <span key={index} className="ai-highlight">
            {content}
          </span>
        ) : (
          <span key={index}>{content}</span>
        )
      })}
    </>
  )
}

function buildSectionConversation(text: string, sectionKey: string | null, viaSuggestion: boolean): ChatMessage[] {
  const summary = sectionKey ? chatSuggestionSummary[sectionKey] : undefined
  const opener: ChatMessage =
    viaSuggestion && summary
      ? {
          role: 'ai',
          text: `You selected: “${text}” I suggested ${summary}. How would you like to develop this activity?`,
        }
      : {
          role: 'ai',
          text: `You selected: “${text}” What would you like to explore or change about this part of the lesson?`,
        }

  const workflow = sectionKey ? stepWorkflow[sectionKey] : undefined
  if (!workflow) return [opener]

  return [opener, { role: 'teacher', text: workflow.teacherFollowUp }, { role: 'ai', text: workflow.aiProposal }]
}

function useSelectionPopup(containerRef: RefObject<HTMLElement | null>) {
  const [popup, setPopup] = useState<{ text: string; top: number; left: number; sectionKey: string | null } | null>(
    null,
  )

  useEffect(() => {
    const handleMouseUp = () => {
      const container = containerRef.current
      const selection = window.getSelection()
      const text = selection?.toString().trim() ?? ''

      if (!container || !text || !selection || selection.rangeCount === 0) {
        return
      }

      const range = selection.getRangeAt(0)
      const anchorNode = range.commonAncestorContainer
      const anchorElement =
        anchorNode.nodeType === Node.ELEMENT_NODE ? (anchorNode as Element) : anchorNode.parentElement

      if (!container.contains(anchorNode) || anchorElement?.closest('.suggestion-popover, .inline-ai-editor')) {
        return
      }

      const sectionKey = anchorElement?.closest('[data-section-key]')?.getAttribute('data-section-key') ?? null
      const rect = range.getBoundingClientRect()
      setPopup({ text, top: rect.top, left: rect.left + rect.width / 2, sectionKey })
    }

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Element | null
      if (target?.closest('.selection-ask-popup')) return
      setPopup(null)
    }

    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('mousedown', handleMouseDown)
    return () => {
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [containerRef])

  const clear = () => setPopup(null)

  return { popup, clear }
}

function SelectionAskAIPopup({
  popup,
  onAskAI,
}: {
  popup: { text: string; top: number; left: number; sectionKey: string | null } | null
  onAskAI: (text: string, sectionKey: string | null) => void
}) {
  if (!popup) return null

  return (
    <div className="selection-ask-popup" style={{ top: popup.top, left: popup.left }}>
      <button type="button" className="ask-ai-chip" onClick={() => onAskAI(popup.text, popup.sectionKey)}>
        Ask AI about this
      </button>
    </div>
  )
}

type EditStage = 'chatting' | 'previewing' | 'applied'

type SectionEditState = { stage: EditStage; messages: ChatMessage[] }

function useInlineEditor() {
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [statesByKey, setStatesByKey] = useState<Record<string, SectionEditState>>({})
  // revisedLesson: the accepted-change delta for each section, keyed by section label.
  // This is the "revisedLesson" data structure — it starts empty (Revised == Original)
  // and only grows when the teacher clicks "Apply Change". originalLesson (lessonSteps)
  // and suggestedLesson (lessonSuggestions) are separate, static, and never mutated.
  const [revisedLesson, setRevisedLesson] = useState<Record<string, string>>({})

  const ask = (key: string, messages: ChatMessage[]) => {
    setStatesByKey((prev) => ({ ...prev, [key]: { stage: 'chatting', messages } }))
    setOpenKey(key)
  }

  const close = (key: string) => {
    setOpenKey((current) => (current === key ? null : current))
  }

  const reopen = (key: string) => {
    setOpenKey(key)
  }

  const preview = (key: string) => {
    setStatesByKey((prev) => (prev[key] ? { ...prev, [key]: { ...prev[key], stage: 'previewing' } } : prev))
  }

  const apply = (key: string, addition: string) => {
    // This is the one place revisedLesson is ever written — only in response to
    // an explicit "Apply Change" click. originalLesson (lessonSteps) is untouched.
    setRevisedLesson((prev) => ({ ...prev, [key]: addition }))
    setStatesByKey((prev) => (prev[key] ? { ...prev, [key]: { ...prev[key], stage: 'applied' } } : prev))
  }

  const keepOriginal = (key: string) => {
    setStatesByKey((prev) => (prev[key] ? { ...prev, [key]: { ...prev[key], stage: 'chatting' } } : prev))
  }

  return { openKey, statesByKey, revisedLesson, ask, close, reopen, preview, apply, keepOriginal }
}

type InlineEditor = ReturnType<typeof useInlineEditor>

// Shared rendering for every chatbot/AI conversation thread in the app, so
// the AI-left / Teacher-right alignment and "AI"/"You" speaker labels stay
// consistent everywhere — including messages added later during an
// interaction, since they all flow through this same render path.
function ChatThread({ messages, className }: { messages: readonly ChatMessage[]; className?: string }) {
  return (
    <div className={className ? `chat-thread ${className}` : 'chat-thread'}>
      {messages.map((message, index) => (
        <div key={index} className={`chat-message ${message.role === 'teacher' ? 'teacher-message' : 'ai-message'}`}>
          <p className="chat-message-label">{message.role === 'teacher' ? 'You' : 'AI'}</p>
          {message.text}
        </div>
      ))}
    </div>
  )
}

function InlineAIConversation({
  state,
  canPreview,
  previewAddition,
  onPreview,
  onApply,
  onKeepOriginal,
  onClose,
}: {
  state: SectionEditState
  canPreview: boolean
  previewAddition?: readonly LessonSegment[]
  onPreview: () => void
  onApply: () => void
  onKeepOriginal: () => void
  onClose: () => void
}) {
  return (
    <div className="inline-ai-editor">
      <div className="inline-ai-header">
        <p className="card-label">AI — Ask about this section</p>
        <button type="button" className="drawer-close" aria-label="Close conversation" onClick={onClose}>
          ×
        </button>
      </div>

      <ChatThread messages={state.messages} className="inline-ai-thread" />

      {state.stage === 'chatting' && canPreview && (
        <button type="button" className="primary-button inline-preview-button" onClick={onPreview}>
          Preview Change
        </button>
      )}

      {state.stage === 'previewing' && previewAddition && previewAddition.length > 0 && (
        <div className="inline-ai-preview">
          <p className="card-label">Proposed change</p>
          <p>
            <span className="ai-highlight">
              <LessonRichText segments={previewAddition} />
            </span>
          </p>
          <div className="revision-actions">
            <button type="button" className="accept-button" onClick={onApply}>
              Apply Change
            </button>
            <button type="button" className="reject-button" onClick={onKeepOriginal}>
              Keep Original
            </button>
          </div>
        </div>
      )}

      {state.stage === 'applied' && <p className="inline-ai-applied-note">✓ Applied to the lesson plan.</p>}

      {state.stage !== 'previewing' && (
        <div className="composer-box">
          <input type="text" placeholder="Ask about this section..." />
          <button type="button" className="primary-button">
            Send
          </button>
        </div>
      )}
    </div>
  )
}

function App() {
  const [activePage, setActivePage] = useState<PageId>('lesson-generator')
  const [navOpen, setNavOpen] = useState(false)

  // Lifted out of LessonWorkspacePage so accepted revisions and conversation
  // history survive navigating to another page and back (that page unmounts
  // and remounts LessonWorkspacePage, which would otherwise reset this state).
  const [lessonVersion, setLessonVersion] = useState<LessonVersion>('original')
  const [openSuggestion, setOpenSuggestion] = useState<string | null>(null)
  const [openComparison, setOpenComparison] = useState<string | null>(null)
  const revisionEditor = useInlineEditor()

  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (hash && PAGE_CONFIG.some((page) => page.id === hash)) {
      setActivePage(hash as PageId)
    }
  }, [])

  useEffect(() => {
    window.location.hash = activePage
  }, [activePage])

  useEffect(() => {
    if (!navOpen) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [navOpen])

  const currentPage = useMemo(
    () => PAGE_CONFIG.find((page) => page.id === activePage) ?? PAGE_CONFIG[0],
    [activePage],
  )

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <button
            type="button"
            className="menu-button"
            aria-label="Open prototype navigation"
            aria-expanded={navOpen}
            onClick={() => setNavOpen(true)}
          >
            <span aria-hidden="true">☰</span>
          </button>
          <div className="brand-mark small">AI</div>
          <span className="brand-name">LessonLab</span>
        </div>
      </header>

      <main className="app-main">
        <div className="page-heading">
          <p className="eyebrow">Workspace</p>
          <h2>{currentPage.label}</h2>
        </div>

        {activePage === 'lesson-generator' && (
          <LessonPlanningPage onGenerateLessonPlan={() => setActivePage('lesson-workspace')} />
        )}
        {activePage === 'lesson-workspace' && (
          <LessonWorkspacePage
            editor={revisionEditor}
            lessonVersion={lessonVersion}
            setLessonVersion={setLessonVersion}
            openSuggestion={openSuggestion}
            setOpenSuggestion={setOpenSuggestion}
            openComparison={openComparison}
            setOpenComparison={setOpenComparison}
          />
        )}
        {activePage === 'class-feedback-dashboard' && <FeedbackDashboardPage />}
      </main>

      {navOpen && (
        <div className="nav-drawer-backdrop" onClick={() => setNavOpen(false)}>
          <aside
            className="nav-drawer"
            role="dialog"
            aria-label="Prototype navigation"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="nav-drawer-header">
              <div>
                <p className="eyebrow">Prototype Navigation</p>
                <p className="nav-drawer-subtitle">Jump between mockup states for demos.</p>
              </div>
              <button
                type="button"
                className="drawer-close"
                aria-label="Close navigation"
                onClick={() => setNavOpen(false)}
              >
                ×
              </button>
            </div>

            <nav className="page-nav" aria-label="Prototype pages">
              {PAGE_CONFIG.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  className={`nav-button ${activePage === page.id ? 'active' : ''}`}
                  onClick={() => {
                    setActivePage(page.id)
                    setNavOpen(false)
                  }}
                >
                  <span className="nav-dot" aria-hidden="true" />
                  <span>{page.label}</span>
                </button>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </div>
  )
}

type ChatMessage = { role: 'ai' | 'teacher'; text: string }

function LessonPlanningPanel({
  defaultTab,
  chatTitle,
  chatBadge,
  chatMessages,
  onGenerate,
}: {
  defaultTab: PlanningTab
  chatTitle: string
  chatBadge: string
  chatMessages: readonly ChatMessage[]
  onGenerate?: () => void
}) {
  const [planningTab, setPlanningTab] = useState<PlanningTab>(defaultTab)
  const [selectedPractices, setSelectedPractices] = useState<string[]>(['modeling'])

  const togglePractice = (practiceId: string) => {
    setSelectedPractices((prev) =>
      prev.includes(practiceId) ? prev.filter((item) => item !== practiceId) : [...prev, practiceId],
    )
  }

  return (
    <aside className="lesson-sidebar planning-panel">
      <div className="planning-tabs" role="tablist" aria-label="Lesson planning method">
        <button
          type="button"
          role="tab"
          aria-selected={planningTab === 'form'}
          className={`planning-tab ${planningTab === 'form' ? 'active' : ''}`}
          onClick={() => setPlanningTab('form')}
        >
          Form
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={planningTab === 'ai-chat'}
          className={`planning-tab ${planningTab === 'ai-chat' ? 'active' : ''}`}
          onClick={() => setPlanningTab('ai-chat')}
        >
          AI Chat
        </button>
      </div>

      {planningTab === 'form' ? (
        <div className="planning-form">
          <div className="upload-card">
            <div>
              <p className="card-label">Already have a lesson?</p>
              <h4>Upload it for AI-supported review</h4>
            </div>
            <button type="button" className="secondary-button">
              Upload file
            </button>
          </div>

          <div className="form-divider">
            <span>OR</span>
          </div>

          <div className="panel-header">
            <h3>Lesson Preferences</h3>
            <span className="badge">Draft</span>
          </div>

          <div className="field-grid">
            <label>
              <span>Grade level</span>
              <select defaultValue="">
                <option value="" disabled>
                  Select grade level
                </option>
                <option>6-8</option>
                <option>9-10</option>
                <option>11-12</option>
              </select>
            </label>

            <label>
              <span>Topic</span>
              <input type="text" placeholder="Ecosystems, forces, photosynthesis..." />
            </label>

            <label>
              <span>Standards</span>
              <input type="text" placeholder="NGSS, state standards, etc." />
            </label>

            <label>
              <span>Learning objectives</span>
              <textarea rows={4} placeholder="Describe the target learning outcomes..." />
            </label>

            <label>
              <span>Materials &amp; equipment</span>
              <textarea rows={2} placeholder="Materials, equipment, technology, lab/safety needs..." />
            </label>

            <label>
              <span>Lesson procedure</span>
              <select defaultValue="5e">
                <option value="5e">5E (Engage, Explore, Explain, Elaborate, Evaluate)</option>
                <option value="direct">Direct instruction + guided practice</option>
                <option value="inquiry">Open inquiry / investigation</option>
              </select>
            </label>

            <label>
              <span>Assessment preferences</span>
              <input type="text" placeholder="Formative check, summative task, both..." />
            </label>

            <label>
              <span>Pacing / duration</span>
              <input type="text" placeholder="e.g., 50-minute class period" />
            </label>

            <div className="practice-field">
              <span>Science Practices to Emphasize</span>
              <div className="practice-chip-row">
                {practiceOptions.map((practice) => (
                  <button
                    key={practice.id}
                    type="button"
                    className={`practice-chip ${selectedPractices.includes(practice.id) ? 'selected' : ''}`}
                    aria-pressed={selectedPractices.includes(practice.id)}
                    title={practice.description}
                    onClick={() => togglePractice(practice.id)}
                  >
                    {practice.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button type="button" className="primary-button generate-button" onClick={onGenerate}>
            Generate Lesson
          </button>
        </div>
      ) : (
        <div className="planning-chat">
          <div className="panel-header">
            <h3>{chatTitle}</h3>
            <span className="badge">{chatBadge}</span>
          </div>

          <ChatThread messages={chatMessages} className="planning-thread" />

          <div className="lesson-context-card">
            <p className="card-label">Lesson context</p>
            <div className="context-tags">
              {lessonContextTags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="composer-box">
            <input type="text" placeholder="Continue the planning conversation..." />
            <button type="button" className="primary-button">
              Send
            </button>
          </div>

          <button type="button" className="primary-button generate-button" onClick={onGenerate}>
            Generate Lesson Plan
          </button>
        </div>
      )}
    </aside>
  )
}

function LessonPlanningPage({ onGenerateLessonPlan }: { onGenerateLessonPlan: () => void }) {
  return (
    <div className="planning-layout">
      <LessonPlanningPanel
        defaultTab="form"
        chatTitle="AI Planning Assistant"
        chatBadge="Collaborative"
        chatMessages={planningConversation}
        onGenerate={onGenerateLessonPlan}
      />

      <section className="workspace-placeholder lesson-workspace-panel">
        <div className="canvas-header">
          <div>
            <p className="card-label">Lesson workspace</p>
            <h3>Lesson plan</h3>
          </div>
        </div>

        <div className="empty-state">
          <p className="card-label">Ready for lesson output</p>
          <h3>Your lesson plan will appear here</h3>
          <p className="empty-state-support">
            Complete the form, develop your activity with the AI assistant, or upload an existing
            lesson to get started.
          </p>
        </div>
      </section>
    </div>
  )
}

function LessonWorkspacePage({
  editor,
  lessonVersion,
  setLessonVersion,
  openSuggestion,
  setOpenSuggestion,
  openComparison,
  setOpenComparison,
}: {
  editor: InlineEditor
  lessonVersion: LessonVersion
  setLessonVersion: (version: LessonVersion) => void
  openSuggestion: string | null
  setOpenSuggestion: (key: string | null) => void
  openComparison: string | null
  setOpenComparison: (key: string | null) => void
}) {
  const [lessonSource] = useState<LessonSource>('uploaded')

  const contentRef = useRef<HTMLDivElement>(null)
  const { popup, clear: clearPopup } = useSelectionPopup(contentRef)

  // Original, AI Suggestions, and AI Revised each keep their own independent
  // set of accepted changes — a change applied while viewing one state must
  // never appear in another. The editor's maps are keyed by plain section
  // label, so every read/write here is namespaced with the active version
  // ("original:Assessment" vs. "suggestions:Assessment" vs. "revised:Assessment")
  // to keep the three states fully decoupled while reusing the same hook.
  const scopedKey = (label: string) => `${lessonVersion}:${label}`

  // Manual "Edit Lesson" mode is entirely separate from the AI revision
  // system above — it never touches editor.revisedLesson, suggestions, or
  // conversation state. A manual edit is kept per version (Original, AI
  // Suggestions, AI Revised each hold their own) and, once saved, displays
  // as plain text with no yellow highlight, since that color is reserved
  // for AI-authored changes.
  const [isEditing, setIsEditing] = useState(false)
  const [manualEditsByVersion, setManualEditsByVersion] = useState<Record<LessonVersion, Record<string, string>>>({
    original: {},
    suggestions: {},
    revised: {},
  })
  const [draftBySection, setDraftBySection] = useState<Record<string, string>>({})
  const [editBaseline, setEditBaseline] = useState<Record<string, string>>({})

  const getDisplayText = (label: string, segments: readonly LessonSegment[]) => {
    const manualEdit = manualEditsByVersion[lessonVersion][label]
    if (manualEdit !== undefined) return manualEdit
    const chatApplied = editor.revisedLesson[scopedKey(label)]
    if (chatApplied !== undefined) return chatApplied
    if (lessonVersion === 'revised' && lessonRevisions[label] !== undefined) return lessonRevisions[label]
    return segmentsToText(segments)
  }

  const startEditing = () => {
    const drafts: Record<string, string> = {}
    for (const step of lessonSteps) {
      drafts[step.label] = getDisplayText(step.label, step.segments)
    }
    setDraftBySection(drafts)
    setEditBaseline(drafts)
    setOpenSuggestion(null)
    setOpenComparison(null)
    setIsEditing(true)
  }

  const saveEditing = () => {
    setManualEditsByVersion((prev) => {
      const nextForVersion = { ...prev[lessonVersion] }
      for (const [label, text] of Object.entries(draftBySection)) {
        if (text !== editBaseline[label]) {
          nextForVersion[label] = text
        }
      }
      return { ...prev, [lessonVersion]: nextForVersion }
    })
    setIsEditing(false)
  }

  const handleManualAskAI = (text: string, sectionKey: string | null) => {
    if (!sectionKey) return
    editor.ask(scopedKey(sectionKey), buildSectionConversation(text, sectionKey, false))
    clearPopup()
    window.getSelection()?.removeAllRanges()
  }

  const renderInlineEditor = (label: string) => {
    const key = scopedKey(label)
    const state = editor.statesByKey[key]
    if (editor.openKey !== key || !state) return null

    return (
      <InlineAIConversation
        state={state}
        canPreview={Boolean(stepWorkflow[label])}
        previewAddition={lessonRevisionSegments[label]}
        onPreview={() => editor.preview(key)}
        onApply={() => {
          editor.apply(key, lessonRevisions[label] ?? '')
          // Collapse the conversation immediately so the teacher sees the
          // whole lesson — with just this section highlighted — as one
          // coherent document, rather than a chat panel interrupting it.
          // The highlight itself is reopenable via "Discuss this change".
          editor.close(key)
        }}
        onKeepOriginal={() => editor.keepOriginal(key)}
        onClose={() => editor.close(key)}
      />
    )
  }

  const renderLessonStep = (step: (typeof lessonSteps)[number]) => {
    // Most steps show their own label as the lead-in text ("Standards:",
    // "Engage:"); a few — the individually editable numbered learning
    // objectives — replace that with a short displayPrefix ("1.", "2.",
    // "3.") since their internal label is only a data key, not something
    // meant to be read.
    const labelText = step.displayPrefix ?? `${step.label}:`

    if (isEditing) {
      return (
        <div data-section-key={step.label}>
          <p>
            <strong>{labelText}</strong> <DurationBadge duration={step.duration} />
          </p>
          <textarea
            rows={3}
            value={draftBySection[step.label] ?? ''}
            onChange={(event) => setDraftBySection((prev) => ({ ...prev, [step.label]: event.target.value }))}
          />
        </div>
      )
    }

    // A manual edit (from Edit Lesson / Save Edits) always takes
    // priority for display — it's the teacher's own final wording,
    // shown as plain text with no yellow highlight, which is
    // reserved for AI suggestions and AI-applied changes.
    const manualEdit = manualEditsByVersion[lessonVersion][step.label]
    if (manualEdit !== undefined) {
      return (
        <div data-section-key={step.label}>
          <p>
            {labelText} <DurationBadge duration={step.duration} /> {manualEdit}
          </p>
        </div>
      )
    }

    // Each version keeps its own accepted change for this section.
    // "AI Revised" additionally starts from a pre-baked baseline
    // (lessonRevisions) representing AI's already-applied rewrite —
    // that baseline is independent of anything the teacher does in
    // Original or AI Suggestions, and a teacher's own accepted edit
    // here takes precedence over it once one exists.
    const chatApplied = editor.revisedLesson[scopedKey(step.label)]
    const baseline = lessonVersion === 'revised' ? lessonRevisions[step.label] : undefined
    const revisedText = chatApplied ?? baseline
    const isRevised = Boolean(revisedText)
    // The static "AI Revised" baseline carries segment-level bold info
    // (so a newly-introduced practice term like "Model Revision" still
    // renders bold inside the yellow highlight); a teacher-triggered
    // chat-applied change is stored as plain text and renders as such.
    const baselineSegments = lessonVersion === 'revised' ? lessonRevisionSegments[step.label] : undefined
    // The static AI Revised baseline is a pre-existing teacher lesson with
    // only targeted AI edits — LessonRichText highlights just the segments
    // marked `added`, so most of the section reads as normal text. A
    // teacher-triggered chat-applied change (any tab) is a one-off accepted
    // suggestion, stored as plain text, and keeps the original full-highlight
    // treatment as direct confirmation of exactly what was just approved.
    const isBaselineOnly = chatApplied === undefined && baselineSegments !== undefined
    const revisedNode =
      chatApplied === undefined && baselineSegments ? <LessonRichText segments={baselineSegments} /> : revisedText

    const suggestion = lessonVersion === 'suggestions' && !isRevised ? lessonSuggestions[step.label] : undefined
    const isSuggestionOpen = openSuggestion === step.label

    // Materials and Equipment & Technology render as a bullet list — one
    // list item per segment — instead of one flowing paragraph. This only
    // applies to the pre-baked baseline/original/suggestion view; a
    // teacher-triggered chat-applied change (`chatApplied`) is a flat,
    // one-off accepted string and falls through to the normal paragraph
    // rendering below, exactly like every other section.
    if (step.listStyle === 'bullet' && chatApplied === undefined) {
      const itemSegments = isBaselineOnly && baselineSegments ? baselineSegments : step.segments
      return (
        <div data-section-key={step.label}>
          <p>{labelText}</p>
          <ul className="lesson-bullet-list">
            {itemSegments.map((segment, segmentIndex) => {
              const content = segment.bold ? <strong>{segment.text}</strong> : segment.text

              if (isBaselineOnly && segment.added) {
                return (
                  <li key={segmentIndex}>
                    <span
                      role="button"
                      tabIndex={0}
                      className="ai-highlight lesson-highlight-trigger"
                      aria-expanded={openComparison === step.label}
                      onClick={() => {
                        editor.close(scopedKey(step.label))
                        setOpenComparison(openComparison === step.label ? null : step.label)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          editor.close(scopedKey(step.label))
                          setOpenComparison(openComparison === step.label ? null : step.label)
                        }
                      }}
                    >
                      {content}
                    </span>
                  </li>
                )
              }

              if (suggestion && segment.flagged) {
                return (
                  <li key={segmentIndex}>
                    <span
                      role="button"
                      tabIndex={0}
                      className="ai-highlight lesson-highlight-trigger"
                      aria-expanded={isSuggestionOpen}
                      onClick={() => setOpenSuggestion(isSuggestionOpen ? null : step.label)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setOpenSuggestion(isSuggestionOpen ? null : step.label)
                        }
                      }}
                    >
                      {content}
                    </span>
                  </li>
                )
              }

              return <li key={segmentIndex}>{content}</li>
            })}
          </ul>
          {isBaselineOnly && <span className="ai-revised-tag">AI revised</span>}

          {isSuggestionOpen && suggestion && (
            <div className="suggestion-popover">
              <p className="card-label">AI Suggestion</p>
              <p>{suggestion}</p>
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  setOpenSuggestion(null)
                  const flaggedText = segmentsToText(step.segments.filter((segment) => segment.flagged))
                  editor.ask(
                    scopedKey(step.label),
                    buildSectionConversation(flaggedText || segmentsToText(step.segments), step.label, true),
                  )
                }}
              >
                Ask AI about this
              </button>
            </div>
          )}

          {openComparison === step.label && revisedText && (
            <div className="suggestion-popover revision-diff">
              <p className="card-label">Original</p>
              <ul className="lesson-bullet-list">
                {step.segments.map((segment, segmentIndex) => (
                  <li key={segmentIndex}>{segment.bold ? <strong>{segment.text}</strong> : segment.text}</li>
                ))}
              </ul>
              <p className="revision-diff-arrow" aria-hidden="true">
                ↓
              </p>
              <p className="card-label">{lessonVersionLabels[lessonVersion]}</p>
              <ul className="lesson-bullet-list">
                {(baselineSegments ?? step.segments).map((segment, segmentIndex) => (
                  <li key={segmentIndex}>
                    <span className={segment.added ? 'ai-highlight' : undefined}>
                      {segment.bold ? <strong>{segment.text}</strong> : segment.text}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="revision-diff-note">✓ Applied from an AI suggestion you accepted.</p>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setOpenComparison(null)
                  if (editor.statesByKey[scopedKey(step.label)]) {
                    editor.reopen(scopedKey(step.label))
                  } else {
                    editor.ask(scopedKey(step.label), [
                      {
                        role: 'ai',
                        text: 'This section was already revised. What would you like to explore or change about it?',
                      },
                    ])
                  }
                }}
              >
                Discuss this change
              </button>
            </div>
          )}

          {renderInlineEditor(step.label)}
        </div>
      )
    }

    return (
      <div data-section-key={step.label}>
        <p>
          {labelText} <DurationBadge duration={step.duration} />{' '}
          {isRevised ? (
            <>
              <span
                role="button"
                tabIndex={0}
                className={isBaselineOnly ? 'lesson-highlight-trigger' : 'lesson-highlight-trigger ai-highlight'}
                aria-expanded={openComparison === step.label}
                onClick={() => {
                  editor.close(scopedKey(step.label))
                  setOpenComparison(openComparison === step.label ? null : step.label)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    editor.close(scopedKey(step.label))
                    setOpenComparison(openComparison === step.label ? null : step.label)
                  }
                }}
              >
                {revisedNode}
              </span>
              <span className="ai-revised-tag">AI revised</span>
            </>
          ) : suggestion ? (
            // Only the segment(s) marked `flagged` (the specific sentence or
            // phrase the suggestion is about) become the clickable/highlighted
            // trigger — the rest of the section renders as the teacher's
            // normal text, so AI Suggestions never blankets a whole section.
            <>
              {step.segments.map((segment, segmentIndex) => {
                const content = segment.bold ? <strong>{segment.text}</strong> : segment.text
                if (!segment.flagged) {
                  return <span key={segmentIndex}>{content}</span>
                }
                return (
                  <span
                    key={segmentIndex}
                    role="button"
                    tabIndex={0}
                    className="lesson-highlight-trigger ai-highlight"
                    aria-expanded={isSuggestionOpen}
                    onClick={() => setOpenSuggestion(isSuggestionOpen ? null : step.label)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setOpenSuggestion(isSuggestionOpen ? null : step.label)
                      }
                    }}
                  >
                    {content}
                  </span>
                )
              })}
            </>
          ) : (
            <LessonRichText segments={step.segments} />
          )}
        </p>

        {isSuggestionOpen && suggestion && (
          <div className="suggestion-popover">
            <p className="card-label">AI Suggestion</p>
            <p>{suggestion}</p>
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                setOpenSuggestion(null)
                const flaggedText = segmentsToText(step.segments.filter((segment) => segment.flagged))
                editor.ask(
                  scopedKey(step.label),
                  buildSectionConversation(flaggedText || segmentsToText(step.segments), step.label, true),
                )
              }}
            >
              Ask AI about this
            </button>
          </div>
        )}

        {openComparison === step.label && revisedText && (
          <div className="suggestion-popover revision-diff">
            <p className="card-label">Original</p>
            <p>
              <LessonRichText segments={step.segments} />
            </p>
            <p className="revision-diff-arrow" aria-hidden="true">
              ↓
            </p>
            <p className="card-label">{lessonVersionLabels[lessonVersion]}</p>
            <p>{isBaselineOnly ? revisedNode : <span className="ai-highlight">{revisedNode}</span>}</p>
            <p className="revision-diff-note">✓ Applied from an AI suggestion you accepted.</p>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setOpenComparison(null)
                if (editor.statesByKey[scopedKey(step.label)]) {
                  editor.reopen(scopedKey(step.label))
                } else {
                  editor.ask(scopedKey(step.label), [
                    {
                      role: 'ai',
                      text: 'This section was already revised. What would you like to explore or change about it?',
                    },
                  ])
                }
              }}
            >
              Discuss this change
            </button>
          </div>
        )}

        {renderInlineEditor(step.label)}
      </div>
    )
  }

  return (
    <div className="planning-layout">
      <LessonPlanningPanel
        defaultTab="form"
        chatTitle="AI Planning Assistant"
        chatBadge="Collaborative"
        chatMessages={planningConversation}
      />

      <section className="workspace-canvas">
        <div className="canvas-header">
          <div>
            <p className="card-label">Lesson workspace</p>
            <h3>{lessonVersionLabels[lessonVersion]} lesson</h3>
          </div>
          <div className="canvas-header-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => (isEditing ? saveEditing() : startEditing())}
            >
              {isEditing ? 'Save Edits' : 'Edit Lesson'}
            </button>
            <button type="button" className="primary-button">
              Export Lesson Plan
            </button>
          </div>
        </div>

        <div className="state-selector" role="tablist" aria-label="Lesson version">
          {(Object.keys(lessonVersionLabels) as LessonVersion[]).map((version) => (
            <button
              key={version}
              type="button"
              role="tab"
              aria-selected={lessonVersion === version}
              className={`state-tab ${lessonVersion === version ? 'active' : ''}`}
              disabled={isEditing}
              onClick={() => setLessonVersion(version)}
            >
              {lessonVersionLabels[version]}
            </button>
          ))}
        </div>

        <p className="lesson-source">Source: {lessonSourceLabels[lessonSource]}</p>

        <p className="content-legend">
          <span>
            <strong>Bold</strong> = Science Practice
          </span>
          <span className="legend-divider">·</span>
          <span>
            <span className="ai-highlight">Yellow</span> = AI Suggestion / Change
          </span>
        </p>

        {!isEditing && <p className="lesson-hint">Highlight any text in the lesson to ask AI about it.</p>}

        <div className="lesson-plan-editor">
          <div className="lesson-plan-content" ref={contentRef}>
            <p className="card-label">Lesson Overview</p>
            {lessonMeta.map((line, index) => (
              <p key={line} data-section-key={`workspace-meta-${index}`}>
                {line}
              </p>
            ))}

            {lessonSteps.map((step) => (
              <Fragment key={step.label}>
                {step.sectionHeading && <p className="card-label lesson-section-heading">{step.sectionHeading}</p>}
                {step.leadIn && <p className="lesson-lead-in">{step.leadIn}</p>}
                {renderLessonStep(step)}
                {step.afterSection === 'practices' && (
                  <div className="practice-tags-block" data-section-key="workspace-practices">
                    <p className="card-label">Science Practices to Emphasize</p>
                    <div className="context-tags">
                      {lessonPractices.map((practice) => (
                        <span key={practice} className="tag">
                          {practice}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </Fragment>
            ))}
          </div>
        </div>
      </section>

      <SelectionAskAIPopup popup={popup} onAskAI={handleManualAskAI} />
    </div>
  )
}

function FeedbackDashboardPage() {
  const [selectedTrendId, setSelectedTrendId] = useState(classTrends[0].id)
  const [selectedStudentName, setSelectedStudentName] = useState<string | null>(null)
  const [facilitationQuestions, setFacilitationQuestions] = useState<string[]>(suggestedQuestions)

  const [trendAnalysis, setTrendAnalysis] = useState<ClassTrend | null>(null)
  const [analysisMessages, setAnalysisMessages] = useState<ChatMessage[]>([])
  const [analysisDraftQuestion, setAnalysisDraftQuestion] = useState('')

  const [refineDraft, setRefineDraft] = useState('')
  const [refinedQuestions, setRefinedQuestions] = useState<string[] | null>(null)
  const [refinedEvidence, setRefinedEvidence] = useState<FacilitationEvidenceBasis | null>(null)

  const selectedTrend = classTrends.find((trend) => trend.id === selectedTrendId) ?? classTrends[0]
  const examples = studentExamplesByTrend[selectedTrend.id] ?? []

  const openTrendAnalysis = (trend: ClassTrend) => {
    const isSameContext = trendAnalysis?.id === trend.id
    if (!isSameContext) {
      const exampleConversation = trendExampleConversations[trend.id]
      setAnalysisMessages(exampleConversation ?? [{ role: 'ai', text: trendOpeningMessage(trend) }])
      setAnalysisDraftQuestion('')
    }
    setTrendAnalysis(trend)
  }

  const askAnalysisPrompt = (prompt: QuickPrompt) => {
    setAnalysisMessages((prev) => [
      ...prev,
      { role: 'teacher', text: prompt.question },
      { role: 'ai', text: prompt.answer },
    ])
  }

  const sendAnalysisQuestion = () => {
    const text = analysisDraftQuestion.trim()
    if (!text || !trendAnalysis) return
    setAnalysisMessages((prev) => [
      ...prev,
      { role: 'teacher', text },
      {
        role: 'ai',
        text: `That's worth exploring — I'd start by comparing a few of the stronger and developing student responses for ${trendAnalysis.label.toLowerCase()} to see where they diverge.`,
      },
    ])
    setAnalysisDraftQuestion('')
  }

  const applyFacilitationFocus = (focus: FacilitationFocus) => {
    // Copy rather than reuse the canned array reference, so this proposal is
    // never accidentally aliased with facilitationQuestions or a previous
    // proposal — each becomes its own independent snapshot.
    setRefinedQuestions([...facilitationFocusQuestionSets[focus]])
    setRefinedEvidence(facilitationFocusEvidence[focus])
  }

  const submitCustomFacilitationRequest = () => {
    const text = refineDraft.trim()
    if (!text) return
    setRefinedQuestions(customFacilitationQuestions(text))
    setRefinedEvidence(customFacilitationEvidence(text))
    setRefineDraft('')
  }

  const useRefinedQuestions = () => {
    if (!refinedQuestions) return
    // The approved list becomes the new current questions — and, since it's
    // its own array (not the same reference as refinedQuestions), it is what
    // any future refinement will read as "current" from here on.
    setFacilitationQuestions([...refinedQuestions])
    setRefinedQuestions(null)
    setRefinedEvidence(null)
  }

  const keepCurrentQuestions = () => {
    setRefinedQuestions(null)
    setRefinedEvidence(null)
  }

  return (
    <div className="dashboard-page">
      <section className="dashboard-task-card">
        <p className="card-label">Assignment</p>
        <h3>{dashboardTask.topic}</h3>
        <p className="dashboard-task-question">{dashboardTask.question}</p>
      </section>

      <div className="metrics-row">
        {metricCards.map((metric) => (
          <div key={metric.label} className="metric-card">
            <p>{metric.label}</p>
            <strong>{metric.value}</strong>
            <span>{metric.trend}</span>
          </div>
        ))}
      </div>

      <div className="report-grid">
        <section className="report-panel left-panel">
          <div className="panel-header compact">
            <h3>Overall class trends</h3>
          </div>

          <div className="trend-list">
            {classTrends.map((trend) => {
              const isSelected = trend.id === selectedTrend.id
              return (
                <div
                  key={trend.id}
                  className={`trend-item${isSelected ? ' active' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => {
                    setSelectedTrendId(trend.id)
                    setSelectedStudentName(null)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedTrendId(trend.id)
                      setSelectedStudentName(null)
                    }
                  }}
                >
                  <div className="trend-item-row">
                    <span>{trend.label}</span>
                    <span className="trend-stat">
                      <strong>{trend.percent}%</strong>
                      <span className="trend-count">
                        {trend.count}/{trend.total}
                      </span>
                    </span>
                  </div>
                  {isSelected && (
                    <button
                      type="button"
                      className="secondary-button analyze-trend-button"
                      onClick={(event) => {
                        event.stopPropagation()
                        openTrendAnalysis(trend)
                      }}
                    >
                      Analyze with AI
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        <section className="report-panel right-panel">
          <div className="panel-header compact">
            <h3>Student examples</h3>
            <span className="tag">{selectedTrend.label}</span>
          </div>

          <div className="student-list">
            {examples.map((student) => {
              const isSelected = selectedStudentName === student.name
              return (
                <div
                  key={student.name}
                  className={`student-card${isSelected ? ' active' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedStudentName((prev) => (prev === student.name ? null : student.name))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedStudentName((prev) => (prev === student.name ? null : student.name))
                    }
                  }}
                >
                  <div className="student-header">
                    <h4>{student.name}</h4>
                    <span className="tag">{student.level}</span>
                  </div>
                  <p className="student-quote">&ldquo;{student.quote}&rdquo;</p>
                  <p className="student-note">{student.note}</p>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      <section className="questions-panel">
        <div className="panel-header compact">
          <h3>Suggested Facilitation Questions</h3>
        </div>

        <ul className="question-list">
          {facilitationQuestions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>

        <div className="facilitation-refine">
          <p className="card-label">Refine with AI</p>

          <div className="practice-chip-row">
            {facilitationFocusOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className="practice-chip"
                onClick={() => applyFacilitationFocus(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="composer-box">
            <input
              type="text"
              placeholder="Ask AI to refine these questions..."
              value={refineDraft}
              onChange={(event) => setRefineDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submitCustomFacilitationRequest()
              }}
            />
            <button type="button" className="primary-button" onClick={submitCustomFacilitationRequest}>
              Refine
            </button>
          </div>

          {refinedQuestions && (
            <div className="inline-ai-preview">
              <p className="card-label">Proposed facilitation questions</p>
              {refinedEvidence && (
                <div className="facilitation-evidence-basis">
                  <p className="lesson-hint">
                    <strong>Based on class evidence:</strong> {refinedEvidence.evidence}
                  </p>
                  <p className="lesson-hint">
                    <strong>Instructional focus:</strong> {refinedEvidence.instructionalFocus}
                  </p>
                </div>
              )}
              <ul className="question-list">
                {refinedQuestions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
              <div className="revision-actions">
                <button type="button" className="accept-button" onClick={useRefinedQuestions}>
                  Use These Questions
                </button>
                <button type="button" className="reject-button" onClick={keepCurrentQuestions}>
                  Keep Current Questions
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {trendAnalysis && (
        <div className="ai-analysis-backdrop" onClick={() => setTrendAnalysis(null)}>
          <aside className="ai-analysis-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="nav-drawer-header">
              <div>
                <p className="eyebrow">AI Analysis</p>
                <h3>Analyze Class Trends</h3>
              </div>
              <button
                type="button"
                className="drawer-close"
                aria-label="Close AI analysis"
                onClick={() => setTrendAnalysis(null)}
              >
                ×
              </button>
            </div>

            <div className="lesson-context-card">
              <p className="card-label">Current context</p>
              <p className="dashboard-task-question">
                {trendAnalysis.label} — {trendAnalysis.percent}% ({trendAnalysis.count}/{trendAnalysis.total})
              </p>
            </div>

            <div className="trend-chat-thread">
              {analysisMessages.map((message, index) => {
                const isTeacher = message.role === 'teacher'
                return (
                  <div key={index} className={`trend-chat-row ${isTeacher ? 'trend-chat-row-teacher' : 'trend-chat-row-ai'}`}>
                    <p className="trend-chat-speaker">{isTeacher ? 'Teacher' : 'AI Analysis'}</p>
                    <div className={`trend-chat-bubble ${isTeacher ? 'trend-chat-bubble-teacher' : 'trend-chat-bubble-ai'}`}>
                      {message.text}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="trend-chat-suggestions">
              {trendQuickPrompts(trendAnalysis)
                .slice(0, 2)
                .map((prompt) => (
                  <button
                    key={prompt.question}
                    type="button"
                    className="practice-chip"
                    onClick={() => askAnalysisPrompt(prompt)}
                  >
                    {prompt.question}
                  </button>
                ))}
            </div>

            <div className="composer-box">
              <input
                type="text"
                placeholder="Ask a follow-up question..."
                value={analysisDraftQuestion}
                onChange={(event) => setAnalysisDraftQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') sendAnalysisQuestion()
                }}
              />
              <button type="button" className="primary-button" onClick={sendAnalysisQuestion}>
                Send
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}

export default App
