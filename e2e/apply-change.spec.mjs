// End-to-end regression test for the AI lesson-revision workflow on the
// Lesson Workspace page. This is a plain Node script (not a test-framework
// file) so it can run with zero configuration: `npm run test:e2e`.
//
// It spins up the Vite dev server itself, drives a real Chromium instance
// through the exact flow a teacher would use, and asserts on the rendered
// DOM — not on internal state — so it catches the class of bug where the UI
// *looks* like it applied a change (highlight + badge) without the actual
// lesson text being replaced.
//
// Flow under test — three tabs, but TWO independent tracks:
//   Track 1 — the teacher-approved WORKING lesson (Generated + Suggestions):
//     driven entirely by the teacher explicitly clicking Apply Change in the
//     conversational left-side chat. A section is highlighted there only
//     once the teacher has actually accepted a change for it.
//   Track 2 — the PREDEFINED comparison (Revised): for any section that
//     carries an AI suggestion, Revised always shows AI's own baseline
//     revision of it, fully incorporated, from the moment the lesson is
//     generated — independent of whether the teacher has touched that
//     section's chat at all, and independent of anything the teacher does
//     conversationally afterward. AI Suggestions (what AI recommends) and
//     Revised (what the lesson looks like with those exact recommendations
//     incorporated) are meant to be directly, one-to-one comparable.
//   Manual edits (Edit Lesson) win everywhere, on both tracks.
//
//   0. Generated | AI Suggestions | Revised. Generated is the default tab.
//      Revised already shows every suggested section highlighted (yellow +
//      "AI revised" tag) before the teacher has touched anything; Generated
//      and Suggestions don't, until the teacher actually applies something.
//      A section with no AI suggestion (Materials) never gets highlighted
//      anywhere — "don't introduce unrelated changes."
//   1. On AI Suggestions, a flagged AI suggestion shows a popover with
//      "Ask AI about this"; clicking it opens that section's conversation
//      in the LEFT workspace (switching to the AI Chat tab), not inline in
//      the lesson text — the right side stays the lesson plan. Clicking a
//      section that's already highlighted on Revised (but never discussed)
//      opens a proper, freshly-seeded conversation for it too, not a blank
//      panel.
//   2. There is no separate "Preview Change" step. As soon as the AI has a
//      concrete proposal, the full proposed content is shown immediately in
//      a "PROPOSED CHANGE — NOT YET APPLIED" card in the left chat, with a
//      single Apply Change action. Apply Change updates the WORKING lesson
//      (Generated + Suggestions) only — Revised is unaffected, since it
//      already showed AI's own baseline for that section regardless.
//   3. A follow-up typed into the left chat replaces the proposed-change
//      card's content with a new concrete proposal (a statement, not
//      another clarifying question) whenever the teacher's intent is clear
//      enough to act on. Applying THAT updates the working lesson again —
//      and now visibly diverges from Revised's static baseline, proving the
//      two tracks are independent. AI only asks a clarifying question back
//      when the follow-up is genuinely too vague to turn into a revision.
//   4. Every section with a flagged suggestion (not just one) supports the
//      Ask AI about this -> Apply flow on Suggestions, and is already
//      pre-highlighted on Revised beforehand. A bullet-list section
//      (Equipment & Technology) keeps its item structure on Revised, with
//      only the added item highlighted, rather than flattening to one
//      paragraph. A freeform text selection (e.g. on Standards, which has
//      no pre-flagged suggestion) can still start a conversation on the
//      left, just with no proposed-change card until the AI actually has
//      something concrete to propose, and nothing to show on Revised.
//   5. Manual "Edit Lesson" still works independently, per section (and is
//      unavailable on Generated), and its edits win over both tracks
//      everywhere, including Revised.

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))

const PORT = 4319
const BASE_URL = `http://localhost:${PORT}/`

// Every section that carries a pre-flagged AI suggestion (see
// lessonSuggestions / lessonRevisionSegments in src/App.tsx).
const ALL_SECTION_LABELS = [
  'Crosscutting Concept',
  'Equipment & Technology',
  'Engage',
  'Explore',
  'Explain',
  'Elaborate',
  'Evaluate',
  'Assessment',
]

const ORIGINAL_ASSESSMENT_TEXT =
  'Students ask questions to clarify what they still need to understand about the flow of energy and matter between the atmosphere (CO₂/smoke) and biosphere (peat/permafrost), including the role of humans in zombie fires becoming more common. These questions are collected and added to a class Driving Question Board to guide the lessons that follow. Look for: at least one question connected to matter or energy flow, and one question about cause and effect (including human influence).'
const PROPOSED_ASSESSMENT_TEXT =
  'Students exchange their initial model with a partner for a quick round of feedback, then ask questions to clarify what they still need to understand about the flow of energy and matter between the atmosphere (CO₂/smoke) and biosphere (peat/permafrost), including the role of humans in zombie fires becoming more common. These questions are collected and added to a class Driving Question Board to guide the lessons that follow. Each group posts its top question to the board so the class can track which ones get answered as the unit progresses. Look for: at least one question connected to matter or energy flow, and one question about cause and effect (including human influence).'

function log(message) {
  console.log(`[e2e] ${message}`)
}

function waitForServer(url, timeoutMs) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const attempt = async () => {
      try {
        const res = await fetch(url)
        if (res.ok || res.status === 404) {
          resolve()
          return
        }
      } catch {
        // server not up yet
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`))
        return
      }
      setTimeout(attempt, 300)
    }
    attempt()
  })
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`)
  }
  log(`PASS: ${message}`)
}

// Landing on Lesson Workspace shows a blank lesson until Generate Lesson is
// actually clicked — every flow below that needs the canvas visible must
// trigger generation itself first, same as a real teacher would.
async function generateLessonOnWorkspacePage(page) {
  await page.click('.planning-form button:has-text("Generate Lesson")')
  await page.waitForSelector('text=Lesson Title: Zombie Fires')
}

async function gotoLessonWorkspace(page) {
  await page.goto(BASE_URL)
  await page.waitForSelector('text=Lesson Planning')
  await page.click('button[aria-label="Open prototype navigation"]')
  await page.waitForSelector('text=Prototype Navigation')
  await page.click('.nav-drawer button:has-text("Lesson Workspace")')
  await generateLessonOnWorkspacePage(page)
}

async function switchToTab(page, tabName) {
  await page.click(`.state-tab:has-text("${tabName}")`)
  await page.waitForSelector(`.state-tab.active:has-text("${tabName}")`)
}

async function run() {
  log(`starting Vite dev server on port ${PORT}...`)
  const server = spawn(`npx vite --port ${PORT} --strictPort`, {
    cwd: projectRoot,
    shell: true,
    stdio: 'ignore',
  })

  let browser
  try {
    await waitForServer(BASE_URL, 30000)
    log('dev server is up')

    browser = await chromium.launch()

    // ====================================================================
    // PART 0: three tabs, Generated default. Revised is a predefined
    // comparison — every suggested section is already highlighted there,
    // untouched, from the moment the lesson is generated. The working
    // lesson (Generated/Suggestions) is not.
    // ====================================================================
    const page = await browser.newPage({ viewport: { width: 1440, height: 1300 } })
    const consoleErrors = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => consoleErrors.push(String(err)))

    await gotoLessonWorkspace(page)

    const tabLabels = await page.locator('.state-tab').allInnerTexts()
    assert(
      tabLabels.join(' | ') === 'Generated | AI Suggestions | Revised',
      `the tab strip reads "Generated | AI Suggestions | Revised" (got "${tabLabels.join(' | ')}")`,
    )
    assert(
      (await page.locator('.state-tab.active').innerText()) === 'Generated',
      'Generated is the default active tab',
    )
    assert(
      (await page.locator('.lesson-plan-content .ai-highlight').count()) === 0,
      'Generated (the working lesson) shows no highlighting before anything has been applied',
    )

    await switchToTab(page, 'AI Suggestions')
    assert(
      (await page.locator('[data-section-key="Assessment"] .ai-revised-tag').count()) === 0,
      'AI Suggestions (the working lesson) shows no "AI revised" tag on Assessment before it has been applied',
    )

    await switchToTab(page, 'Revised')
    assert(
      (await page.locator('[data-section-key="Assessment"] .ai-revised-tag').count()) === 1,
      'Revised already shows Assessment as revised — a predefined comparison, not gated behind Apply Change',
    )
    const revisedAssessmentTextUpfront = await page.locator('[data-section-key="Assessment"] > p').first().innerText()
    assert(
      revisedAssessmentTextUpfront.includes(PROPOSED_ASSESSMENT_TEXT),
      'Revised shows AI\'s own baseline revision of Assessment, matching what AI Suggestions recommends',
    )
    assert(
      (await page.locator('[data-section-key="Engage"] .ai-revised-tag').count()) === 1,
      'Revised also already shows Engage as revised — every suggested section, not just one the teacher happened to click',
    )
    assert(
      (await page.locator('[data-section-key="Materials"] .ai-highlight').count()) === 0,
      'Revised never highlights Materials — it has no AI suggestion, so nothing was ever recommended for it',
    )
    // Equipment & Technology is a bullet-list section with a suggestion —
    // Revised keeps its item structure rather than flattening to a
    // paragraph, with only the added item highlighted.
    const equipmentItems = page.locator('[data-section-key="Equipment & Technology"] .lesson-bullet-list li')
    assert((await equipmentItems.count()) >= 2, 'Revised keeps Equipment & Technology as a bullet list, not a flattened paragraph')
    assert(
      (await page.locator('[data-section-key="Equipment & Technology"] .ai-highlight').count()) === 1,
      'Revised highlights only the specific added bullet item in Equipment & Technology, not the whole list',
    )
    assert(
      (await page.locator('[data-section-key="Equipment & Technology"] .ai-revised-tag').count()) === 1,
      'Equipment & Technology carries the "AI revised" tag on Revised too',
    )

    // Clicking a Revised-tab section that's never been discussed must open
    // a real, freshly-seeded conversation — not fall back to the generic
    // planning chat because no prior chat state exists for it yet.
    await page.click('[data-section-key="Engage"] .ai-highlight')
    await page.waitForSelector('.revision-chat-panel')
    assert(
      (await page.locator('.revision-chat-panel h4').innerText()) === 'Engage',
      'clicking a never-discussed Revised section opens a proper conversation scoped to it, not a blank/generic panel',
    )
    const engageOpenerMessages = await page.locator('.revision-chat-thread .chat-message').allInnerTexts()
    assert(engageOpenerMessages.length >= 3, `the freshly-opened Engage conversation has its own multi-turn seed, got ${engageOpenerMessages.length}`)
    await page.click('.revision-chat-panel .drawer-close')

    // ====================================================================
    // PART 1: the full workflow on Assessment, via the flagged suggestion —
    // Ask AI about this (left chat opens) -> the proposed change is
    // immediately visible in full, with Apply Change as the only action ->
    // Apply Change updates the WORKING lesson (Suggestions/Generated) only.
    // ====================================================================
    await switchToTab(page, 'AI Suggestions')

    const assessmentFlag = page.locator('[data-section-key="Assessment"] .lesson-highlight-trigger.ai-highlight', {
      hasText: 'These questions are collected and added to a class Driving Question Board',
    })
    assert((await assessmentFlag.count()) === 1, 'Assessment shows its flagged AI-suggestion trigger before any change')

    await assessmentFlag.click()
    await page.waitForSelector('.suggestion-popover')
    await page.click('.suggestion-popover button:has-text("Ask AI about this")')
    await page.waitForSelector('.revision-chat-panel')
    assert(
      (await page.locator('.revision-chat-panel h4').innerText()) === 'Assessment',
      'the left chat is scoped to the Assessment section the teacher clicked',
    )
    assert(
      (await page.locator('.revision-chat-panel button:has-text("Preview Change")').count()) === 0,
      'there is no separate Preview Change button',
    )
    const proposalCardText = await page.locator('.revision-chat-panel .inline-ai-preview').innerText()
    assert(
      proposalCardText.includes('PROPOSED CHANGE') && proposalCardText.toUpperCase().includes('NOT YET APPLIED'),
      'the proposed-change card is labeled "PROPOSED CHANGE — NOT YET APPLIED"',
    )
    assert(
      proposalCardText.includes(PROPOSED_ASSESSMENT_TEXT),
      'the full proposed revised content is already visible in the card',
    )

    const assessmentParagraph = page.locator('[data-section-key="Assessment"] > p').first()
    assert(
      (await assessmentParagraph.innerText()).includes(ORIGINAL_ASSESSMENT_TEXT),
      'the working lesson (AI Suggestions) is untouched until Apply Change — only the left card shows the proposal',
    )

    await page.click('.revision-chat-panel .inline-ai-preview button:has-text("Apply Change")')
    await page.waitForSelector('[data-section-key="Assessment"] .ai-revised-tag')
    const afterFirstApply = await assessmentParagraph.innerText()
    assert(!afterFirstApply.includes(ORIGINAL_ASSESSMENT_TEXT), 'the original Assessment sentence is gone from the working lesson after Apply Change')
    assert(afterFirstApply.includes(PROPOSED_ASSESSMENT_TEXT), 'the applied Assessment text is now visible in the working lesson')
    assert(
      (await page.locator('.revision-chat-panel .inline-ai-applied-note').innerText()).includes('Applied to Lesson'),
      'the left chat status becomes "Applied to Lesson"',
    )

    // Only the two phrases AI actually added should be highlighted — the
    // surrounding original wording ("Students ask questions to clarify...",
    // "Look for: ...") must stay plain. This is the canned first apply, so
    // the added/plain split is exact, known data, not a guess.
    const assessmentOuterTrigger = page.locator('[data-section-key="Assessment"] .lesson-highlight-trigger').first()
    const assessmentOuterClass = (await assessmentOuterTrigger.getAttribute('class')) ?? ''
    assert(
      !assessmentOuterClass.split(' ').includes('ai-highlight'),
      'the outer clickable wrapper around Assessment is not itself a blanket highlight',
    )
    assert(
      (await page.locator('[data-section-key="Assessment"] .ai-highlight').count()) === 2,
      'exactly the two AI-added phrases are individually highlighted after the first (canned) apply',
    )

    // ====================================================================
    // PART 2: a follow-up produces a NEW proposal — applying it changes the
    // WORKING lesson further, so it now visibly diverges from Revised's
    // static baseline (which never changes). That divergence is the proof
    // the two tracks are actually independent, not just coincidentally
    // matching on the first apply.
    // ====================================================================
    await page.fill('.revision-chat-panel input[placeholder="Ask about this section..."]', 'Can you make this revision more focused on matter and energy flow?')
    await page.click('.revision-chat-panel button:has-text("Send")')
    await page.waitForSelector('.revision-chat-panel .inline-ai-preview')
    await page.click('.revision-chat-panel .inline-ai-preview button:has-text("Apply Change")')
    await page.waitForSelector('.revision-chat-panel .inline-ai-applied-note')

    const workingAssessmentText = await assessmentParagraph.innerText()
    assert(
      workingAssessmentText.toLowerCase().includes('matter') && workingAssessmentText.toLowerCase().includes('label each addition'),
      'the working lesson (AI Suggestions) now reflects the follow-up-refined proposal',
    )

    // The follow-up's new text extends (rather than replaces) the earlier
    // highlighting: the first apply's two added phrases are still
    // individually highlighted, PLUS the new follow-up suffix — three
    // highlighted spans total — while the true original wording remains
    // plain throughout, across both rounds.
    assert(
      (await page.locator('[data-section-key="Assessment"] .ai-highlight').count()) === 3,
      'after the follow-up round, three separate phrases are highlighted (two from the canned apply, one new) — not the whole section',
    )
    assert(
      workingAssessmentText.includes('Students ') && workingAssessmentText.includes('Look for:'),
      'the section\'s true original wording is still present, unhighlighted, after two rounds of applied changes',
    )

    await switchToTab(page, 'Revised')
    const revisedAssessmentTextAfter = await page.locator('[data-section-key="Assessment"] > p').first().innerText()
    assert(
      revisedAssessmentTextAfter.includes(PROPOSED_ASSESSMENT_TEXT) && !revisedAssessmentTextAfter.toLowerCase().includes('label each addition'),
      'Revised is UNCHANGED by the teacher\'s conversational follow-up — it still shows AI\'s own original baseline for Assessment, not what the teacher separately refined',
    )

    await switchToTab(page, 'Generated')
    const generatedAssessmentText = await page.locator('[data-section-key="Assessment"] > p').first().innerText()
    assert(
      generatedAssessmentText.toLowerCase().includes('matter') && generatedAssessmentText.toLowerCase().includes('label each addition'),
      'Generated (also the working lesson) reflects the same conversationally-applied text as AI Suggestions',
    )
    assert(
      (await page.locator('[data-section-key="Assessment"] .ai-revised-tag').count()) === 1,
      'Generated highlights the working-lesson change the same way AI Suggestions does',
    )

    await switchToTab(page, 'AI Suggestions')

    // ====================================================================
    // PART 2.5: a genuinely vague follow-up gets a clarifying question, and
    // a clear one ("make it more student-led") gets a fresh concrete
    // proposal — both act on the WORKING lesson only, same as before.
    // ====================================================================
    await page.fill('.revision-chat-panel input[placeholder="Ask about this section..."]', 'ok')
    await page.click('.revision-chat-panel button:has-text("Send")')
    await page.waitForTimeout(900)
    const vagueMessages = await page.locator('.revision-chat-thread .chat-message').allInnerTexts()
    assert(vagueMessages[vagueMessages.length - 1].trim().endsWith('?'), 'a too-vague follow-up gets a clarifying question back')

    await page.fill('.revision-chat-panel input[placeholder="Ask about this section..."]', 'Make it more student-led.')
    await page.click('.revision-chat-panel button:has-text("Send")')
    await page.waitForSelector('.revision-chat-panel .inline-ai-preview')
    const studentLedReply = (await page.locator('.revision-chat-thread .chat-message').allInnerTexts()).slice(-1)[0]
    assert(!studentLedReply.trim().endsWith('?'), 'a clear follow-up gets a concrete proposal back, not another question')
    assert(
      (await page.locator('.revision-chat-panel .inline-ai-applied-note').count()) === 0,
      'the new proposal is pending again until Apply Change is clicked once more',
    )

    // ====================================================================
    // PART 3: closing the chat returns the left AI Chat tab to the generic
    // planning conversation, not a blank panel.
    // ====================================================================
    await page.click('.revision-chat-panel .drawer-close')
    assert((await page.locator('.revision-chat-panel').count()) === 0, 'closing the conversation hides the revision chat panel')
    assert(
      (await page.locator('.planning-thread').count()) === 1,
      'the AI Chat tab falls back to the generic planning conversation once no section is being discussed',
    )

    await page.close()

    // ====================================================================
    // PART 4: every section with a flagged suggestion — not just
    // Assessment — is already pre-highlighted on Revised, and supports the
    // Ask AI about this -> Apply flow on AI Suggestions.
    // ====================================================================
    const page2 = await browser.newPage({ viewport: { width: 1440, height: 1300 } })
    await gotoLessonWorkspace(page2)

    await switchToTab(page2, 'Revised')
    for (const label of ALL_SECTION_LABELS) {
      assert(
        (await page2.locator(`[data-section-key="${label}"] .ai-revised-tag`).count()) === 1,
        `"${label}" is already pre-highlighted on Revised before any conversation`,
      )
    }

    await switchToTab(page2, 'AI Suggestions')
    const seenProposals = new Set()

    for (const label of ALL_SECTION_LABELS) {
      const flag = page2.locator(`[data-section-key="${label}"] .lesson-highlight-trigger.ai-highlight`)
      const flagCount = await flag.count()
      assert(flagCount >= 1, `"${label}" shows a flagged AI-suggestion trigger on AI Suggestions (got ${flagCount})`)

      const beforeText = await page2.locator(`[data-section-key="${label}"]`).first().innerText()

      await flag.first().click()
      await page2.waitForSelector('.suggestion-popover')
      await page2.click('.suggestion-popover button:has-text("Ask AI about this")')
      await page2.waitForSelector('.revision-chat-panel')

      assert(
        (await page2.locator('.revision-chat-panel h4').innerText()) === label,
        `the left chat is scoped to "${label}"`,
      )

      const messages = await page2.locator('.revision-chat-thread .chat-message').allInnerTexts()
      assert(messages.length >= 3, `"${label}" has its own multi-turn mock conversation (opener + teacher + AI), got ${messages.length}`)
      const aiProposalMessage = messages[messages.length - 1]
      assert(!seenProposals.has(aiProposalMessage), `"${label}"'s AI proposal is distinct from every other section's`)
      seenProposals.add(aiProposalMessage)

      assert(
        (await page2.locator('.revision-chat-panel .inline-ai-preview button:has-text("Apply Change")').count()) === 1,
        `"${label}" offers Apply Change immediately, with the proposal already visible`,
      )
      await page2.click('.revision-chat-panel .inline-ai-preview button:has-text("Apply Change")')
      await page2.waitForSelector(`[data-section-key="${label}"] .ai-revised-tag`)

      const afterText = await page2.locator(`[data-section-key="${label}"]`).first().innerText()
      assert(afterText !== beforeText, `"${label}" section text actually changed in the working lesson after Apply Change`)

      // Only the part AI actually added should carry .ai-highlight — never
      // the section's original wording. The outer clickable wrapper itself
      // must not be a blanket highlight once we have that finer-grained
      // information (Crosscutting Concept applies straight from the canned
      // proposal, so this is exact, not a same-text coincidence).
      if (label === 'Crosscutting Concept') {
        const outerTrigger = page2.locator('[data-section-key="Crosscutting Concept"] .lesson-highlight-trigger').first()
        const outerClass = (await outerTrigger.getAttribute('class')) ?? ''
        assert(!outerClass.split(' ').includes('ai-highlight'), 'the outer clickable wrapper is not itself a blanket highlight once the added part is known')
        const highlightedSpans = page2.locator('[data-section-key="Crosscutting Concept"] .ai-highlight')
        assert((await highlightedSpans.count()) === 1, 'exactly one highlighted span — the added sentence — not the whole section')
        const highlightedText = await highlightedSpans.first().innerText()
        assert(
          highlightedText.trim().startsWith('This lesson asks students to distinguish peat'),
          `the highlighted span is the added sentence itself, got: "${highlightedText}"`,
        )
        assert(
          afterText.includes('Energy and Matter: Flows, Cycles, and Conservation.'),
          'the original sentence is still present in the section text',
        )
        const originalSentenceSpan = page2.locator('[data-section-key="Crosscutting Concept"] .lesson-highlight-trigger', {
          hasText: 'Energy and Matter: Flows, Cycles, and Conservation.',
        })
        assert(
          !(await originalSentenceSpan.locator('.ai-highlight', { hasText: 'Energy and Matter' }).count()),
          'the original sentence itself is never wrapped in .ai-highlight',
        )
      }

      // Re-clicking the now-applied, highlighted text re-opens its
      // conversation directly — no intermediate popup.
      await page2.click(`[data-section-key="${label}"] .lesson-highlight-trigger`)
      await page2.waitForSelector('.revision-chat-panel')
      assert(
        (await page2.locator('.revision-chat-panel h4').innerText()) === label,
        `re-clicking "${label}"'s applied text re-opens its own conversation`,
      )
    }

    await page2.close()

    // ====================================================================
    // PART 5: a freeform selection on a section with no pre-flagged
    // suggestion (Standards) can still start a conversation on the left —
    // just with no proposed-change card until the AI actually has
    // something concrete to propose, and nothing shown on Revised.
    // ====================================================================
    const page3 = await browser.newPage({ viewport: { width: 1440, height: 1400 } })
    await gotoLessonWorkspace(page3)

    await switchToTab(page3, 'Revised')
    assert(
      (await page3.locator('[data-section-key="Standards"] .ai-highlight').count()) === 0,
      'Standards has no AI suggestion, so Revised never highlights it',
    )

    await switchToTab(page3, 'AI Suggestions')

    assert(
      (await page3.locator('.lesson-section-heading', { hasText: 'Standards & Learning Objectives' }).count()) === 1,
      'Standards & Learning Objectives renders its own group heading',
    )
    const objectiveChecks = [
      ['Learning Objective 1', '1.A'],
      ['Learning Objective 2', '1.B'],
      ['Learning Objective 3', '1.C'],
    ]
    for (const [label, prefix] of objectiveChecks) {
      const container = page3.locator(`[data-section-key="${label}"]`)
      assert((await container.count()) === 1, `"${label}" is its own independently addressable component`)
      const text = await container.innerText()
      assert(text.trimStart().startsWith(prefix), `"${label}" displays as a numbered item ("${prefix}")`)
    }

    const materialsItems = await page3.locator('[data-section-key="Materials"] .lesson-bullet-list li').count()
    assert(materialsItems === 5, `Materials renders as ${materialsItems} individual bullet points (expected 5)`)
    assert(
      (await page3.locator('[data-section-key="Materials"] .ai-highlight').count()) === 0,
      'Materials never shows a blanket (or any) AI highlight — it is plain existing content',
    )

    const standardsPara = page3.locator('[data-section-key="Standards"] > p').first()
    await standardsPara.scrollIntoViewIfNeeded()
    await standardsPara.evaluate((el) => {
      const range = document.createRange()
      range.selectNodeContents(el)
      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })
    await page3.waitForSelector('.selection-ask-popup')
    await page3.click('.ask-ai-chip')
    await page3.waitForSelector('.revision-chat-panel')
    assert(
      (await page3.locator('.planning-tab.active').innerText()) === 'AI Chat',
      'a freeform selection also switches the left workspace to AI Chat',
    )
    const standardsOpener = await page3.locator('.revision-chat-thread .chat-message').first().innerText()
    assert(standardsOpener.includes('NGSS HS-LS2-3'), 'contextual "Ask AI about this" works on Standards, scoped to its own selected text')
    assert(
      (await page3.locator('.revision-chat-panel .inline-ai-preview').count()) === 0,
      'Standards has no canned proposal, so no proposed-change card or Apply Change is offered for it',
    )

    // ====================================================================
    // PART 6: manual "Edit Lesson" still works independently per section,
    // and its edits win over both tracks — including on Revised.
    // ====================================================================
    await page3.click('button:has-text("Edit Lesson")')
    await page3.waitForTimeout(100)
    await page3
      .locator('[data-section-key="Learning Objective 2"] textarea')
      .fill('Use evidence to explain how matter and energy move through the zombie fire system.')
    await page3.click('button:has-text("Save Edits")')
    await page3.waitForTimeout(100)
    const objective2Text = await page3.locator('[data-section-key="Learning Objective 2"]').innerText()
    assert(
      objective2Text.includes('Use evidence to explain how matter and energy move through the zombie fire system.'),
      'Learning Objective 2 is independently editable via Edit Lesson, without affecting its siblings',
    )
    const objective1TextAfterEdit = await page3.locator('[data-section-key="Learning Objective 1"]').innerText()
    assert(
      objective1TextAfterEdit.includes('Obtain information about zombie fires'),
      'editing Learning Objective 2 does not affect Learning Objective 1',
    )
    const materialsTextAfterEdit = await page3.locator('[data-section-key="Materials"]').innerText()
    assert(
      materialsTextAfterEdit.includes('Zombie fire photographs and a short video clip'),
      'editing Learning Objective 2 does not affect Materials',
    )

    // Manually editing Assessment (which DOES carry a canned baseline)
    // while on AI Suggestions must override that baseline on Revised too.
    // Save Edits above already exited editing mode, so re-enter it.
    await page3.click('button:has-text("Edit Lesson")')
    await page3.waitForTimeout(100)
    await page3
      .locator('[data-section-key="Assessment"] textarea')
      .fill('Students write down one question they still have about zombie fires.')
    await page3.click('button:has-text("Save Edits")')
    await page3.waitForTimeout(100)
    await switchToTab(page3, 'Revised')
    const revisedAssessmentAfterManualEdit = await page3.locator('[data-section-key="Assessment"]').innerText()
    assert(
      revisedAssessmentAfterManualEdit.includes('Students write down one question they still have about zombie fires.'),
      'a manual edit overrides even Revised\'s predefined baseline for that section',
    )
    assert(
      (await page3.locator('[data-section-key="Assessment"] .ai-highlight').count()) === 0,
      'a manually-edited section shows no AI highlight on Revised, either — it is the teacher\'s own final wording',
    )

    await page3.close()

    assert(consoleErrors.length === 0, `no console errors (saw: ${JSON.stringify(consoleErrors)})`)

    log('ALL CHECKS PASSED')
  } finally {
    if (browser) await browser.close()
    stopServer(server)
  }
}

function stopServer(server) {
  if (!server.pid) return
  if (process.platform === 'win32') {
    // spawn(..., { shell: true }) wraps the process in cmd.exe, so a plain
    // server.kill() only kills the shell, leaving vite running. Kill the
    // whole process tree instead.
    spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' })
  } else {
    server.kill()
  }
}

run().catch((err) => {
  console.error(`[e2e] ${err.message}`)
  process.exit(1)
})
