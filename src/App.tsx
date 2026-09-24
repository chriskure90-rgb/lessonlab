import { Fragment, useEffect, useMemo, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import './App.css'

type PageId =
  | 'lesson-generator'
  | 'student-feedback'
  | 'class-feedback-dashboard'

// The lesson workspace (generated lesson, AI suggestions, revisions, Edit
// Lesson) lives inside Lesson Planning — there's no separate nav page for it.
const PAGE_CONFIG = [
  { id: 'lesson-generator', label: 'Lesson Planning' },
  { id: 'class-feedback-dashboard', label: 'Class Feedback' },
  { id: 'student-feedback', label: 'Student Feedback' },
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
    label: 'Develop and Use Models',
    description: 'Students build a model to represent their current thinking, then test and revise it as they learn more.',
  },
  {
    id: 'explanation',
    label: 'Construct Explanations',
    description: 'Students connect a claim to evidence with clear reasoning about why it’s true.',
  },
  {
    id: 'argumentation',
    label: 'Engage in Argument from Evidence',
    description: 'Students defend their thinking and weigh alternative ideas using evidence.',
  },
]

const pacingOptions = [
  { id: '45', label: '45 min' },
  { id: '50', label: '50 min' },
  { id: '60', label: '60 min' },
  { id: '75', label: '75 min' },
  { id: '90', label: '90 min' },
  { id: 'custom', label: 'Custom' },
] as const

const lessonContextTags = ['Grades 9–12', 'Zombie Fires', 'Model Revision', 'Develop and Use Models']

// The attached authentic student model — used as the primary example
// student artifact throughout Class Feedback. Lives in /public so a
// missing file degrades to a broken-image icon instead of failing the
// build; drop the real file at public/zombie-fires-student-model.png.
const ZOMBIE_FIRES_STUDENT_MODEL_IMAGE = '/zombie-fires-student-model.png'

// Mock NGSS data for the Standards search field on the planning Form — lets
// a teacher find a standard by topic/concept/keyword instead of needing to
// already know its code. `keywords` are extra plain-language search terms
// beyond what's already in the code/description.
type NgssGradeBand = 'K-2' | '3-5' | '6-8' | '9-12'

type NgssStandard = {
  code: string
  description: string
  gradeBand: NgssGradeBand
  keywords: readonly string[]
}

// Maps the Lesson Planning form's own "Grade level" options onto the NGSS
// grade band the Standards search filters by — so the teacher is never
// asked to pick a grade level a second time.
const gradeLevelToNgssBand: Partial<Record<string, NgssGradeBand>> = {
  '6-8': '6-8',
  '9-12': '9-12',
}

const ngssStandardsBank: NgssStandard[] = [
  {
    code: 'K-ESS3-1',
    description: 'Use a model to represent the relationship between the needs of different plants and animals and the places they live.',
    gradeBand: 'K-2',
    keywords: ['habitat', 'needs', 'organisms', 'model'],
  },
  {
    code: '2-LS2-1',
    description: 'Plan and conduct an investigation to determine if plants need sunlight and water to grow.',
    gradeBand: 'K-2',
    keywords: ['plants', 'growth', 'investigation', 'sunlight'],
  },
  {
    code: '3-LS4-3',
    description: 'Construct an argument with evidence that in a particular habitat some organisms can survive well, some survive less well, and some cannot survive at all.',
    gradeBand: '3-5',
    keywords: ['habitat', 'survival', 'argument', 'evidence'],
  },
  {
    code: '4-PS3-2',
    description: 'Make observations to provide evidence that energy can be transferred from place to place by sound, light, heat, and electric currents.',
    gradeBand: '3-5',
    keywords: ['energy', 'transfer', 'heat', 'light'],
  },
  {
    code: '5-PS3-1',
    description: 'Use models to describe that energy in animals’ food was once energy from the sun.',
    gradeBand: '3-5',
    keywords: ['energy', 'food', 'sun', 'model'],
  },
  {
    code: 'MS-LS2-1',
    description: 'Analyze and interpret data to provide evidence for the effects of resource availability on organisms and populations of organisms in an ecosystem.',
    gradeBand: '6-8',
    keywords: ['ecosystem', 'population', 'resources', 'data'],
  },
  {
    code: 'MS-LS2-3',
    description: 'Develop a model to describe the cycling of matter and flow of energy among living and nonliving parts of an ecosystem.',
    gradeBand: '6-8',
    keywords: ['ecosystem', 'energy', 'matter', 'model', 'cycling'],
  },
  {
    code: 'MS-PS3-3',
    description: 'Apply scientific principles to design, construct, and test a device that either minimizes or maximizes thermal energy transfer.',
    gradeBand: '6-8',
    keywords: ['energy', 'heat', 'design', 'engineering'],
  },
  {
    code: 'MS-ESS3-3',
    description: 'Apply scientific principles to design a method for monitoring and minimizing a human impact on the environment.',
    gradeBand: '6-8',
    keywords: ['environment', 'human impact', 'sustainability'],
  },
  {
    code: 'HS-LS2-3',
    description: 'Construct and revise an explanation based on evidence for the cycling of matter and flow of energy in aerobic and anaerobic conditions.',
    gradeBand: '9-12',
    keywords: ['ecosystem', 'energy', 'matter', 'cycling', 'evidence', 'peat', 'permafrost', 'zombie fire'],
  },
  {
    code: 'HS-LS2-4',
    description: 'Use mathematical representations to support claims for the cycling of matter and flow of energy among organisms in an ecosystem.',
    gradeBand: '9-12',
    keywords: ['ecosystem', 'energy', 'matter', 'mathematical', 'zombie fire'],
  },
  {
    code: 'HS-LS2-5',
    description:
      'Develop a model to illustrate the role of photosynthesis and cellular respiration in the cycling of carbon among the biosphere, atmosphere, hydrosphere, and geosphere.',
    gradeBand: '9-12',
    keywords: ['carbon cycle', 'biosphere', 'atmosphere', 'model', 'zombie fire'],
  },
  {
    code: 'HS-LS1-5',
    description: 'Use a model to illustrate how photosynthesis transforms light energy into stored chemical energy.',
    gradeBand: '9-12',
    keywords: ['photosynthesis', 'energy', 'model', 'cells', 'matter'],
  },
  {
    code: 'HS-LS1-6',
    description:
      'Construct and revise an explanation based on evidence for how carbon, hydrogen, and oxygen from sugar molecules may combine with other elements to form amino acids and/or other large carbon-based molecules.',
    gradeBand: '9-12',
    keywords: ['carbon', 'matter', 'molecules', 'explanation', 'peat'],
  },
  {
    code: 'HS-LS1-7',
    description:
      'Use a model to illustrate that cellular respiration is a chemical process whereby the bonds of food molecules and oxygen molecules are broken and the bonds in new compounds are formed resulting in a net transfer of energy.',
    gradeBand: '9-12',
    keywords: ['respiration', 'combustion', 'energy transfer', 'model', 'matter'],
  },
  {
    code: 'HS-PS3-1',
    description: 'Create a computational model to calculate the change in energy of one component in a system when the change in energy of the other components and energy flows in and out of the system are known.',
    gradeBand: '9-12',
    keywords: ['energy', 'system', 'computational', 'model'],
  },
  {
    code: 'HS-ESS2-6',
    description: 'Develop a quantitative model to describe the cycling of carbon among the hydrosphere, atmosphere, geosphere, and biosphere.',
    gradeBand: '9-12',
    keywords: ['carbon', 'cycling', 'earth', 'model', 'permafrost', 'zombie fire', 'wildfire'],
  },
  {
    code: 'HS-ETS1-2',
    description:
      'Design a solution to a complex real-world problem by breaking it down into smaller, more manageable problems that can be solved through engineering.',
    gradeBand: '9-12',
    keywords: ['engineering', 'design', 'problem-solving', 'real-world', 'human impact'],
  },
]

function matchesStandardsQuery(standard: NgssStandard, query: string): boolean {
  if (!query) return true
  const normalizedQuery = query.toLowerCase()
  return (
    standard.code.toLowerCase().includes(normalizedQuery) ||
    standard.description.toLowerCase().includes(normalizedQuery) ||
    standard.keywords.some((keyword) => keyword.toLowerCase().includes(normalizedQuery))
  )
}

const planningConversation = [
  {
    role: 'ai',
    text: 'What activity do you want to plan today, and what science practices are we focusing on?',
  },
  {
    role: 'teacher',
    text: 'I already have a model-based activity for our Zombie Fires unit, and I want to revise it so students think more deeply about how matter and energy move through the system — not just relabel their diagrams.',
  },
  {
    role: 'ai',
    text: 'That’s a strong fit for Model Revision. Right now, when students revise their models with new evidence, are they mostly adding new parts to the diagram, or actually changing how they explain the system?',
  },
  {
    role: 'teacher',
    text: 'Mostly adding parts. How could I revise this activity so students think more deeply about how matter and energy move through the zombie fire system?',
  },
  {
    role: 'ai',
    text: 'You could ask students to revise their models after examining evidence about peat, smoke, CO₂, and seasonal changes. Instead of only adding new components, ask them to show where matter moves and where energy is transferred in the system. This can help make the mechanism visible in their models. Would you like me to suggest a specific revision to the model-revision activity?',
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
  topic: 'Zombie Fires: Matter and Energy Flow',
  question:
    'Prompt: Develop a model that helps explain how zombie fires are burning under ice and releasing so much carbon. Your model should show how matter (peat) and energy (fire) flow between the biosphere and atmosphere, and what questions you still need to answer.',
}

// Individual student evidence behind one class-level pattern row. `response`
// is the student's written words; `artifact` is a short plain-language
// description of their drawn model/diagram (this prototype has no real
// image assets, so a model is represented as a descriptive caption rather
// than an image). Either can be present alone, or both together.
type StudentEvidence = {
  name: string
  response?: string
  artifact?: string
  // Path/URL to a real scanned student artifact (e.g. the attached zombie
  // fires model). Distinct from `artifact`, which is always a plain-text
  // caption — a student can have either, both, or neither.
  artifactImage?: string
}

// One clickable row in any of the three summary sections. `kind` drives
// which field (artifact vs. written response) the individual-evidence panel
// leads with once a row is selected — Engagement in Science Practices
// prioritizes the model/artifact; the other two lead with the response.
type PatternRow = {
  id: string
  label: string
  count: number
  kind: 'objective' | 'practice' | 'misconception'
  students: StudentEvidence[]
}

// Section A — Learning Objective Overlap. One group per learning objective
// entered on the Lesson Planning page (see `lessonSteps` — "Learning
// Objective 1/2/3"); each group lists the distinct student ideas the class
// produced in response to it, most-common first, with no percentage score.
type LearningObjectiveGroup = { objective: string; ideas: PatternRow[] }

const learningObjectiveOverlap: LearningObjectiveGroup[] = [
  {
    objective:
      '1.A Obtain information about zombie fires to identify potential cause-and-effect relationships that lead to changes in the biosphere and atmosphere.',
    ideas: [
      {
        id: 'lo1a-permafrost-thawing',
        label: 'Identifies permafrost thawing as what lets the underground fire keep burning',
        count: 16,
        kind: 'objective',
        students: [
          {
            name: 'Jordan P.',
            response:
              'My model shows the fire moving underground into the peat as the permafrost thaws. During winter, I think the fire keeps burning in the peat underneath the snow and ice, and then it can come back to the surface in spring.',
            artifact:
              'Seasonal diagram (Summer/Fall, Winter, Spring) showing an underground fire in peat/permafrost beneath snow, smoke/CO₂ rising to the atmosphere, and a fire scar from the previous season.',
            artifactImage: ZOMBIE_FIRES_STUDENT_MODEL_IMAGE,
          },
          {
            name: 'Lena M.',
            response:
              'I noticed warmer-than-average summer and fall temperatures come right before the fires start, so I drew an arrow connecting those two boxes in my model.',
            artifact: 'Diagram with a labeled "warmer than average temperatures" box arrowed into a "fire" box.',
          },
        ],
      },
      {
        id: 'lo1a-earlier-spring-fires',
        label: 'Connects earlier-than-usual spring temperatures to new fires flaring up',
        count: 11,
        kind: 'objective',
        students: [
          {
            name: 'Sofia R.',
            response: 'When spring comes earlier than usual, the snow melts sooner and a fire flares back up in the same spot as last year.',
            artifact: 'Model with a "Spring (earlier than usual)" panel showing fire flaring up from the same burn scar.',
          },
          {
            name: 'Ethan R.',
            response: 'I connected the earlier spring warming to the fire becoming visible again above ground.',
          },
        ],
      },
      {
        id: 'lo1a-no-mechanism',
        label: 'Notes zombie fires are unusual without identifying a cause',
        count: 7,
        kind: 'objective',
        students: [
          {
            name: 'Noah T.',
            response: 'These fires are weird because they don’t go out in the winter like normal fires do.',
          },
          { name: 'Grace L.', response: 'I just noted that this doesn’t happen with regular wildfires.' },
        ],
      },
    ],
  },
  {
    objective: '1.B Develop a model to explain how matter (peat) and energy (fire) flow in the zombie fire system.',
    ideas: [
      {
        id: 'lo1b-matter-energy-labeled',
        label: 'Model explicitly labels peat/permafrost as matter and fire as energy, both flowing to the atmosphere',
        count: 12,
        kind: 'objective',
        students: [
          {
            name: 'Jordan P.',
            response:
              'I labeled the peat and permafrost as matter and the fire as energy, and drew arrows from both of them up into the smoke and CO₂ leaving through the atmosphere.',
            artifact: 'Diagram with "(matter)" labeled next to peat/permafrost and "(energy)" labeled next to the underground fire, both arrowed up to smoke/CO₂.',
            artifactImage: ZOMBIE_FIRES_STUDENT_MODEL_IMAGE,
          },
          {
            name: 'Maya T.',
            response: 'My model shows smoke coming out of the ground, but I didn’t say what part was matter and what part was energy.',
          },
        ],
      },
      {
        id: 'lo1b-underground-persists',
        label: 'Model shows fire burning underground beneath snow/ice throughout winter',
        count: 13,
        kind: 'objective',
        students: [
          {
            name: 'Diego H.',
            response: 'My model has a separate box for winter showing the fire still burning underground even though the surface is covered in snow.',
            artifact: 'Model with a "Winter (very cold temperatures)" panel showing an underground fire icon beneath a snow layer.',
          },
          {
            name: 'Priya S.',
            response: 'I drew the snow on top and the fire underneath it, connected with a note saying the fire keeps going all winter.',
          },
        ],
      },
      {
        id: 'lo1b-above-ground-only',
        label: 'Model draws fire only above ground, without showing it persisting underground',
        count: 6,
        kind: 'objective',
        students: [
          {
            name: 'Carlos M.',
            response: 'I just drew flames and smoke coming from the ground without showing what was happening underneath.',
          },
          { name: 'Hannah W.', response: 'My model shows the fire, the smoke, and the snow, but not how they connect underground.' },
        ],
      },
    ],
  },
  {
    objective:
      '1.C Ask questions to clarify how the flow of energy and matter in the atmosphere (CO₂/smoke) and biosphere (peat/permafrost) allows zombie fires to burn, including the role of humans.',
    ideas: [
      {
        id: 'lo1c-human-role',
        label: 'Asks how human activity might be making zombie fires more frequent',
        count: 12,
        kind: 'objective',
        students: [
          {
            name: 'Zoe F.',
            response: 'Is it something humans are doing that’s making the permafrost thaw more, or would this happen anyway?',
          },
          {
            name: 'Liam O.',
            response: 'Do zombie fires happen more in places where people log or build roads, or is it purely about temperature?',
          },
        ],
      },
      {
        id: 'lo1c-carbon-amount',
        label: 'Asks how much carbon zombie fires actually release compared to normal wildfires',
        count: 9,
        kind: 'objective',
        students: [
          {
            name: 'Aisha K.',
            response: 'How much CO₂ does a zombie fire release compared to a regular wildfire that burns and goes out?',
          },
          {
            name: 'Marcus J.',
            response: 'Does the carbon come mostly from the peat itself, or from something else in the permafrost?',
          },
        ],
      },
      {
        id: 'lo1c-restated-fact',
        label: 'Restates what’s already known rather than posing a new question',
        count: 6,
        kind: 'objective',
        students: [
          { name: 'Emma K.', response: 'Zombie fires burn underground in the winter and start again in spring.' },
          { name: 'Grace L.', response: 'They release smoke and carbon dioxide into the air.' },
        ],
      },
    ],
  },
]

// Section B — Engagement in Science Practices. One group per practice
// offered on the Lesson Planning form (see `practiceOptions`), each listing
// the specific ways students' models and responses demonstrated it. Only
// "Develop and Use Models" is included — this lesson didn't yet ask
// students to Construct Explanations or Engage in Argument from Evidence,
// so those groups were removed rather than left showing patterns for
// practices students were never actually asked to do.
type PracticeGroup = { practice: string; patterns: PatternRow[] }

const scienceInPracticePatterns: PracticeGroup[] = [
  {
    practice: 'Develop and Use Models',
    patterns: [
      {
        id: 'practice-models-system-components',
        label: 'Models include key system components: peat/permafrost, underground fire, snow/ice, and smoke/CO₂',
        count: 15,
        kind: 'practice',
        students: [
          {
            name: 'Jordan P.',
            artifact:
              'Diagram with seasonal panels (Summer/Fall, Winter, Spring) showing underground fire in peat/permafrost beneath snow, smoke/CO₂ rising to the atmosphere, and a fire scar from the previous season.',
            artifactImage: ZOMBIE_FIRES_STUDENT_MODEL_IMAGE,
            response: 'I made sure to include the peat, the permafrost, the underground fire, the snow, and the smoke/CO₂, since those are the main parts of the system.',
          },
          {
            name: 'Marcus J.',
            artifact: 'Diagram showing an underground fire box connected by arrows to a smoke/CO₂ cloud, with a separate snow layer on top.',
          },
        ],
      },
      {
        id: 'practice-models-matter-energy-flows',
        label: 'Models distinguish matter (peat) from energy (fire) and show both flowing to the atmosphere',
        count: 11,
        kind: 'practice',
        students: [
          {
            name: 'Lena M.',
            artifact: 'Model with arrows from a labeled "peat (matter)" box and a labeled "fire (energy)" box, both pointing up to the atmosphere.',
            response: 'I labeled which parts of my model were matter and which were energy so it’s clear how each one moves.',
          },
          {
            name: 'Priya S.',
            artifact: 'Diagram showing separate arrows for matter and energy leaving the underground fire.',
          },
        ],
      },
      {
        id: 'practice-models-seasonal-change',
        label: 'Models represent how conditions change across seasons while the fire persists underground',
        count: 8,
        kind: 'practice',
        students: [
          {
            name: 'Diego H.',
            artifact: 'Model with three side-by-side panels for summer/fall, winter, and spring, each showing the underground fire in a different state.',
            response: 'My model shows the same fire underground in every panel, just with different amounts of snow on top depending on the season.',
          },
          {
            name: 'Sofia R.',
            artifact: 'Model with a "Spring (earlier than usual)" panel showing the fire flaring back up above ground.',
          },
        ],
      },
    ],
  },
]

// Section C — Misconceptions found across student responses and models.
const misconceptionPatterns: PatternRow[] = [
  {
    id: 'misconception-new-fire-each-spring',
    label: 'Believes the spring fire is a brand-new fire rather than the same fire continuing underground',
    count: 8,
    kind: 'misconception',
    students: [
      { name: 'Emma K.', response: 'A new fire probably starts in spring once things dry out again.' },
      { name: 'Carlos M.', response: 'I think the winter fire goes out, and then a different fire starts in the same spot later.' },
    ],
  },
  {
    id: 'misconception-no-matter-energy-distinction',
    label: 'Treats peat and fire as the same thing rather than distinguishing matter (peat) from energy (fire)',
    count: 6,
    kind: 'misconception',
    students: [
      { name: 'Liam O.', response: 'The peat and the fire are kind of the same thing — the peat is just the fire underground.' },
      { name: 'Priya S.', response: 'I didn’t really separate the peat from the fire in my model, they’re both just “the fire part.”' },
    ],
  },
  {
    id: 'misconception-common-everywhere',
    label: 'Assumes zombie fires are common wherever wildfires occur, not a specific, increasing permafrost phenomenon',
    count: 4,
    kind: 'misconception',
    students: [
      {
        name: 'Noah T.',
        response: 'I figured most wildfires probably keep smoldering underground like this once the surface fire is out.',
        artifact: 'Model showing underground burning beneath a generic forest, with no reference to permafrost or peat.',
      },
      { name: 'Hannah W.', response: 'I thought this happens with basically any big fire, not just fires in icy areas.' },
    ],
  },
]

// A flat lookup across all three sections, keyed by row id, so the
// individual-evidence panel can resolve whichever row the teacher last
// clicked regardless of which section it came from.
const allPatternRows: Record<string, PatternRow> = Object.fromEntries(
  [
    ...learningObjectiveOverlap.flatMap((group) => group.ideas),
    ...scienceInPracticePatterns.flatMap((group) => group.patterns),
    ...misconceptionPatterns,
  ].map((row) => [row.id, row]),
)

const suggestedQuestions = [
  'What evidence in your model best supports the claim that the underground fire keeps burning all winter?',
  'How does your model show the difference between the peat (matter) and the fire (energy)?',
  'Which part of your model could be tested or revised with more information?',
  'How could you explain your model to a classmate who thinks the spring fire is a brand-new fire?',
]

// Alternate sets of facilitation questions the teacher can cycle through
// with "Regenerate Questions." Each set keeps the same length as the
// current questions and stays grounded in the same three class-level
// findings — Learning Objective Overlap, Engagement in Science Practices,
// and Misconceptions — just from a different angle. Stands in for a real
// generation call in this prototype.
const alternateFacilitationQuestionSets: string[][] = [
  [
    'About a third of the class drew the fire only above ground — what would you ask them to reconsider first?',
    'Which group used a specific piece of evidence, rather than a general statement, to explain how the fire persists?',
    'Several students still describe the spring fire as a brand-new fire — how would you have them test that idea against the fire-scar evidence?',
    'What would it take for a classmate to convince you their model is more accurate than yours?',
  ],
  [
    'Your models mostly agree that the fire burns underground in winter — what evidence would make that claim more precise?',
    'Where in your model did you revise something because of new evidence, rather than just to make it look neater?',
    'If the peat is the matter and the fire is the energy, where does each one actually end up?',
    'What question would you ask a group whose model doesn’t distinguish matter from energy at all?',
  ],
  [
    'Which learning objective from today do you think your model addresses least well right now?',
    'What part of your model used the zombie fire images or readings most directly as evidence?',
    'Where might someone confuse “the fire went out” with “the fire is still smoldering underground” in your explanation?',
    'What is one question you’d add to the Driving Question Board if you had five more minutes?',
  ],
]

// Stands in for a real AI call: a canned reply that still reads as grounded
// in the *currently selected* pattern — its label, student count, and a
// couple of the actual student names — so switching patterns visibly
// changes what "Deeper AI Analysis" talks about. When the teacher has
// focused a specific student (via the comment action on their evidence
// card), the reply narrows to that one student's actual words instead of
// generalizing across the pattern.
function mockDeeperAnalysisReply(pattern: PatternRow, question: string, focusedStudent?: StudentEvidence | null): string {
  const lower = question.toLowerCase()

  if (focusedStudent) {
    const excerpt = focusedStudent.response ?? focusedStudent.artifact ?? 'their submission'
    if (lower.includes('differ')) {
      return `${focusedStudent.name}'s work stands out from the rest of “${pattern.label}” mainly in how directly it commits to one idea — “${excerpt}” — rather than hedging between two explanations the way several classmates do.`
    }
    if (lower.includes('investigate')) {
      return `I'd ask ${focusedStudent.name} to walk through “${excerpt}” out loud — that will tell you whether the idea is fully reasoned through or just phrased confidently.`
    }
    if (lower.includes('pattern')) {
      return `${focusedStudent.name}'s response — “${excerpt}” — is a clean example of the pattern behind “${pattern.label},” stated more explicitly than most of the group.`
    }
    return `Looking specifically at ${focusedStudent.name}'s work — “${excerpt}” — that's worth following up on directly with them rather than generalizing to the rest of “${pattern.label}.”`
  }

  const sampleNames = pattern.students.slice(0, 2).map((student) => student.name)
  const namesText = sampleNames.length === 2 ? `${sampleNames[0]} and ${sampleNames[1]}` : sampleNames[0] ?? 'this group'

  if (lower.includes('differ')) {
    return `Within “${pattern.label},” most of the ${pattern.count} students converge on the same core idea, but ${namesText} show the clearest gap in how they justify it — some lean on the data table, others on the model's arrows alone. That's the axis I'd probe first.`
  }
  if (lower.includes('investigate')) {
    return `I'd start with whether the ${pattern.count} students behind “${pattern.label}” can defend their idea with evidence, not just state it — try that with ${namesText} first and see how far the reasoning actually goes.`
  }
  if (lower.includes('pattern')) {
    return `Across the ${pattern.count} students here, the strongest pattern is how closely their language echoes the class reading — ${namesText}, for example, reuse almost the same phrasing, which suggests the idea may be memorized rather than reasoned through yet.`
  }
  return `Based on the ${pattern.count} responses behind “${pattern.label}” — including ${namesText} — that's a good question for a small-group check-in rather than whole-class discussion, since the pattern isn't shared by everyone.`
}

// Shown as an AI-authored line in the conversation itself, right after the
// teacher clicks the comment/"Ask AI" action on one student's evidence card
// — this is the "indication" that Deeper AI Analysis has narrowed its
// context to that one student rather than the whole pattern.
function buildStudentFocusNote(student: StudentEvidence): string {
  const excerpt = student.response ?? student.artifact ?? 'their submission'
  const kind = student.response ? 'response' : 'model'
  return `🔍 Now focusing on ${student.name}'s ${kind}: “${excerpt}” Ask a follow-up and I'll center the answer on this one student.`
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

type LessonSource = 'ai-generated' | 'uploaded'

const lessonSourceLabels: Record<LessonSource, string> = {
  'ai-generated': 'AI Generated',
  uploaded: 'Teacher Uploaded',
}

// There is one lesson, not several parallel versions — driven entirely by
// editor.revisedLesson, which only ever changes in response to the teacher
// explicitly clicking Apply Change in the conversational chat (or an Edit
// Lesson manual edit, which always wins regardless of any AI track). A
// section is highlighted only once the teacher has actually accepted a
// change for it.
//   - generated: an applied/edited section is highlighted; an un-applied
//     one reads as plain original text, and never flags a still-pending
//     suggestion (that's Suggestions-only).
//   - suggestions: the same working lesson as generated, PLUS pending AI
//     suggestions are flagged and clickable here (See AI Suggestions).
// Edit Lesson works from either tab — the tab only changes what's
// highlighted, never whether the lesson can be edited.
type LessonTab = 'generated' | 'suggestions'

const lessonTabLabels: Record<LessonTab, string> = {
  generated: 'Generated',
  suggestions: 'AI Suggestions',
}

// Lesson Overview: Title, Grade Level, and Total Duration (the per-phase
// breakdown lives inline on each 5E phase below — see `duration` on
// lessonSteps — so this one line is the only place total time is stated).
const lessonMeta = [
  'Lesson Title: Zombie Fires: Matter and Energy Flow (Lesson 1)',
  'Grade Level: Grades 9–12',
  'Total Duration: 60 minutes',
]

const lessonPractices = [
  'Obtaining Information',
  'Cause-and-Effect Reasoning',
  'Initial Modeling',
  'Matter and Energy Flow',
  'Asking Questions',
]

// A complete science lesson-plan structure, ordered the way a teacher scans
// a lesson plan: Standards & Learning Objectives, Materials & Equipment, the
// 5E instructional sequence (Engage, Explore, Explain, Elaborate, Evaluate —
// each carrying its own `duration` in minutes, shown inline next to the
// phase name instead of in a separate Pacing section), then Assessment.
// Each entry is one of the "major editable sections" a teacher can edit
// directly (Edit Lesson) or discuss with AI (See AI Suggestions).
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
        text: 'NGSS HS-LS2-3, HS-LS2-4, HS-LS2-5, HS-ESS2-6 — Construct and revise explanations, and develop models, for the cycling of matter and flow of energy between the biosphere and atmosphere.',
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
    displayPrefix: '1.A',
    segments: [
      {
        text: 'Obtain information about zombie fires to identify potential cause-and-effect relationships that lead to changes in the biosphere and atmosphere.',
      },
    ],
  },
  {
    label: 'Learning Objective 2',
    displayPrefix: '1.B',
    segments: [{ text: 'Develop a model to explain how matter (peat) and energy (fire) flow in the zombie fire system.' }],
  },
  {
    label: 'Learning Objective 3',
    displayPrefix: '1.C',
    afterSection: 'practices',
    segments: [
      {
        text: 'Ask questions to clarify how the flow of energy and matter in the atmosphere (CO₂/smoke) and biosphere (peat/permafrost) allows zombie fires to burn, including the role of humans.',
      },
    ],
  },
  {
    label: 'Materials',
    sectionHeading: 'Materials & Equipment',
    listStyle: 'bullet',
    segments: [
      { text: 'Zombie fire photographs and a short video clip (satellite imagery, burn scars, smoke plumes)' },
      { text: 'Student handout: "How are zombie fires burning under ice and releasing so much carbon?"' },
      { text: 'Poster paper or a modeling worksheet for initial models' },
      { text: 'Colored markers' },
      { text: 'Sticky notes for cause-and-effect claims and questions' },
    ],
  },
  {
    label: 'Equipment & Technology',
    listStyle: 'bullet',
    segments: [
      { text: 'Document camera or projector to share zombie fire images and student models' },
      { text: 'Class set of tablets or laptops for groups to research zombie fire images and video', flagged: true },
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
      { text: 'Teacher shows ' },
      { text: 'photographs and a short video clip of zombie fires burning under snow and ice', flagged: true },
      {
        text: ', then poses the driving question students will investigate throughout the lesson: How are zombie fires burning under ice and releasing so much carbon?',
      },
    ],
  },
  {
    label: 'Explore',
    duration: 15,
    segments: [
      { text: 'In small groups, students ' },
      { text: 'obtain information', bold: true, flagged: true },
      {
        text: ' about zombie fires — including satellite images, burn scars, and short readings about when and where they occur — and identify possible ',
      },
      { text: 'cause-and-effect relationships', bold: true },
      {
        text: ' involving changes in the biosphere and atmosphere, such as what seasonal conditions seem to come before a zombie fire appears.',
      },
    ],
  },
  {
    label: 'Explain',
    duration: 10,
    segments: [
      { text: 'Students construct an ' },
      { text: 'initial model', bold: true, flagged: true },
      {
        text: ' of the zombie fire system that may include peat/permafrost, underground fire, snow/ice, smoke/CO₂, and the seasons in which each part is active — representing their current thinking about how matter and energy move through the system, not yet the finished explanation.',
      },
    ],
  },
  {
    label: 'Elaborate',
    duration: 15,
    segments: [
      { text: 'In small groups, students share their initial models and ' },
      { text: 'reason', bold: true },
      {
        text: ' about how matter (peat) and energy (fire) flow through the system and how an underground fire could persist through winter beneath snow and ice. Students then ',
      },
      { text: 'revise their models', bold: true },
      { text: ' to reflect this reasoning and ' },
      { text: 'annotate at least one change explaining why they made it.', flagged: true },
    ],
  },
  {
    label: 'Evaluate',
    duration: 5,
    segments: [
      {
        text: 'Teacher circulates during group work with a short checklist, listening for two things: whether a student distinguishes matter (peat) from energy (fire) in their reasoning, and whether they can explain how the underground fire persists through winter. ',
      },
      {
        text: 'Two or three groups briefly share one part of their model and the reasoning behind it with the whole class before moving on.',
        flagged: true,
      },
    ],
  },
  {
    label: 'Assessment',
    segments: [
      { text: 'Students ' },
      { text: 'ask questions', bold: true },
      {
        text: ' to clarify what they still need to understand about the flow of energy and matter between the atmosphere (CO₂/smoke) and biosphere (peat/permafrost), including the role of humans in zombie fires becoming more common. ',
      },
      { text: 'These questions are collected and added to a class Driving Question Board to guide the lessons that follow.', flagged: true },
      {
        text: ' Look for: at least one question connected to matter or energy flow, and one question about cause and effect (including human influence).',
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
    'This names the crosscutting concept but doesn’t yet say why it matters here. Consider adding a short line connecting it to the specific distinction this lesson hinges on — that peat is the matter that fuels the fire, while the fire itself releases energy — so students see the concept as a lens for their model, not just a label.',
  'Equipment & Technology':
    'Listing tablets or laptops as a requirement could leave the activity inaccessible if your classroom doesn’t have reliable device access. Consider offering a low-tech alternative — printed zombie fire photos and poster paper — as the default, with digital research tools as an optional upgrade rather than a requirement.',
  Engage:
    'Right now, this moves straight from the images to the driving question, so students may treat the model as reproducing what they see rather than investigating a genuine mystery. Consider opening instead by first asking students what they notice and wonder about the images and video, before revealing the driving question — this positions the phenomenon as something to investigate, not simply illustrate.',
  Explore:
    'As written, this could become a quick fact-gathering exercise rather than real cause-and-effect reasoning. Consider having each group record their cause-and-effect claims on sticky notes, so those claims can be tested and revisited once students build and reason through their model.',
  Explain:
    'Consider framing this explicitly as an Initial Model representing students’ current ideas, which they will return to and revise later in the lesson once they’ve reasoned through matter and energy — positioning them as knowledge builders, not just diagram-makers.',
  Elaborate:
    'This already asks students to reason and then revise, which is exactly the progression you want — but the annotation could be more specific. Consider asking students to name whether each revision is about matter, energy, or a cause-and-effect relationship, so the connection to the learning objectives is explicit and easy to assess.',
  Evaluate:
    'This check is a good instinct, but without something specific to listen for, it’s easy to default to checking whether the diagram looks complete rather than whether students distinguish matter from energy. Consider giving yourself a short checklist of exactly two things to listen for as you circulate.',
  Assessment:
    'As written, this lesson ends without resolving the phenomenon — which is appropriate for Lesson 1, but make sure the questions students generate are specific enough to act on. Consider having each group post their top question to a shared Driving Question Board so the class can track which ones get answered as the unit progresses.',
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
      text: ' This lesson asks students to distinguish peat as the matter that fuels the fire from the energy the fire releases as heat, smoke, and CO₂.',
      added: true,
    },
  ],
  'Equipment & Technology': [
    { text: 'Document camera or projector to share zombie fire images and student models' },
    { text: 'Class set of tablets or laptops for groups to research zombie fire images and video' },
    {
      text: 'Printed zombie fire photos and poster paper are a sufficient low-tech alternative to the tablets/laptops above — treat digital research tools as optional, not required.',
      added: true,
    },
  ],
  Engage: [
    { text: 'Teacher shows photographs and a short video clip of zombie fires burning under snow and ice' },
    { text: ', first asking students what they notice and wonder,', added: true },
    {
      text: ' then poses the driving question students will investigate throughout the lesson: How are zombie fires burning under ice and releasing so much carbon?',
    },
  ],
  Explore: [
    { text: 'In small groups, students ' },
    { text: 'obtain information', bold: true },
    {
      text: ' about zombie fires — including satellite images, burn scars, and short readings about when and where they occur — and identify possible ',
    },
    { text: 'cause-and-effect relationships', bold: true },
    {
      text: ' involving changes in the biosphere and atmosphere, such as what seasonal conditions seem to come before a zombie fire appears.',
    },
    {
      text: ' Each group records its cause-and-effect claims on sticky notes to revisit once they build their model.',
      added: true,
    },
  ],
  Explain: [
    { text: 'Students construct an ' },
    { text: 'Initial Model', bold: true, added: true },
    {
      text: ' of the zombie fire system that may include peat/permafrost, underground fire, snow/ice, smoke/CO₂, and the seasons in which each part is active — representing their current thinking about how matter and energy move through the system, not yet the finished explanation.',
    },
  ],
  Elaborate: [
    { text: 'In small groups, students share their initial models and ' },
    { text: 'reason', bold: true },
    {
      text: ' about how matter (peat) and energy (fire) flow through the system and how an underground fire could persist through winter beneath snow and ice. Students then ',
    },
    { text: 'revise their models', bold: true },
    { text: ' to reflect this reasoning' },
    {
      text: ', annotating each change with the sentence starter "I changed ___ because it explains ___ (matter / energy / a cause-and-effect relationship)" so the connection is explicit.',
      added: true,
    },
  ],
  Evaluate: [
    {
      text: 'Teacher circulates during group work with a short checklist, listening for two things: whether a student distinguishes matter (peat) from energy (fire) in their reasoning, and whether they can explain how the underground fire persists through winter. Two or three groups briefly share one part of their model and the reasoning behind it with the whole class before moving on.',
    },
    {
      text: ' This quick check flags who may need support before generating their questions.',
      added: true,
    },
  ],
  Assessment: [
    { text: 'Students ' },
    {
      text: 'exchange their initial model with a partner for a quick round of feedback, then ',
      added: true,
    },
    { text: 'ask questions', bold: true },
    {
      text: ' to clarify what they still need to understand about the flow of energy and matter between the atmosphere (CO₂/smoke) and biosphere (peat/permafrost), including the role of humans in zombie fires becoming more common. These questions are collected and added to a class Driving Question Board to guide the lessons that follow.',
    },
    {
      text: ' Each group posts its top question to the board so the class can track which ones get answered as the unit progresses.',
      added: true,
    },
    {
      text: ' Look for: at least one question connected to matter or energy flow, and one question about cause and effect (including human influence).',
    },
  ],
}

const lessonRevisions: Record<string, string> = Object.fromEntries(
  Object.entries(lessonRevisionSegments).map(([label, segments]) => [label, segmentsToText(segments)]),
)

const chatSuggestionSummary: Record<string, string> = {
  'Crosscutting Concept':
    'connecting the crosscutting concept explicitly to the peat-as-matter vs. fire-as-energy distinction this lesson hinges on',
  'Equipment & Technology':
    'offering printed zombie fire photos and poster paper as the default instead of requiring tablets or laptops',
  Engage:
    'opening with what students notice and wonder about the images and video, before revealing the driving question',
  Explore: 'having groups record their cause-and-effect claims on sticky notes to revisit once they build their model',
  Explain: 'framing this as an Initial Model students will revisit later, once they’ve reasoned through matter and energy',
  Elaborate: 'asking students to name whether each revision is about matter, energy, or a cause-and-effect relationship',
  Evaluate: 'giving yourself a short two-item checklist — matter vs. energy, and how the fire persists — to listen for while circulating',
  Assessment: 'adding a peer round of feedback on the initial model before students generate and post their questions to a Driving Question Board',
}

const stepWorkflow: Record<string, { teacherFollowUp: string; aiProposal: string }> = {
  'Crosscutting Concept': {
    teacherFollowUp: 'Can you connect this to why matter and energy behave differently in this lesson?',
    aiProposal:
      'Add a line noting that this lesson asks students to distinguish peat, the matter that fuels the fire, from the energy the fire releases as heat, smoke, and CO₂ — that’s the core idea the crosscutting concept is pointing at here.',
  },
  'Equipment & Technology': {
    teacherFollowUp: "I don't have access to this equipment.",
    aiProposal:
      'No problem — printed zombie fire photos, poster paper, and markers are enough to run the full activity. Skip the digital research tools entirely; a document camera, or just holding models up to the class, works fine for sharing.',
  },
  Engage: {
    teacherFollowUp: "I like that, but I want students to really investigate, not just watch. How do I make that happen?",
    aiProposal:
      'Before revealing the driving question, ask students to turn and talk about what they notice and wonder from the images and video — that gives them ownership of the mystery before you name it.',
  },
  Explore: {
    teacherFollowUp: 'Some groups jump straight to conclusions without real evidence — can I slow that down?',
    aiProposal:
      'Yes — have each group write their cause-and-effect claims on sticky notes, one claim per note, before moving on. That makes their thinking visible and easy to revisit once they build their model.',
  },
  Explain: {
    teacherFollowUp: "That's a good idea, but I don't want it to feel like a worksheet. Can it stay lightweight?",
    aiProposal:
      'We can keep it simple — students just need three labeled boxes (peat/permafrost, underground fire, atmosphere) and arrows showing what they think moves between them. It doesn’t need to be polished yet.',
  },
  Elaborate: {
    teacherFollowUp: 'How can I make sure the annotation actually connects to matter or energy, not just describe what changed?',
    aiProposal:
      'Have students finish the sentence "I changed ___ because it explains ___" and require them to name whether that blank is about matter, energy, or a cause-and-effect relationship — that structure forces the connection.',
  },
  Evaluate: {
    teacherFollowUp: 'I like that, but I only have about 5 minutes for this. What should I actually listen for?',
    aiProposal:
      'Listen for two things: whether a student can say which part of their model is matter and which is energy, and whether they can explain how the fire keeps burning underground through winter. That’s enough to flag who needs support before they generate their questions.',
  },
  Assessment: {
    teacherFollowUp: 'Make sure this ends with real, usable questions instead of vague ones.',
    aiProposal:
      'Have each group narrow to their single best question and post it to a class Driving Question Board — framing it as "what we still need to figure out" keeps it open rather than asking students to restate what they already know.',
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

// Stands in for a real AI call when the teacher types a follow-up into the
// revision chat (e.g. "Can you make this more focused on matter and energy
// flow?"). The default behavior is to translate the teacher's stated intent
// straight into a concrete revision — a statement, not another question —
// so the interaction reads as a lesson-revision assistant rather than a
// tutoring back-and-forth. A clarifying question is the exception, reserved
// for input too thin to act on (see isTooVagueToActOn below), not the norm.
// The returned proposal always replaces whatever Preview/Apply Change would
// act on next, so a follow-up never silently changes the lesson itself —
// the teacher must still explicitly Preview and/or Apply the new version.
function isTooVagueToActOn(trimmedQuestion: string): boolean {
  const lower = trimmedQuestion.toLowerCase().replace(/[.!?]+$/, '')
  const wordCount = trimmedQuestion.split(/\s+/).filter(Boolean).length
  const fillerPhrases = ['ok', 'okay', 'sure', 'yes', 'no', 'maybe', 'idk', 'hmm', 'help', 'i dont know', "i don't know"]
  return wordCount <= 2 && fillerPhrases.includes(lower)
}

function mockRevisionFollowUpReply(
  label: string,
  question: string,
  currentProposal: string,
): { reply: string; newProposal: string } {
  const trimmed = question.trim()
  const lower = trimmed.toLowerCase()
  const base = currentProposal || `a revision to ${label}`

  // Genuinely too ambiguous to turn into a revision — ask one clarifying
  // question instead of fabricating a change from nothing. This is the
  // exception, not the default: everything below this responds with a
  // concrete proposal.
  if (isTooVagueToActOn(trimmed)) {
    return {
      reply: `Can you say a bit more about what you'd like to change about ${label} — the wording, the activity itself, or how students work through it?`,
      newProposal: currentProposal,
    }
  }

  if (lower.includes('matter') && lower.includes('energy')) {
    return {
      reply:
        'Good catch — here’s a version that’s more explicit about matter and energy. I added a line asking students to label which part of their revision is about matter (peat) moving and which is about energy (heat) being transferred, so that distinction can’t get lost in the wording alone. Preview it below, or keep refining.',
      newProposal: `${base} Label each addition as either matter (what moves) or energy (what transfers), so the distinction is explicit in the model itself, not just implied by the wording.`,
    }
  }

  if (lower.includes('student') && (lower.includes('led') || lower.includes('choice') || lower.includes('ownership'))) {
    return {
      reply:
        'Updated to put more of the decision in students’ hands: instead of you naming the focus upfront, groups decide for themselves what to investigate first, with your original framing available only if a group gets stuck.',
      newProposal: `${base} Let students decide as a group what to investigate first, rather than the teacher naming it — offer your original framing only if a group needs a nudge.`,
    }
  }

  if (lower.includes('open') && lower.includes('end')) {
    return {
      reply:
        'Here’s a more open-ended version — instead of specifying exactly what to add, it asks students to decide for themselves what the new evidence changes about their thinking, which leaves more room for their own reasoning to show through.',
      newProposal: `${base} Rather than specifying exactly what to add, ask students to decide for themselves what the new evidence changes about their thinking, and to explain why.`,
    }
  }

  if (lower.includes('short') || lower.includes('concise') || lower.includes('brief')) {
    const firstSentence = base.split(/(?<=[.?!])\s+/)[0]
    return {
      reply: 'Here’s a shorter version that keeps just the core instructional move.',
      newProposal: firstSentence,
    }
  }

  if (lower.includes('evidence')) {
    return {
      reply:
        'I tied the revision more directly to evidence — students now have to point to something specific from the zombie fire images or readings, not just describe their model in general terms.',
      newProposal: `${base} Ask students to point to one specific piece of evidence from the zombie fire images or readings that led to this change.`,
    }
  }

  return {
    reply: `Here’s an updated version of the “${label}” revision that reflects that. Preview it below, or keep refining.`,
    newProposal: `${base} This revision also reflects: “${trimmed}.”`,
  }
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

      if (!container.contains(anchorNode) || anchorElement?.closest('.suggestion-popover')) {
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
        See AI Suggestions
      </button>
    </div>
  )
}

type EditStage = 'chatting' | 'applied'

// One section's revision conversation: its chat history, its current stage,
// and the concrete proposal text that Apply Change acts on. `proposalSegments`
// carries the rich (bold/added) formatting for the canned first proposal
// (see lessonRevisionSegments) so the proposed-change card can highlight
// exactly what's new; once the teacher asks a follow-up, the new proposal is
// a plain string and this is cleared.
type SectionRevisionState = {
  stage: EditStage
  messages: ChatMessage[]
  proposal: string
  proposalSegments?: readonly LessonSegment[]
}

// Drives the whole "See AI Suggestions / Apply Change" workflow for every
// lesson section, in one place, regardless of whether a section's
// suggestion came from a pre-flagged AI Suggestion or a manual text-
// selection. There is exactly one lesson (no separate Original / AI
// Suggestions / AI Revised versions) — `revisedLesson` is the only place a
// section's permanent text changes, and only in response to an explicit
// Apply Change. As soon as the AI has a concrete proposal it's shown in
// full in the proposed-change card — there's no separate "preview" step to
// trigger first; Apply Change is available immediately.
// `onApply` lets the lesson's manual-edit state (lifted to App) react to an
// Apply Change, so an applied AI revision becomes the section's ordinary
// current text — see its definition in App.
function useRevisionWorkflow(onApply?: (label: string, text: string) => void) {
  const [activeLabel, setActiveLabel] = useState<string | null>(null)
  const [statesByLabel, setStatesByLabel] = useState<Record<string, SectionRevisionState>>({})
  const [revisedLesson, setRevisedLesson] = useState<Record<string, string>>({})
  // Rich (bold/added) segments for an APPLIED section on the working lesson
  // (Generated/Suggestions), kept separately from revisedLesson's flat text
  // so only the part AI actually contributed gets the yellow highlight —
  // never the section's original wording. Present only when we can be
  // confident which part is new (see apply() below); otherwise the plain
  // flat text falls back to a whole-section highlight.
  const [revisedLessonSegments, setRevisedLessonSegments] = useState<Record<string, readonly LessonSegment[] | undefined>>({})
  const [isThinking, setIsThinking] = useState(false)
  const thinkingTimeoutRef = useRef<number | null>(null)
  // Briefly marks whichever section was just applied, so the lesson plan
  // can flash a short success highlight there before it fades — see
  // .section-just-applied.
  const [justAppliedLabel, setJustAppliedLabel] = useState<string | null>(null)
  const justAppliedTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (thinkingTimeoutRef.current !== null) window.clearTimeout(thinkingTimeoutRef.current)
      if (justAppliedTimeoutRef.current !== null) window.clearTimeout(justAppliedTimeoutRef.current)
    }
  }, [])

  // Opens (or restarts) a section's conversation and switches the left
  // workspace to it — via a flagged AI suggestion ("See AI Suggestions") or a
  // freeform text selection. `proposal` seeds the proposed-change card;
  // freeform selections have none, so they get a conversation with no
  // apply step until one exists.
  const ask = (label: string, messages: ChatMessage[], proposal?: string, proposalSegments?: readonly LessonSegment[]) => {
    setStatesByLabel((prev) => ({
      ...prev,
      [label]: { stage: 'chatting', messages, proposal: proposal ?? '', proposalSegments },
    }))
    setActiveLabel(label)
  }

  const closeChat = () => setActiveLabel(null)

  const reopen = (label: string) => setActiveLabel(label)

  // `editedText` is the teacher's own edit of the proposed change (via the
  // card's Edit button), when they made one — whatever they applied becomes
  // the section's text, and the conversation's proposal from then on.
  const apply = (label: string, editedText?: string) => {
    // Reads the current section's state from the hook's own closure rather
    // than a setState updater's `prev` — deliberately. Nesting one setState
    // call inside another updater looks convenient, but under React 18
    // StrictMode that outer updater gets invoked twice, so the nested call
    // fires twice too; for a non-idempotent computation like "extend these
    // segments by a suffix" that double-fire corrupts the result (the
    // second pass ends up diffing the already-extended array against
    // itself). Reading `state` here and issuing every setState call
    // independently — each a pure function of its own prior value — avoids
    // that entirely.
    const current = statesByLabel[label]
    if (!current) return
    // A teacher-edited proposal no longer matches the canned segment
    // boundaries or the follow-up "previous text + suffix" shape, so it
    // drops its segments and takes the whole-section highlight fallback.
    const teacherEdited = editedText !== undefined && editedText !== current.proposal
    const state: SectionRevisionState = teacherEdited
      ? { ...current, proposal: editedText, proposalSegments: undefined }
      : current

    setRevisedLesson((revised) => ({ ...revised, [label]: state.proposal }))

    setRevisedLessonSegments((prevSegments) => {
      if (teacherEdited) return { ...prevSegments, [label]: undefined }
      if (state.proposalSegments) {
        // Applying the canned first proposal — its added/plain segment
        // boundaries are already exact (see lessonRevisionSegments), so
        // use them directly rather than trying to re-derive them.
        return { ...prevSegments, [label]: state.proposalSegments }
      }
      // A follow-up round: mockRevisionFollowUpReply always builds its new
      // proposal as `${previous proposal text} <new text>`, so the text
      // that was already applied (whatever its own added/plain makeup was)
      // is still a literal prefix of this one — extend those existing
      // segments with just the new suffix, rather than losing earlier
      // rounds' highlighting or re-highlighting the whole thing.
      const previousSegments = prevSegments[label]
      const previousText = previousSegments ? segmentsToText(previousSegments) : undefined
      if (previousText !== undefined && state.proposal.startsWith(previousText) && state.proposal.length > previousText.length) {
        return {
          ...prevSegments,
          [label]: [...previousSegments!, { text: state.proposal.slice(previousText.length), added: true }],
        }
      }
      // No usable prior segments to extend (first-ever apply for this
      // section came from a follow-up, not the canned proposal; or the new
      // text isn't a simple extension of the old) — we genuinely can't tell
      // which part is new, so fall back to highlighting the whole thing.
      return { ...prevSegments, [label]: undefined }
    })

    setStatesByLabel((prev) =>
      prev[label]
        ? {
            ...prev,
            [label]: {
              ...prev[label],
              stage: 'applied',
              proposal: state.proposal,
              proposalSegments: state.proposalSegments,
            },
          }
        : prev,
    )

    onApply?.(label, state.proposal)

    setJustAppliedLabel(label)
    if (justAppliedTimeoutRef.current !== null) window.clearTimeout(justAppliedTimeoutRef.current)
    justAppliedTimeoutRef.current = window.setTimeout(() => setJustAppliedLabel(null), 1200)
  }

  // A follow-up typed into the left chat: push the teacher's message, wait
  // briefly (mirrors the "AI is thinking…" pattern used elsewhere in the
  // app), then push a reply. When the reply carries an actual new proposal,
  // stage resets to 'chatting' even if the section was already applied, so
  // the teacher must explicitly Apply the new proposal too — a follow-up
  // never silently overwrites an already-applied section. When the
  // teacher's message was too vague to act on, the mock reply's proposal
  // comes back unchanged (see isTooVagueToActOn) and this leaves
  // stage/proposalSegments untouched rather than discarding a perfectly
  // good pending or already-applied proposal just because the teacher asked
  // a clarifying follow-up.
  const sendFollowUp = (label: string, question: string) => {
    setStatesByLabel((prev) => {
      const state = prev[label]
      if (!state) return prev
      return { ...prev, [label]: { ...state, messages: [...state.messages, { role: 'teacher', text: question }] } }
    })
    setIsThinking(true)
    if (thinkingTimeoutRef.current !== null) window.clearTimeout(thinkingTimeoutRef.current)
    thinkingTimeoutRef.current = window.setTimeout(() => {
      setStatesByLabel((prev) => {
        const state = prev[label]
        if (!state) return prev
        const { reply, newProposal } = mockRevisionFollowUpReply(label, question, state.proposal)
        const proposalChanged = newProposal !== state.proposal
        return {
          ...prev,
          [label]: {
            stage: proposalChanged ? 'chatting' : state.stage,
            messages: [...state.messages, { role: 'ai', text: reply }],
            proposal: newProposal,
            proposalSegments: proposalChanged ? undefined : state.proposalSegments,
          },
        }
      })
      setIsThinking(false)
    }, 700)
  }

  return {
    activeLabel,
    statesByLabel,
    revisedLesson,
    revisedLessonSegments,
    isThinking,
    justAppliedLabel,
    ask,
    closeChat,
    reopen,
    apply,
    sendFollowUp,
  }
}

type RevisionWorkflow = ReturnType<typeof useRevisionWorkflow>

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

// Renders in the LEFT workspace (Form / AI Chat panel), not inline in the
// lesson content — the right side stays the lesson plan itself. One panel
// covers the whole "See AI Suggestions → Apply Change" workflow for
// whichever section is currently active.
function RevisionChatPanel({
  label,
  state,
  isThinking,
  draft,
  onDraftChange,
  onSend,
  onApply,
  onClose,
}: {
  label: string
  state: SectionRevisionState
  isThinking: boolean
  draft: string
  onDraftChange: (value: string) => void
  onSend: () => void
  onApply: (editedText?: string) => void
  onClose: () => void
}) {
  const hasProposal = Boolean(state.proposal)
  // The teacher's working copy of the proposal while its Edit mode is open
  // (null = showing the AI's proposal as-is). Dropped whenever the section
  // or the proposal itself changes, so a stale edit never gets applied to
  // a different proposal.
  const [proposalDraft, setProposalDraft] = useState<string | null>(null)
  const isEditingProposal = proposalDraft !== null

  useEffect(() => {
    setProposalDraft(null)
  }, [label, state.proposal])

  return (
    <div className="revision-chat-panel">
      <div className="revision-chat-header">
        <div>
          <p className="card-label">Discussing this section</p>
          <h4>{label}</h4>
        </div>
        <button type="button" className="drawer-close" aria-label="Close conversation" onClick={onClose}>
          ×
        </button>
      </div>

      <ChatThread messages={state.messages} className="revision-chat-thread" />
      {isThinking && <p className="empty-state-support">AI is thinking…</p>}

      {/* The card itself IS the preview — the full proposed content is
          shown here the moment the AI has one, with no separate "Preview
          Change" step. The teacher can keep chatting to refine it (a
          follow-up replaces this card's content), click Edit to reword
          the draft themselves, or click Apply to Lesson whenever they're
          satisfied — which applies whatever the card currently says,
          including the teacher's own edits. */}
      {state.stage === 'chatting' && hasProposal && (
        <div className="inline-ai-preview">
          <p className="card-label">Proposed change — not yet applied</p>
          {isEditingProposal ? (
            <textarea
              aria-label="Edit proposed change"
              rows={4}
              value={proposalDraft}
              onChange={(event) => setProposalDraft(event.target.value)}
              autoFocus
            />
          ) : (
            <p>{state.proposalSegments ? <LessonRichText segments={state.proposalSegments} /> : state.proposal}</p>
          )}
          <div className="revision-actions">
            {isEditingProposal ? (
              <button type="button" className="proposal-edit-button" onClick={() => setProposalDraft(null)}>
                Cancel
              </button>
            ) : (
              <button
                type="button"
                className="proposal-edit-button"
                onClick={() => setProposalDraft(state.proposal)}
                disabled={isThinking}
              >
                Edit
              </button>
            )}
            <button
              type="button"
              className="accept-button"
              onClick={() => onApply(proposalDraft ?? undefined)}
              disabled={isThinking || (isEditingProposal && !proposalDraft.trim())}
            >
              Apply to Lesson
            </button>
          </div>
        </div>
      )}

      {state.stage === 'applied' && <p className="inline-ai-applied-note">✓ Applied to Lesson</p>}

      {/* Sending pauses while the proposal is being edited — a follow-up
          reply would replace the proposal and discard the teacher's edit.
          The conversation itself stays visible above. */}
      <div className="composer-box">
        <input
          type="text"
          placeholder={isEditingProposal ? 'Apply or cancel your edit to keep chatting...' : 'Ask about this section...'}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !isEditingProposal) onSend()
          }}
          disabled={isThinking || isEditingProposal}
        />
        <button
          type="button"
          className="primary-button"
          onClick={onSend}
          disabled={isThinking || isEditingProposal || !draft.trim()}
        >
          Send
        </button>
      </div>
    </div>
  )
}

function App() {
  const [activePage, setActivePage] = useState<PageId>('lesson-generator')
  const [navOpen, setNavOpen] = useState(false)

  // Lifted out of the lesson workspace canvas so accepted revisions,
  // conversation history, and manual edits survive navigating to another
  // page (Class/Student Feedback) and back to Lesson Planning. `planningTab`
  // is lifted too (rather than living inside LessonPlanningPanel) so that
  // clicking "See AI Suggestions" on the right can reliably switch the
  // left panel over to its AI Chat tab.
  const [planningTab, setPlanningTab] = useState<PlanningTab>('form')
  const [lessonTab, setLessonTab] = useState<LessonTab>('generated')
  const [openSuggestion, setOpenSuggestion] = useState<string | null>(null)
  const [isEditingLesson, setIsEditingLesson] = useState(false)
  const [manualEdits, setManualEdits] = useState<Record<string, string>>({})
  const [draftBySection, setDraftBySection] = useState<Record<string, string>>({})
  const [editBaseline, setEditBaseline] = useState<Record<string, string>>({})
  // An applied AI revision is the section's newest wording, so it replaces
  // any earlier manual edit (which would otherwise keep winning for display
  // and make Edit Lesson reopen the pre-AI text) and flows straight into the
  // edit drafts — including mid-edit, when the teacher applied from the chat
  // while Edit Lesson was open. The baseline moves with it so saving without
  // further changes doesn't record the AI text as a manual edit. From here
  // on it's ordinary lesson content the teacher can edit like any other.
  const revisionEditor = useRevisionWorkflow((label, text) => {
    setManualEdits((prev) => {
      if (!(label in prev)) return prev
      const next = { ...prev }
      delete next[label]
      return next
    })
    setDraftBySection((prev) => ({ ...prev, [label]: text }))
    setEditBaseline((prev) => ({ ...prev, [label]: text }))
  })

  // Generate Lesson no longer navigates away from the Lesson Planning page —
  // it reveals the generated lesson in the workspace panel on the right,
  // in place, so the form and any AI Chat conversation on the left stay
  // exactly as the teacher left them. This state is lifted to App so a
  // generated lesson survives navigating to another page and back.
  const [lessonGenerated, setLessonGenerated] = useState(false)
  const [isGeneratingLesson, setIsGeneratingLesson] = useState(false)
  const generateLessonTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (generateLessonTimeoutRef.current !== null) window.clearTimeout(generateLessonTimeoutRef.current)
    }
  }, [])

  const handleGenerateLessonPlan = () => {
    if (isGeneratingLesson) return
    setIsGeneratingLesson(true)
    generateLessonTimeoutRef.current = window.setTimeout(() => {
      setLessonGenerated(true)
      setIsGeneratingLesson(false)
    }, 900)
  }

  const canvasProps: LessonWorkspaceCanvasProps = {
    editor: revisionEditor,
    setPlanningTab,
    lessonTab,
    setLessonTab,
    openSuggestion,
    setOpenSuggestion,
    isEditing: isEditingLesson,
    setIsEditing: setIsEditingLesson,
    manualEdits,
    setManualEdits,
    draftBySection,
    setDraftBySection,
    editBaseline,
    setEditBaseline,
  }

  const planningPanelProps = { planningTab, setPlanningTab, revisionEditor }

  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    // Old links to the retired standalone Lesson Workspace page land on
    // Lesson Planning, where that workspace now lives.
    if (hash === 'lesson-workspace') {
      setActivePage('lesson-generator')
    } else if (hash && PAGE_CONFIG.some((page) => page.id === hash)) {
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
          <div className="brand-text">
            {/* The PARTNERS wordmark is a single dark blue (see .brand-name
                in App.css); the subtitle below keeps its per-letter-group
                accent colors (brand-color-* classes). */}
            <span className="brand-name">PARTNERS</span>
            <span className="brand-subtitle">
              <span>
                <span className="brand-subtitle-highlight brand-color-blue">P</span>romoting an{' '}
                <span className="brand-subtitle-highlight brand-color-blue">A</span>rtificial Intelligence-
                <span className="brand-subtitle-highlight brand-color-blue">R</span>esearcher-
                <span className="brand-subtitle-highlight brand-color-green">T</span>eacher{' '}
                <span className="brand-subtitle-highlight brand-color-green">N</span>etwork
              </span>
              <span>
                to <span className="brand-subtitle-highlight brand-color-purple">E</span>nhance P
                <span className="brand-subtitle-highlight brand-color-purple">r</span>actices in{' '}
                <span className="brand-subtitle-highlight brand-color-orange">S</span>cience
              </span>
            </span>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="page-heading">
          <p className="eyebrow">Workspace</p>
          <h2>{currentPage.label}</h2>
        </div>

        {activePage === 'lesson-generator' && (
          <LessonPlanningPage
            onGenerateLessonPlan={handleGenerateLessonPlan}
            lessonGenerated={lessonGenerated}
            isGeneratingLesson={isGeneratingLesson}
            canvasProps={canvasProps}
            planningPanelProps={planningPanelProps}
          />
        )}
        {activePage === 'student-feedback' && <StudentFeedbackPage />}
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
  planningTab,
  setPlanningTab,
  revisionEditor,
  chatTitle,
  chatBadge,
  chatMessages,
  onGenerate,
}: {
  planningTab: PlanningTab
  setPlanningTab: (tab: PlanningTab) => void
  revisionEditor: RevisionWorkflow
  chatTitle: string
  chatBadge: string
  chatMessages: readonly ChatMessage[]
  onGenerate?: () => void
}) {
  // Draft text for whichever lesson-section revision conversation is
  // currently active (see revisionEditor.activeLabel) — cleared whenever the
  // teacher switches to a different section's conversation.
  const [revisionDraft, setRevisionDraft] = useState('')
  useEffect(() => {
    setRevisionDraft('')
  }, [revisionEditor.activeLabel])

  // The Lesson Preferences form starts completely blank — a new teacher's
  // first view of this page must look like an empty form, not one already
  // filled in with the prototype's example (Zombie Fires) lesson. That
  // example only ever appears as the GENERATED output once the teacher
  // clicks Generate Lesson (see lessonSteps and friends below), never as
  // pre-filled input here.
  const [selectedPractices, setSelectedPractices] = useState<string[]>([])
  // Every field below is lifted above the Form/AI Chat toggle so a
  // teacher's entries survive switching tabs and back, and survive
  // clicking Generate Lesson (which no longer unmounts this panel at all).
  const [topic, setTopic] = useState('')
  const [learningObjectives, setLearningObjectives] = useState('')
  const [priorInstruction, setPriorInstruction] = useState('')
  const [materialsAndEquipment, setMaterialsAndEquipment] = useState('')
  const [assessmentPreferences, setAssessmentPreferences] = useState('')

  // The form's own Grade level selector doubles as the Standards filter —
  // teachers aren't asked to pick a grade a second time. Its options are
  // narrower bands than NGSS uses, so each maps to the NGSS band it falls
  // within.
  const [gradeLevel, setGradeLevel] = useState('')
  const selectedNgssBand = gradeLevelToNgssBand[gradeLevel]

  // Standards search: a teacher can type a keyword — without needing to
  // already know a standard's code — and pick any number of matching
  // standards (automatically scoped to the selected grade level), which
  // then show as removable chips.
  const [standardsQuery, setStandardsQuery] = useState('')
  const [selectedStandardCodes, setSelectedStandardCodes] = useState<string[]>([])

  const togglePractice = (practiceId: string) => {
    setSelectedPractices((prev) =>
      prev.includes(practiceId) ? prev.filter((item) => item !== practiceId) : [...prev, practiceId],
    )
  }

  const showStandardsSuggestions = Boolean(selectedNgssBand) && Boolean(standardsQuery.trim())
  const suggestedStandards = selectedNgssBand
    ? ngssStandardsBank
        .filter((standard) => !selectedStandardCodes.includes(standard.code))
        .filter((standard) => standard.gradeBand === selectedNgssBand)
        .filter((standard) => matchesStandardsQuery(standard, standardsQuery.trim()))
        .slice(0, 6)
    : []

  const addStandard = (code: string) => {
    setSelectedStandardCodes((prev) => (prev.includes(code) ? prev : [...prev, code]))
  }

  const removeStandard = (code: string) => {
    setSelectedStandardCodes((prev) => prev.filter((item) => item !== code))
  }

  const [pacingSelection, setPacingSelection] = useState('')
  const [customPacingMinutes, setCustomPacingMinutes] = useState('')

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
              <select value={gradeLevel} onChange={(event) => setGradeLevel(event.target.value)}>
                <option value="" disabled>
                  Select grade level
                </option>
                <option value="6-8">Grades 6–8</option>
                <option value="9-12">Grades 9–12</option>
              </select>
            </label>

            <label>
              <span>Topic</span>
              <input
                type="text"
                placeholder="Ecosystems, forces, photosynthesis..."
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
              />
            </label>

            <div className="standards-field">
              <span>Standards</span>
              <input
                type="text"
                placeholder="Search by topic, concept, or standard code"
                value={standardsQuery}
                onChange={(event) => setStandardsQuery(event.target.value)}
              />

              {!selectedNgssBand ? (
                <p className="standards-empty">Select a grade level above to see suggested standards.</p>
              ) : (
                showStandardsSuggestions && (
                  <div className="standards-suggestions">
                    {suggestedStandards.length > 0 ? (
                      suggestedStandards.map((standard) => (
                        <button
                          type="button"
                          key={standard.code}
                          className="standard-suggestion"
                          onClick={() => addStandard(standard.code)}
                        >
                          <span className="standard-suggestion-code">{standard.code}</span>
                          <span className="standard-suggestion-description">{standard.description}</span>
                        </button>
                      ))
                    ) : (
                      <p className="standards-empty">No matching standards found. Try a different keyword.</p>
                    )}
                  </div>
                )
              )}

              {selectedStandardCodes.length > 0 && (
                <div className="selected-standards-row">
                  {selectedStandardCodes.map((code) => {
                    const standard = ngssStandardsBank.find((item) => item.code === code)
                    if (!standard) return null
                    return (
                      <span key={code} className="tag selected-standard-chip">
                        {standard.code}
                        <button
                          type="button"
                          className="chip-remove"
                          aria-label={`Remove ${standard.code}`}
                          onClick={() => removeStandard(code)}
                        >
                          ×
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}
            </div>

            <label>
              <span>Learning objectives</span>
              <textarea
                rows={4}
                placeholder="Describe the target learning outcomes..."
                value={learningObjectives}
                onChange={(event) => setLearningObjectives(event.target.value)}
              />
            </label>

            <label>
              <span>Prior Instruction</span>
              <textarea
                rows={4}
                placeholder="Short description of what students have learned…"
                value={priorInstruction}
                onChange={(event) => setPriorInstruction(event.target.value)}
              />
            </label>

            <label>
              <span>Materials &amp; equipment</span>
              <textarea
                rows={2}
                placeholder="Materials, equipment, technology, lab/safety needs..."
                value={materialsAndEquipment}
                onChange={(event) => setMaterialsAndEquipment(event.target.value)}
              />
            </label>

            <label>
              <span>Assessment preferences</span>
              <input
                type="text"
                placeholder="Formative check, summative task, both..."
                value={assessmentPreferences}
                onChange={(event) => setAssessmentPreferences(event.target.value)}
              />
            </label>

            <div className="practice-field">
              <span>Pacing / Duration</span>
              <div className="practice-chip-row pacing-chip-row">
                {pacingOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`practice-chip pacing-chip ${pacingSelection === option.id ? 'selected' : ''}`}
                    aria-pressed={pacingSelection === option.id}
                    onClick={() => setPacingSelection(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {pacingSelection === 'custom' && (
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  className="pacing-custom-input"
                  placeholder="Minutes"
                  aria-label="Custom duration in minutes"
                  value={customPacingMinutes}
                  onChange={(event) => setCustomPacingMinutes(event.target.value)}
                />
              )}
            </div>

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
          {revisionEditor.activeLabel && revisionEditor.statesByLabel[revisionEditor.activeLabel] ? (
            <RevisionChatPanel
              label={revisionEditor.activeLabel}
              state={revisionEditor.statesByLabel[revisionEditor.activeLabel]}
              isThinking={revisionEditor.isThinking}
              draft={revisionDraft}
              onDraftChange={setRevisionDraft}
              onSend={() => {
                const label = revisionEditor.activeLabel
                if (!label || !revisionDraft.trim()) return
                revisionEditor.sendFollowUp(label, revisionDraft.trim())
                setRevisionDraft('')
              }}
              onApply={(editedText) =>
                revisionEditor.activeLabel && revisionEditor.apply(revisionEditor.activeLabel, editedText)
              }
              onClose={() => revisionEditor.closeChat()}
            />
          ) : (
            <>
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
            </>
          )}
        </div>
      )}
    </aside>
  )
}

// Shown in place of the generated lesson on Lesson Planning whenever
// Generate Lesson hasn't actually been clicked yet — the page must never
// show lesson content the teacher didn't ask for. `isGenerating`
// swaps in a brief, lightweight "in progress" message (mirroring the same
// plain-text convention "Regenerate Questions" uses on the dashboard)
// between the click and the content actually appearing.
function LessonWorkspacePlaceholder({ isGenerating }: { isGenerating: boolean }) {
  return (
    <section className="workspace-placeholder lesson-workspace-panel">
      <div className="canvas-header">
        <div>
          <p className="card-label">Lesson workspace</p>
          <h3>Lesson plan</h3>
        </div>
      </div>

      {isGenerating ? (
        <div className="empty-state">
          <p className="card-label">Generating lesson</p>
          <h3>Building your aligned lesson plan…</h3>
          <p className="empty-state-support">This will just take a moment.</p>
        </div>
      ) : (
        <div className="empty-state">
          <p className="card-label">Ready for lesson output</p>
          <h3>Your generated lesson will appear here</h3>
          <p className="empty-state-support">
            Complete your lesson preferences and click Generate Lesson to create an aligned lesson plan.
          </p>
        </div>
      )}
    </section>
  )
}

// Lifted to App so "See AI Suggestions" can switch the LessonPlanningPanel
// over to its AI Chat tab, scoped to the section the teacher just clicked.
type PlanningPanelProps = {
  planningTab: PlanningTab
  setPlanningTab: (tab: PlanningTab) => void
  revisionEditor: RevisionWorkflow
}

function LessonPlanningPage({
  onGenerateLessonPlan,
  lessonGenerated,
  isGeneratingLesson,
  canvasProps,
  planningPanelProps,
}: {
  onGenerateLessonPlan: () => void
  lessonGenerated: boolean
  isGeneratingLesson: boolean
  canvasProps: LessonWorkspaceCanvasProps
  planningPanelProps: PlanningPanelProps
}) {
  return (
    <div className="planning-layout">
      <LessonPlanningPanel
        {...planningPanelProps}
        chatTitle="AI Planning Assistant"
        chatBadge="Collaborative"
        chatMessages={planningConversation}
        onGenerate={onGenerateLessonPlan}
      />

      {lessonGenerated ? (
        <LessonWorkspaceCanvas {...canvasProps} />
      ) : (
        <LessonWorkspacePlaceholder isGenerating={isGeneratingLesson} />
      )}
    </div>
  )
}

type LessonWorkspaceCanvasProps = {
  editor: RevisionWorkflow
  setPlanningTab: (tab: PlanningTab) => void
  lessonTab: LessonTab
  setLessonTab: (tab: LessonTab) => void
  openSuggestion: string | null
  setOpenSuggestion: (key: string | null) => void
  isEditing: boolean
  setIsEditing: Dispatch<SetStateAction<boolean>>
  manualEdits: Record<string, string>
  setManualEdits: Dispatch<SetStateAction<Record<string, string>>>
  draftBySection: Record<string, string>
  setDraftBySection: Dispatch<SetStateAction<Record<string, string>>>
  editBaseline: Record<string, string>
  setEditBaseline: Dispatch<SetStateAction<Record<string, string>>>
}

// The generated lesson itself — tabs, sections, Edit Lesson, and the
// contextual AI interactions. Mounted on the Lesson Planning page right
// after Generate Lesson; its state is all lifted up to App via props, so
// navigating to another page and back never loses a revision,
// conversation, or manual edit.
function LessonWorkspaceCanvas({
  editor,
  setPlanningTab,
  lessonTab,
  setLessonTab,
  openSuggestion,
  setOpenSuggestion,
  isEditing,
  setIsEditing,
  manualEdits,
  setManualEdits,
  draftBySection,
  setDraftBySection,
  editBaseline,
  setEditBaseline,
}: LessonWorkspaceCanvasProps) {
  const [lessonSource] = useState<LessonSource>('uploaded')

  const contentRef = useRef<HTMLDivElement>(null)
  const { popup, clear: clearPopup } = useSelectionPopup(contentRef)

  const getDisplayText = (label: string, segments: readonly LessonSegment[]) => {
    const manualEdit = manualEdits[label]
    if (manualEdit !== undefined) return manualEdit
    const applied = editor.revisedLesson[label]
    if (applied !== undefined) return applied
    return segmentsToText(segments)
  }

  const startEditing = () => {
    const drafts: Record<string, string> = {}
    for (const step of lessonSteps) {
      drafts[step.label] = getDisplayText(step.label, step.segments)
    }
    setDraftBySection(drafts)
    setEditBaseline(drafts)
    // Deliberately NOT resetting openSuggestion here — if the teacher had a
    // section's AI Suggestion popover open before clicking Edit Lesson, it
    // should stay open next to that section's textarea (see
    // renderLessonStep's isEditing branch) rather than disappearing.
    setIsEditing(true)
  }

  const saveEditing = () => {
    setManualEdits((prev) => {
      const next = { ...prev }
      for (const [label, text] of Object.entries(draftBySection)) {
        if (text !== editBaseline[label]) {
          next[label] = text
        }
      }
      return next
    })
    setIsEditing(false)
  }

  // The single entry point for "See AI Suggestions" — opens (or restarts) a
  // section's conversation and switches the left workspace over to it,
  // whether triggered from a flagged AI suggestion or a freeform text
  // selection. `lessonRevisions`/`lessonRevisionSegments` seed the initial
  // concrete proposal for sections that have one; freeform selections just
  // get a conversation with no preview/apply step, same as before.
  const startRevisionChat = (label: string, text: string, viaSuggestion: boolean) => {
    editor.ask(label, buildSectionConversation(text, label, viaSuggestion), lessonRevisions[label], lessonRevisionSegments[label])
    setPlanningTab('ai-chat')
  }

  // Re-focuses an already-engaged section's conversation (chatting,
  // previewing, or applied) without resetting it.
  const focusRevisionChat = (label: string) => {
    editor.reopen(label)
    setPlanningTab('ai-chat')
  }

  const handleManualAskAI = (text: string, sectionKey: string | null) => {
    if (!sectionKey) return
    startRevisionChat(sectionKey, text, false)
    clearPopup()
    window.getSelection()?.removeAllRanges()
  }

  const renderLessonStep = (step: (typeof lessonSteps)[number]) => {
    // Most steps show their own label as the lead-in text ("Standards:",
    // "Engage:"); a few — the individually editable numbered learning
    // objectives — replace that with a short displayPrefix ("1.A", "1.B",
    // "1.C") since their internal label is only a data key, not something
    // meant to be read.
    const labelText = step.displayPrefix ?? `${step.label}:`
    const key = step.label

    const revisionState = editor.statesByLabel[key]
    const appliedText = editor.revisedLesson[key]
    const isApplied = appliedText !== undefined
    // Highlight only the part AI actually contributed, never the section's
    // original wording. Falls back to highlighting the whole applied text
    // only when we genuinely can't tell which part is new (see apply() in
    // useRevisionWorkflow).
    const richSegments = editor.revisedLessonSegments[key]
    const isFocused = editor.activeLabel === key
    // The suggestion for this section, if it has one and hasn't been
    // applied yet — drives the Suggestions-tab highlight/popover below,
    // and also the persistent comparison card shown next to the textarea
    // while editing (see the isEditing branch).
    const suggestion = !isApplied ? lessonSuggestions[key] : undefined
    // Only the Suggestions tab renders a pending suggestion as a clickable
    // highlight — on Generated, an un-applied section just reads as plain
    // original text until the teacher actually applies something.
    const showSuggestionHighlight = lessonTab === 'suggestions' && Boolean(suggestion)
    const isSuggestionOpen = lessonTab === 'suggestions' && openSuggestion === key
    const sectionClassName =
      [isFocused && 'section-focused', editor.justAppliedLabel === key && 'section-just-applied']
        .filter(Boolean)
        .join(' ') || undefined

    // Clicking a flagged phrase: if the section is still untouched, reveal
    // the "AI Suggestion" popover (the "review the suggestion" step). Once
    // the teacher has engaged with it at all — chatting or applied —
    // clicking it just re-opens that ongoing conversation on the left
    // instead of showing the popover again.
    const handleTriggerClick = () => {
      if (revisionState) {
        focusRevisionChat(key)
      } else {
        setOpenSuggestion(isSuggestionOpen ? null : key)
      }
    }

    const askAboutSuggestion = () => {
      setOpenSuggestion(null)
      const flaggedText = segmentsToText(step.segments.filter((segment) => segment.flagged))
      startRevisionChat(key, flaggedText || segmentsToText(step.segments), true)
    }

    // Clicking an "AI revised" section: reopen the existing conversation if
    // one exists; there always is one by the time a section shows as
    // applied, since Apply Change is what makes it applied in the first
    // place — but this stays defensive in case that ever changes.
    const openAppliedSectionChat = () => {
      if (revisionState) {
        focusRevisionChat(key)
      } else {
        const flaggedText = segmentsToText(step.segments.filter((segment) => segment.flagged))
        startRevisionChat(key, flaggedText || segmentsToText(step.segments), true)
      }
    }

    if (isEditing) {
      // The suggestion that prompted this edit stays visible right next to
      // the textarea — either because its popover was already open when
      // Edit Lesson was clicked (isSuggestionOpen; startEditing no longer
      // clears it, see below) or because the teacher has an ongoing "See
      // AI Suggestions" conversation for this section — so they can compare
      // the suggestion against what they're typing without switching views.
      // A section with no suggestion open just shows its textarea,
      // unchanged from before. An already-applied section keeps its card
      // too (reading lessonSuggestions directly, since `suggestion` above is
      // cleared once applied) — AI-revised text is edited exactly like any
      // other text, with its AI conversation still one click away.
      const editingSuggestion = lessonSuggestions[key]
      const showEditingSuggestion = (Boolean(editingSuggestion) && isSuggestionOpen) || Boolean(revisionState)
      return (
        <div data-section-key={key}>
          <p>
            <strong>{labelText}</strong> <DurationBadge duration={step.duration} />
          </p>
          <textarea
            rows={3}
            value={draftBySection[key] ?? ''}
            onChange={(event) => setDraftBySection((prev) => ({ ...prev, [key]: event.target.value }))}
          />
          {showEditingSuggestion && (
            <div className="suggestion-popover">
              <p className="card-label">AI Suggestion</p>
              {editingSuggestion && <p>{editingSuggestion}</p>}
              <button
                type="button"
                className="secondary-button"
                onClick={revisionState ? () => focusRevisionChat(key) : askAboutSuggestion}
              >
                See AI Suggestions
              </button>
            </div>
          )}
        </div>
      )
    }

    // Generated and AI Suggestions both render from this same point on —
    // they're two views of the SAME current lesson (manual edits +
    // whatever's been applied so far), including the yellow "AI revised"
    // highlight/tag on an applied section, which shows up identically on
    // both. The only actual difference is that Suggestions alone surfaces
    // pending, not-yet-applied AI suggestions as clickable highlights (see
    // showSuggestionHighlight above); Generated never flags a pending
    // suggestion, so an un-applied section just reads as plain original
    // text there until the teacher actually applies something.

    // A manual edit (from Edit Lesson / Save Edits) always takes
    // priority for display — it's the teacher's own final wording,
    // shown as plain text with no yellow highlight, which is
    // reserved for AI suggestions and AI-applied changes. If AI had
    // revised the section before the teacher edited it, the "AI revised"
    // tag stays as a record of that — informational only.
    const manualEdit = manualEdits[key]
    if (manualEdit !== undefined) {
      return (
        <div data-section-key={key} className={sectionClassName}>
          <p>
            {labelText} <DurationBadge duration={step.duration} /> {manualEdit}
            {isApplied && (
              <>
                {' '}
                <span className="ai-revised-tag">AI revised</span>
              </>
            )}
          </p>
        </div>
      )
    }

    // Materials and Equipment & Technology render as a bullet list — one
    // list item per segment — instead of one flowing paragraph, as long as
    // the section hasn't been applied yet. An applied change is a flat,
    // one-off accepted string and falls through to the normal paragraph
    // rendering below, like every other applied section.
    if (step.listStyle === 'bullet' && !isApplied) {
      return (
        <div data-section-key={key} className={sectionClassName}>
          <p>{labelText}</p>
          <ul className="lesson-bullet-list">
            {step.segments.map((segment, segmentIndex) => {
              const content = segment.bold ? <strong>{segment.text}</strong> : segment.text
              if (showSuggestionHighlight && segment.flagged) {
                return (
                  <li key={segmentIndex}>
                    <span
                      role="button"
                      tabIndex={0}
                      className="ai-highlight lesson-highlight-trigger"
                      aria-expanded={isSuggestionOpen}
                      onClick={handleTriggerClick}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          handleTriggerClick()
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

          {isSuggestionOpen && suggestion && (
            <div className="suggestion-popover">
              <p className="card-label">AI Suggestion</p>
              <p>{suggestion}</p>
              <button type="button" className="primary-button" onClick={askAboutSuggestion}>
                See AI Suggestions
              </button>
            </div>
          )}
        </div>
      )
    }

    return (
      <div data-section-key={key} className={sectionClassName}>
        <p>
          {labelText} <DurationBadge duration={step.duration} />{' '}
          {isApplied ? (
            <>
              <span
                role="button"
                tabIndex={0}
                className={richSegments ? 'lesson-highlight-trigger' : 'lesson-highlight-trigger ai-highlight'}
                onClick={openAppliedSectionChat}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    openAppliedSectionChat()
                  }
                }}
              >
                {richSegments ? <LessonRichText segments={richSegments} /> : appliedText}
              </span>
              <span className="ai-revised-tag">AI revised</span>
            </>
          ) : showSuggestionHighlight ? (
            // Only the segment(s) marked `flagged` (the specific sentence or
            // phrase the suggestion is about) become the clickable/highlighted
            // trigger — the rest of the section renders as the teacher's
            // normal text, so an AI suggestion never blankets a whole section.
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
                    onClick={handleTriggerClick}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        handleTriggerClick()
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
            <button type="button" className="primary-button" onClick={askAboutSuggestion}>
              See AI Suggestions
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <section className="workspace-canvas">
        <div className="canvas-header">
          <div>
            <p className="card-label">Lesson workspace</p>
            <h3>{lessonTabLabels[lessonTab]} lesson</h3>
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
          {(Object.keys(lessonTabLabels) as LessonTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={lessonTab === tab}
              className={`state-tab ${lessonTab === tab ? 'active' : ''}`}
              disabled={isEditing}
              onClick={() => setLessonTab(tab)}
            >
              {lessonTabLabels[tab]}
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
    </>
  )
}

// Every summary row across all three sections defaults to unselected except
// the very first Learning Objective idea, so the individual-evidence panel
// always has something to show rather than opening empty.
const defaultPatternId = learningObjectiveOverlap[0]?.ideas[0]?.id ?? null

// One clickable row shared by all three summary sections — a pattern's
// label and its student count. Highlights with the same light-blue
// selection style used elsewhere in the app (`.trend-item.active` before
// it, now `.pattern-row.active`) when it's the currently selected pattern.
function PatternRowButton({
  row,
  isActive,
  onSelect,
}: {
  row: PatternRow
  isActive: boolean
  onSelect: (id: string) => void
}) {
  return (
    <div
      className={`pattern-row${isActive ? ' active' : ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      onClick={() => onSelect(row.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(row.id)
        }
      }}
    >
      <span className="pattern-row-label">{row.label}</span>
      <span className="pattern-row-count">{row.count}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Student Feedback — the student-facing counterpart to Lesson Planning/
// Workspace and Class Feedback, but a DIFFERENT content context: this page
// uses a COVID-19 / handwashing modeling activity (the structures of the
// coronavirus and of soap, and how soap's structure lets it disrupt the
// virus and mix with water) rather than the Zombie Fires phenomenon used
// everywhere else in the prototype — see the teacher-facing pages for that
// content. Same two-panel shape as the rest of the app — the student's own
// model and explanation on the left, a persistent AI Feedback conversation
// on the right — and the same shared building blocks
// (ChatThread, chips, composer-box, card styling) rather than a one-off
// visual language.
// ---------------------------------------------------------------------------

type ModelTab = 'descriptive' | 'mechanistic'

// Two representations of the SAME model (not two assignments) — switching
// tabs must never lose either one, so both live in the same component's
// state the whole time; the tabs only ever change which is on screen.
// Descriptive = what structures/components are present. Mechanistic = how
// those structures interact to help explain what happens.
const modelTabLabels: Record<ModelTab, string> = {
  descriptive: 'Descriptive Model',
  mechanistic: 'Mechanistic Model',
}

const studentTask = {
  topic: 'COVID-19 & Handwashing: Structure and Function',
  prompt:
    "Develop and use models to think about the structures of the coronavirus and soap, then explain how the structure of soap helps it function when mixed with water.",
}

// The Descriptive Model prompt has two lettered parts (virus, then soap),
// each with its own set of structures to label — kept as data so the JSX
// below just maps over it instead of hand-duplicating the two halves.
const descriptiveModelPrompt: { heading: string; instruction: string; labels: string[] }[] = [
  {
    heading: 'A. Coronavirus',
    instruction: 'Draw a diagram of the coronavirus and label:',
    labels: ['Protein', 'Fatty envelope', 'Genetic material'],
  },
  {
    heading: 'B. Soap',
    instruction: 'Draw a diagram of a soap molecule and label:',
    labels: ['Hydrophilic portion (attracted to water)', 'Hydrophobic portion (attracted to fat)'],
  },
]

const mechanisticModelPrompt =
  'Draw a diagram that helps show how the structures of a soap molecule can help serve the function of helping oil mix with water. Show how soap molecules, oil, and water interact.'

const initialStudentExplanation =
  "In my model I drew the soap's hydrophobic tail sticking into the virus's fatty envelope, since both of those are supposed to be attracted to fat. I think that's part of how soap breaks the virus apart, but I'm not totally sure yet how the hydrophilic end helps rinse it away with water — I want to add that to my mechanistic model."

// Each model tab gets its own AI feedback conversation, not one shared
// chatbot (see section 1/2/3 of the spec) — so the two are seeded
// separately here, and StudentFeedbackPage keeps them in separate state
// keyed by ModelTab. Both are seeded so the page always opens mid-
// conversation, exactly like a student returning to feedback they've
// already started.
//
// Descriptive: short, and stays focused on helping the student notice and
// describe structures/components that are already in their DRAWING — what's
// labeled, where things are positioned, and whether the relationships
// between structures are actually visible on the page — never jumping ahead
// to mechanism/why, and never just explaining the answer itself.
const initialDescriptiveFeedback: ChatMessage[] = [
  {
    role: 'ai',
    text: 'I see that you labeled the coronavirus’s fatty envelope and the two parts of the soap molecule. Where could you add water to your drawing so the relationship between the hydrophilic part and water is easier to see?',
  },
  { role: 'teacher', text: 'I could draw water molecules around the soap.' },
  {
    role: 'ai',
    text: 'That could make the relationship clearer. Which part of the soap molecule should point toward the water in your drawing?',
  },
]

// Mechanistic: opens on what's in the student's mechanistic drawing and
// pushes toward interactions and change (many soap molecules acting on the
// envelope), then — the last word in the conversation — explicitly sends
// the student back to their Descriptive Model, naming the specific
// relationships they represented there (hydrophobic part ↔ fat,
// hydrophilic part ↔ water), and asks how to use those as the foundation
// for showing the mechanism with arrows, labels, or positioning. The
// progression it models: what I represented descriptively helps me reason
// about and improve my mechanistic model. Scaffolds with questions, never a
// textbook explanation of why soap works.
const initialMechanisticFeedback: ChatMessage[] = [
  {
    role: 'ai',
    text: 'I see that you drew the hydrophobic part of the soap next to the virus’s fatty envelope. What could you add to show what happens when many soap molecules interact with the envelope?',
  },
  { role: 'teacher', text: 'Maybe I could show the fatty layer starting to break apart?' },
  {
    role: 'ai',
    text: 'Look back at your Descriptive Model: you showed that the hydrophobic part of soap interacts with fat while the hydrophilic part interacts with water. How could you use arrows, labels, or positioning in your Mechanistic Model to show how these interactions contribute to the change in the fatty envelope?',
  },
]

const initialFeedbackByTab: Record<ModelTab, ChatMessage[]> = {
  descriptive: initialDescriptiveFeedback,
  mechanistic: initialMechanisticFeedback,
}

// Shown as a small contextual label above the Mechanistic Model AI
// conversation (spec section 4) — makes the connection to the Descriptive
// Model explicit to the student, not just implicit in the AI's wording.
const mechanisticProgressionNote = 'Building on your Descriptive Model'

// Rotates through generic Socratic follow-ups when nothing in the student's
// message keyword-matches something more specific below — the point is the
// conversation always has somewhere to go, never that it runs out of things
// to ask. Kept separate per model tab so the fallback question still matches
// what that tab is meant to help students think about (structures/labels for
// Descriptive, interactions/mechanism for Mechanistic — see section 7).
const genericDescriptiveFollowUps = [
  'Which structure in your model would that be part of — is it something you could add a label for?',
  'Is that a structure you’ve already drawn, or a new part you’d want to add to your model?',
  'Where is that positioned in your drawing, and is its relationship to the nearby structures easy to see?',
  'How does that structure compare between the virus and the soap molecule in your model?',
]

const genericMechanisticFollowUps = [
  'Where in your model would that interaction show up — is it something you could add an arrow for?',
  'How could you use arrows or labels to show that happening over time, rather than all at once?',
  'Is that something your model already shows happening, or a new relationship you’d want to add?',
  'Which structures are involved in that, and how would you position them relative to each other to show it?',
]

// Stands in for a real AI call. Always responds with a scaffolding question
// grounded in whatever the student just said, never the scientific answer
// itself — matches the rest of this prototype's "mock reply" convention
// (see mockDeeperAnalysisReply / mockRevisionFollowUpReply). Every reply
// stays anchored to the DRAWING itself — labels, arrows, structures, and
// the positioning/relationships between them, and what is or isn't yet
// represented visually — rather than explaining the underlying science, so
// this never reads as a general science tutor giving the answer away.
// Sensitive to which model tab the student is currently on (see section 7
// of the spec): Descriptive replies stay focused on identifying and
// labeling structures/positioning, Mechanistic replies stay focused on
// interactions, cause-and-effect, and change shown through arrows.
function mockStudentFeedbackReply(message: string, followUpCount: number, modelTab: ModelTab): string {
  const lower = message.toLowerCase()

  if (modelTab === 'descriptive') {
    if (lower.includes('protein') || lower.includes('spike')) {
      return 'You mentioned the protein. Where did you draw it on the coronavirus, and how does its position compare to the fatty envelope in your model?'
    }
    if (lower.includes('envelope') || lower.includes('fatty')) {
      return 'You’re describing the fatty envelope. What part of the soap molecule do you think would interact with it — and did you label that part?'
    }
    if (lower.includes('genetic') || lower.includes('rna') || lower.includes('dna')) {
      return 'You’re thinking about the genetic material. Where is it positioned in your model, and did you draw or label anything around it to show what protects it?'
    }
    if (lower.includes('hydrophilic') || lower.includes('water')) {
      return 'You’re describing the hydrophilic portion. Which end of the soap molecule is that, and how did you show it in your diagram?'
    }
    if (lower.includes('hydrophobic') || lower.includes('fat')) {
      return 'You’re describing the hydrophobic portion. Which direction does that part point in your drawing, and is that relationship labeled?'
    }
    return genericDescriptiveFollowUps[followUpCount % genericDescriptiveFollowUps.length]
  }

  if (lower.includes('stick') || lower.includes('attach') || lower.includes('grab')) {
    return 'That connection could be useful to show in your model. What arrow or label could you add to represent what you think the soap is doing?'
  }
  if (lower.includes('break') || lower.includes('dissolve') || lower.includes('disrupt') || lower.includes('apart')) {
    return 'You’re describing something happening to the virus’s structure. What part of your model shows the fatty envelope actually being disrupted, and how would you show that change?'
  }
  if (lower.includes('surround') || lower.includes('cluster') || lower.includes('group') || lower.includes('ball')) {
    return 'That’s an interesting way to represent it. What’s on the outside of that cluster in your model, and what’s on the inside?'
  }
  if (lower.includes('mix') || lower.includes('combine') || (lower.includes('oil') && lower.includes('water'))) {
    return 'You’re describing how oil and water interact with soap. Which part of the soap molecule is facing the oil, and which part is facing the water in your drawing?'
  }
  if (lower.includes('rinse') || lower.includes('wash') || lower.includes('remove') || lower.includes('away')) {
    return 'You’re describing the virus being carried away. What could you add — an arrow, or a change in the drawing — to show what happens right before that point?'
  }
  return genericMechanisticFollowUps[followUpCount % genericMechanisticFollowUps.length]
}

function MicButton({ isListening, onClick, label }: { isListening: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      className={`mic-button${isListening ? ' listening' : ''}`}
      aria-label={isListening ? `Stop recording — ${label}` : `Record — ${label}`}
      aria-pressed={isListening}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
        <path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z" />
        <path
          fill="currentColor"
          d="M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.92V20H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.08A7 7 0 0 0 19 11Z"
        />
      </svg>
    </button>
  )
}

// The real hand-drawn example artifacts for each model tab — same
// convention as ZOMBIE_FIRES_STUDENT_MODEL_IMAGE above: lives in /public so
// a missing file degrades to a broken-image icon instead of failing the
// build. handleArtifactUpload (in StudentFeedbackPage) swaps either one out
// for the student's own uploaded photo.
const COVID_DESCRIPTIVE_MODEL_EXAMPLE_IMAGE = '/covid-descriptive-model-example.png'
const COVID_MECHANISTIC_MODEL_EXAMPLE_IMAGE = '/covid-mechanistic-model-example.png'

function StudentFeedbackPage() {
  const [modelTab, setModelTab] = useState<ModelTab>('descriptive')

  // Each tab's artifact is independent state — switching tabs must never
  // lose either one (see the ModelTab comment above). null means "showing
  // the starter reference diagram"; once the student uploads a photo of
  // their own drawing, this holds an object URL for it instead.
  const [descriptiveArtifactUrl, setDescriptiveArtifactUrl] = useState<string | null>(null)
  const [mechanisticArtifactUrl, setMechanisticArtifactUrl] = useState<string | null>(null)
  const artifactFileInputRef = useRef<HTMLInputElement>(null)

  const handleArtifactUpload = (tab: ModelTab, file: File | undefined) => {
    if (!file) return
    const url = URL.createObjectURL(file)
    const previousUrl = tab === 'descriptive' ? descriptiveArtifactUrl : mechanisticArtifactUrl
    if (previousUrl) URL.revokeObjectURL(previousUrl)
    if (tab === 'descriptive') setDescriptiveArtifactUrl(url)
    else setMechanisticArtifactUrl(url)
  }

  const [explanation, setExplanation] = useState(initialStudentExplanation)
  const explanationRef = useRef<HTMLTextAreaElement>(null)
  const [isExplanationListening, setIsExplanationListening] = useState(false)
  const explanationListenTimeoutRef = useRef<number | null>(null)

  // Descriptive and Mechanistic each keep their own conversation — switching
  // tabs must never lose or mix either one (same rule as the artifact state
  // above), so both live keyed by tab in one piece of state.
  const [feedbackMessagesByTab, setFeedbackMessagesByTab] = useState<Record<ModelTab, ChatMessage[]>>(initialFeedbackByTab)
  const feedbackMessages = feedbackMessagesByTab[modelTab]
  const [feedbackDraft, setFeedbackDraft] = useState('')
  const [isComposerListening, setIsComposerListening] = useState(false)
  const composerListenTimeoutRef = useRef<number | null>(null)
  const [isAiThinking, setIsAiThinking] = useState(false)
  const aiThinkingTimeoutRef = useRef<number | null>(null)
  const followUpCountRef = useRef<Record<ModelTab, number>>({ descriptive: 0, mechanistic: 0 })
  const chatScrollRef = useRef<HTMLDivElement | null>(null)

  const [isRevisionFlash, setIsRevisionFlash] = useState(false)
  const revisionFlashTimeoutRef = useRef<number | null>(null)
  // Tracks the two-button workflow (spec section 1): "Start Iterating" is
  // repeatable and never changes this; "Submit Final Revision" is the one
  // terminal action — once clicked, the button row is replaced with a
  // plain confirmation note, same convention as RevisionChatPanel's
  // "✓ Applied to Lesson" (see .inline-ai-applied-note).
  const [isFinalSubmitted, setIsFinalSubmitted] = useState(false)

  // The chat area is a fixed-height, internally scrolling pane (see
  // .deeper-analysis-chat, reused here) — keep it pinned to the latest
  // message as the conversation grows, same as Deeper AI Analysis.
  useEffect(() => {
    const container = chatScrollRef.current
    if (container) container.scrollTop = container.scrollHeight
  }, [feedbackMessages, isAiThinking])

  useEffect(() => {
    return () => {
      if (explanationListenTimeoutRef.current !== null) window.clearTimeout(explanationListenTimeoutRef.current)
      if (composerListenTimeoutRef.current !== null) window.clearTimeout(composerListenTimeoutRef.current)
      if (aiThinkingTimeoutRef.current !== null) window.clearTimeout(aiThinkingTimeoutRef.current)
      if (revisionFlashTimeoutRef.current !== null) window.clearTimeout(revisionFlashTimeoutRef.current)
    }
  }, [])

  // Both mic controls are mocked the same way (no real speech-to-thing API):
  // toggling "listening" on, then after a short pause, appending a canned
  // transcript — enough to demonstrate "type or speak" without a flaky
  // browser API dependency.
  const toggleExplanationMic = () => {
    if (isExplanationListening) {
      if (explanationListenTimeoutRef.current !== null) window.clearTimeout(explanationListenTimeoutRef.current)
      setIsExplanationListening(false)
      return
    }
    setIsExplanationListening(true)
    explanationListenTimeoutRef.current = window.setTimeout(() => {
      setExplanation((prev) =>
        `${prev.trim() ? `${prev.trim()} ` : ''}Also, I think the hydrophilic end is what lets the soap mix into the water in the first place.`,
      )
      setIsExplanationListening(false)
    }, 1800)
  }

  const toggleComposerMic = () => {
    if (isComposerListening) {
      if (composerListenTimeoutRef.current !== null) window.clearTimeout(composerListenTimeoutRef.current)
      setIsComposerListening(false)
      return
    }
    setIsComposerListening(true)
    composerListenTimeoutRef.current = window.setTimeout(() => {
      setFeedbackDraft((prev) =>
        `${prev.trim() ? `${prev.trim()} ` : ''}I think the hydrophobic tail pulls toward the virus's fatty envelope, away from the water.`,
      )
      setIsComposerListening(false)
    }, 1800)
  }

  const sendFeedbackMessage = () => {
    const text = feedbackDraft.trim()
    if (!text || isAiThinking) return
    const tab = modelTab
    setFeedbackMessagesByTab((prev) => ({ ...prev, [tab]: [...prev[tab], { role: 'teacher', text }] }))
    setFeedbackDraft('')
    setIsAiThinking(true)
    const count = followUpCountRef.current[tab]
    followUpCountRef.current = { ...followUpCountRef.current, [tab]: count + 1 }
    aiThinkingTimeoutRef.current = window.setTimeout(() => {
      setFeedbackMessagesByTab((prev) => ({
        ...prev,
        [tab]: [...prev[tab], { role: 'ai', text: mockStudentFeedbackReply(text, count, tab) }],
      }))
      setIsAiThinking(false)
    }, 700)
  }

  // "Start Iterating" never touches the student's text itself — it just
  // brings the editable explanation back into focus, so the student decides
  // what (if anything) to revise based on the AI feedback they've read. It
  // stays available and repeatable throughout the formative loop (create →
  // Start Iterating → get feedback → revise → repeat).
  const handleStartIterating = () => {
    explanationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    explanationRef.current?.focus()
    setIsRevisionFlash(true)
    if (revisionFlashTimeoutRef.current !== null) window.clearTimeout(revisionFlashTimeoutRef.current)
    revisionFlashTimeoutRef.current = window.setTimeout(() => setIsRevisionFlash(false), 1200)
  }

  // "Submit Final Revision" is the one terminal action in this workflow —
  // it marks the formative loop as done and swaps the button row for a
  // plain confirmation note (see isFinalSubmitted above).
  const handleSubmitFinalRevision = () => {
    setIsFinalSubmitted(true)
  }

  return (
    <div className="student-workspace-layout">
      <section className="student-model-panel">
        <div className="student-task-card">
          <p className="card-label">Your Task</p>
          <h3>{studentTask.topic}</h3>
          <p>{studentTask.prompt}</p>
        </div>

        <div className="planning-tabs" role="tablist" aria-label="Model representation">
          {(Object.keys(modelTabLabels) as ModelTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={modelTab === tab}
              className={`planning-tab ${modelTab === tab ? 'active' : ''}`}
              onClick={() => setModelTab(tab)}
            >
              {modelTabLabels[tab]}
            </button>
          ))}
        </div>

        {modelTab === 'descriptive' ? (
          <div className="model-representation-area">
            <div className="model-task-prompt">
              <p className="model-task-prompt-label">Descriptive Model</p>
              {descriptiveModelPrompt.map((section) => (
                <div key={section.heading} className="model-task-prompt-section">
                  <p className="model-task-prompt-heading">{section.heading}</p>
                  <p>{section.instruction}</p>
                  <ul>
                    {section.labels.map((label) => (
                      <li key={label}>{label}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <img
              src={descriptiveArtifactUrl ?? COVID_DESCRIPTIVE_MODEL_EXAMPLE_IMAGE}
              alt="Descriptive model of the coronavirus (protein, fatty envelope, genetic material) and a soap molecule (hydrophilic head, hydrophobic tail)"
              className="student-model-preview"
            />

            <div className="model-representation-actions">
              <input
                ref={artifactFileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(event) => handleArtifactUpload('descriptive', event.target.files?.[0])}
              />
              <button type="button" className="secondary-button" onClick={() => artifactFileInputRef.current?.click()}>
                Add Model
              </button>
            </div>
          </div>
        ) : (
          <div className="model-representation-area">
            <div className="model-task-prompt">
              <p className="model-task-prompt-label">Mechanistic Model</p>
              <p>{mechanisticModelPrompt}</p>
            </div>

            <img
              src={mechanisticArtifactUrl ?? COVID_MECHANISTIC_MODEL_EXAMPLE_IMAGE}
              alt="Mechanistic model of soap molecules trapping oil droplets in water"
              className="student-model-preview"
            />

            <div className="model-representation-actions">
              <input
                ref={artifactFileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(event) => handleArtifactUpload('mechanistic', event.target.files?.[0])}
              />
              <button type="button" className="secondary-button" onClick={() => artifactFileInputRef.current?.click()}>
                Add Model
              </button>
            </div>
          </div>
        )}

        <div className={`student-explanation-field${isRevisionFlash ? ' revision-flash' : ''}`}>
          <div className="student-explanation-header">
            <span>Explain your thinking</span>
            <span className="empty-state-support">Type your explanation, or use the microphone to speak it.</span>
          </div>
          <div className="student-explanation-input-row">
            <textarea
              ref={explanationRef}
              rows={6}
              value={explanation}
              onChange={(event) => setExplanation(event.target.value)}
              placeholder="Explain how your model shows the structures of the coronavirus and soap, and how soap's structure helps it work with water..."
            />
            <MicButton isListening={isExplanationListening} onClick={toggleExplanationMic} label="your explanation" />
          </div>
          {isExplanationListening && <p className="mic-listening-note">🎤 Listening…</p>}
        </div>

        {isFinalSubmitted ? (
          <p className="inline-ai-applied-note">✓ Final revision submitted</p>
        ) : (
          <div className="model-representation-actions">
            <button type="button" className="primary-button" onClick={handleStartIterating}>
              Start Iterating
            </button>
            <button type="button" className="secondary-button" onClick={handleSubmitFinalRevision}>
              Submit Final Revision
            </button>
          </div>
        )}
      </section>

      {/* `ai-panel-${modelTab}` carries the subtle per-state tint (see
          .ai-panel-descriptive / .ai-panel-mechanistic in App.css) — the
          badge, progression note, and contextual text below all key off the
          same `modelTab` so the whole header changes together with the
          conversation and the model/work on the left. */}
      <section className={`student-ai-panel ai-panel-${modelTab}`}>
        <div className="panel-header compact ai-panel-header">
          <h3>AI Feedback</h3>
          <span className="badge ai-panel-badge">{modelTab === 'descriptive' ? 'Descriptive Model' : 'Mechanistic Model'}</span>
        </div>
        {modelTab === 'mechanistic' && (
          <p className="ai-panel-progression-note">🔗 {mechanisticProgressionNote}</p>
        )}
        <p className="empty-state-support deeper-analysis-subtitle">
          {modelTab === 'mechanistic'
            ? 'Use the structures you identified to explain how the interaction happens.'
            : 'Explore the structures and features shown in your model.'}
        </p>

        <div className="deeper-analysis-body">
          <div className="deeper-analysis-chat" ref={chatScrollRef}>
            {/* `ai-panel-chat-${modelTab}` recolors only the AI bubbles (see
                .ai-panel-chat-descriptive/.ai-panel-chat-mechanistic in
                App.css) — student bubbles stay the shared neutral gray from
                .teacher-message everywhere, unaffected by model tab. */}
            <ChatThread messages={feedbackMessages} className={`ai-panel-chat-${modelTab}`} />
            {isAiThinking && <p className="empty-state-support">AI is thinking…</p>}
          </div>

          <div className="composer-box student-feedback-composer">
            <input
              type="text"
              placeholder="Reply to the feedback..."
              value={feedbackDraft}
              onChange={(event) => setFeedbackDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') sendFeedbackMessage()
              }}
              disabled={isAiThinking}
            />
            <MicButton isListening={isComposerListening} onClick={toggleComposerMic} label="your reply" />
            <button
              type="button"
              className="primary-button"
              onClick={sendFeedbackMessage}
              disabled={isAiThinking || !feedbackDraft.trim()}
            >
              Send
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

function FeedbackDashboardPage() {
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(defaultPatternId)
  const [facilitationQuestions, setFacilitationQuestions] = useState<string[]>(suggestedQuestions)
  const [isRegeneratingQuestions, setIsRegeneratingQuestions] = useState(false)

  const nextQuestionSetIndexRef = useRef(0)
  const regenerationTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (regenerationTimeoutRef.current !== null) window.clearTimeout(regenerationTimeoutRef.current)
    }
  }, [])

  const selectedPattern = selectedPatternId ? allPatternRows[selectedPatternId] : undefined

  const regenerateFacilitationQuestions = () => {
    setIsRegeneratingQuestions(true)
    regenerationTimeoutRef.current = window.setTimeout(() => {
      const nextSet = alternateFacilitationQuestionSets[nextQuestionSetIndexRef.current % alternateFacilitationQuestionSets.length]
      nextQuestionSetIndexRef.current += 1
      setFacilitationQuestions([...nextSet])
      setIsRegeneratingQuestions(false)
    }, 900)
  }

  const [deeperChatMessages, setDeeperChatMessages] = useState<ChatMessage[]>([])
  const [deeperChatDraft, setDeeperChatDraft] = useState('')
  const [isDeeperAiThinking, setIsDeeperAiThinking] = useState(false)
  const [focusedStudent, setFocusedStudent] = useState<StudentEvidence | null>(null)
  const deeperAiTimeoutRef = useRef<number | null>(null)
  // Student Evidence and Deeper AI Analysis are one unified, single-scroll
  // workspace (see .evidence-workspace-scroll) rather than two independently
  // scrolling panes, so this ref targets the whole workspace's scroll
  // container, not just the chat transcript.
  const evidenceWorkspaceScrollRef = useRef<HTMLDivElement | null>(null)

  // Without this, the workspace would silently stay scrolled wherever the
  // teacher left it as new messages arrive below the fold, instead of
  // following the conversation down to the composer like every other chat
  // surface in the app. Guarded to skip the empty/not-thinking case —
  // otherwise this would also fire right after the pattern-change reset
  // below (which clears deeperChatMessages to a new empty array), fighting
  // that effect's scrollTop-to-0 and leaving the workspace stuck scrolled
  // to the bottom every time the teacher picks a new pattern.
  useEffect(() => {
    if (deeperChatMessages.length === 0 && !isDeeperAiThinking) return
    const container = evidenceWorkspaceScrollRef.current
    if (container) container.scrollTop = container.scrollHeight
  }, [deeperChatMessages, isDeeperAiThinking])

  // A new pattern means a new context for both the student evidence shown
  // and "Deeper AI Analysis" — start the conversation over rather than
  // carrying stale answers about a different group of students into the new
  // selection, and scroll the workspace back to the top so the teacher sees
  // the new Student Evidence header/context first, not wherever the
  // previous pattern's scroll position happened to land.
  useEffect(() => {
    setDeeperChatMessages([])
    setDeeperChatDraft('')
    setIsDeeperAiThinking(false)
    setFocusedStudent(null)
    if (deeperAiTimeoutRef.current !== null) {
      window.clearTimeout(deeperAiTimeoutRef.current)
      deeperAiTimeoutRef.current = null
    }
    if (evidenceWorkspaceScrollRef.current) evidenceWorkspaceScrollRef.current.scrollTop = 0
  }, [selectedPatternId])

  useEffect(() => {
    return () => {
      if (deeperAiTimeoutRef.current !== null) window.clearTimeout(deeperAiTimeoutRef.current)
    }
  }, [])

  const askDeeperAnalysis = (question: string) => {
    const text = question.trim()
    if (!text || !selectedPattern || isDeeperAiThinking) return
    setDeeperChatMessages((prev) => [...prev, { role: 'teacher', text }])
    setDeeperChatDraft('')
    setIsDeeperAiThinking(true)
    const pattern = selectedPattern
    const student = focusedStudent
    deeperAiTimeoutRef.current = window.setTimeout(() => {
      setDeeperChatMessages((prev) => [...prev, { role: 'ai', text: mockDeeperAnalysisReply(pattern, text, student) }])
      setIsDeeperAiThinking(false)
    }, 700)
  }

  // Clicking the comment/"Ask AI" action on one student's evidence card
  // narrows Deeper AI Analysis to that student — every subsequent reply is
  // framed around their specific response/artifact until the teacher
  // focuses someone else or picks a different Class Summary pattern.
  const focusStudentInDeeperAnalysis = (student: StudentEvidence) => {
    setFocusedStudent(student)
    setDeeperChatMessages((prev) => [...prev, { role: 'ai', text: buildStudentFocusNote(student) }])
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
        <section className="report-panel class-summary-panel">
          <div className="panel-header compact">
            <h3>Class Summary</h3>
          </div>

          <div className="summary-section summary-section-objective">
            <p className="summary-section-title">Learning Objective Overlap</p>
            {learningObjectiveOverlap.map((group) => (
              <div key={group.objective} className="pattern-group">
                <p className="pattern-group-title">Learning Objective: {group.objective}</p>
                <div className="pattern-row-list">
                  {group.ideas.map((row) => (
                    <PatternRowButton
                      key={row.id}
                      row={row}
                      isActive={selectedPatternId === row.id}
                      onSelect={setSelectedPatternId}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="summary-section summary-section-practice">
            <p className="summary-section-title">Engagement in Science Practices</p>
            {scienceInPracticePatterns.map((group) => (
              <div key={group.practice} className="pattern-group">
                <p className="pattern-group-title">{group.practice}</p>
                <div className="pattern-row-list">
                  {group.patterns.map((row) => (
                    <PatternRowButton
                      key={row.id}
                      row={row}
                      isActive={selectedPatternId === row.id}
                      onSelect={setSelectedPatternId}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="summary-section summary-section-misconception">
            <p className="summary-section-title">Areas for Improvement</p>
            <div className="pattern-row-list">
              {misconceptionPatterns.map((row) => (
                <PatternRowButton
                  key={row.id}
                  row={row}
                  isActive={selectedPatternId === row.id}
                  onSelect={setSelectedPatternId}
                />
              ))}
            </div>
          </div>
        </section>

        <div className="right-column">
          {/* One unified, single-scroll Student Evidence workspace — Deeper
              AI Analysis is a section within it (see .deeper-analysis-section
              below), not a second standalone card with its own scrollbar. */}
          <section
            className={`report-panel right-panel evidence-workspace-panel${selectedPattern ? ` evidence-${selectedPattern.kind}` : ''}`}
          >
            <div className="evidence-workspace-scroll" ref={evidenceWorkspaceScrollRef}>
              <div className="panel-header">
                <h3>Student Evidence</h3>
              </div>
              {selectedPattern && (
                <p className={`evidence-context-row tag evidence-tag-${selectedPattern.kind}`}>
                  {selectedPattern.label} · {selectedPattern.count} students
                </p>
              )}

              {selectedPattern ? (
                <div className="student-list">
                  {selectedPattern.students.map((student) => {
                    // Priority order is always: name, the student's own words,
                    // then their actual model. A real image IS the artifact —
                    // a text caption describing it would just restate what the
                    // teacher can already see, so the caption only renders as a
                    // fallback for students with no scanned/photographed model.
                    const responseBlock = student.response && (
                      <p className="student-quote">&ldquo;{student.response}&rdquo;</p>
                    )
                    const imageBlock = student.artifactImage && (
                      <img
                        src={student.artifactImage}
                        alt={`${student.name}'s zombie fire model`}
                        className="student-artifact-image"
                      />
                    )
                    const artifactBlock = !student.artifactImage && student.artifact && (
                      <p className="student-artifact">{student.artifact}</p>
                    )
                    return (
                      <div
                        key={student.name}
                        className={`evidence-card${focusedStudent?.name === student.name ? ' student-focused' : ''}`}
                      >
                        <div className="student-header">
                          <h4>{student.name}</h4>
                        </div>
                        {responseBlock}
                        {imageBlock}
                        {artifactBlock}
                        <div className="student-footer">
                          <button
                            type="button"
                            className="student-ask-ai-button"
                            aria-label={`Ask AI about ${student.name}'s response`}
                            onClick={() => focusStudentInDeeperAnalysis(student)}
                          >
                            <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true" focusable="false">
                              <path
                                fill="currentColor"
                                d="M4 4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h1v2.5a.5.5 0 0 0 .8.4L9.33 14H16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H4Z"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="empty-state-support">Select a pattern on the left to see individual student evidence.</p>
              )}

              <div className="deeper-analysis-section">
                <div className="panel-header">
                  <h3>Deeper AI Analysis</h3>
                </div>

                <p className="empty-state-support deeper-analysis-subtitle">
                  Ask follow-up questions about the selected student responses and artifacts.
                </p>

                {selectedPattern ? (
                  <div className="deeper-analysis-body">
                    <div className="deeper-analysis-chat">
                      {deeperChatMessages.length === 0 && !isDeeperAiThinking ? (
                        <p className="deeper-analysis-chat-empty">Ask a question below to start the conversation.</p>
                      ) : (
                        <ChatThread messages={deeperChatMessages} />
                      )}
                      {isDeeperAiThinking && <p className="empty-state-support">AI is analyzing these responses…</p>}
                    </div>

                    <div className="composer-box">
                      <input
                        type="text"
                        placeholder="Ask about these student responses..."
                        value={deeperChatDraft}
                        onChange={(event) => setDeeperChatDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') askDeeperAnalysis(deeperChatDraft)
                        }}
                        disabled={isDeeperAiThinking}
                      />
                      <button
                        type="button"
                        className="send-button"
                        aria-label="Send"
                        onClick={() => askDeeperAnalysis(deeperChatDraft)}
                        disabled={isDeeperAiThinking || !deeperChatDraft.trim()}
                      >
                        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">
                          <path
                            fill="currentColor"
                            d="M3 10a1 1 0 0 1 1-1h9.09l-3.3-3.3a1 1 0 1 1 1.42-1.4l5 5a1 1 0 0 1 0 1.4l-5 5a1 1 0 0 1-1.42-1.4l3.3-3.3H4a1 1 0 0 1-1-1Z"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="empty-state-support">Select a pattern on the left to enable deeper AI analysis.</p>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      <section className="questions-panel">
        <div className="panel-header compact">
          <h3>Suggested Facilitation Questions</h3>
          <button
            type="button"
            className="regenerate-button"
            onClick={regenerateFacilitationQuestions}
            disabled={isRegeneratingQuestions}
          >
            <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true" focusable="false">
              <path
                fill="currentColor"
                d="M10 4a6 6 0 0 1 5.29 3.17.75.75 0 1 1-1.33.7A4.5 4.5 0 1 0 14.4 13h-1.65a.75.75 0 0 1 0-1.5h3.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-1.46A6 6 0 1 1 10 4Z"
              />
            </svg>
            Regenerate Questions
          </button>
        </div>

        {isRegeneratingQuestions ? (
          <p className="empty-state-support">Generating new questions…</p>
        ) : (
          <ul className="question-list">
            {facilitationQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        )}
      </section>

    </div>
  )
}

export default App
