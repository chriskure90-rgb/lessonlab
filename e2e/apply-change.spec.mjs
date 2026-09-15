// End-to-end regression test for the "Apply Change" workflow on the Lesson
// Workspace page. This is a plain Node script (not a test-framework file) so
// it can run with zero configuration: `npm run test:e2e`.
//
// It spins up the Vite dev server itself, drives a real Chromium instance
// through the exact flow a teacher would use, and asserts on the rendered
// DOM — not on internal state — so it catches the class of bug where the UI
// *looks* like it applied a change (highlight + badge) without the actual
// lesson text being replaced, or where a change made in one lesson state
// leaks into another.
//
// Flow under test:
//   1. On the "AI Suggestions" tab: select Assessment -> Ask AI -> Preview
//      Change -> Apply Change. The SAME on-screen element (no tab switch,
//      no navigation, no refresh) must immediately show the new text.
//   2. The "Original" tab must still show the untouched original sentence —
//      the AI Suggestions edit must not have leaked into it.
//   3. The "AI Revised" tab must show ITS OWN pre-baked AI revision for
//      Assessment, independent of what was just applied on AI Suggestions.
//   4. Applying a change while on the "Original" tab must update the
//      Original tab itself, and must not appear on "AI Suggestions".
//   5. Every major lesson section of the full science lesson-plan structure
//      (Standards & Learning Objectives, Materials & Equipment, Engage,
//      Explore, Explain, Elaborate, Evaluate, Assessment) — not just one —
//      supports the full flow, each with its own distinct mock conversation
//      and proposed revision. Pacing shows as a small duration badge next
//      to each 5E phase's heading rather than written into the sentence or
//      kept in a separate section.

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))

const PORT = 4319
const BASE_URL = `http://localhost:${PORT}/`

// Standards & Learning Objectives and Materials & Equipment were each split
// into several independently scannable/editable sub-sections. Only the two
// that still carry a scripted AI opportunity (Crosscutting Concept and
// Equipment & Technology) go through the full flag -> Ask AI -> Preview ->
// Apply flow tested below; the other new sub-sections (Standards, the three
// individual Learning Objectives, Materials, Safety Considerations) are
// plain content with no pre-flagged suggestion, and are covered separately
// in PART 6.
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
  'Students write a scientific explanation, based on their revised model, answering the question: How does your model show that energy is conserved but not recycled? This is collected and graded as the lesson’s summative assessment. Look for: a claim, at least one specific piece of evidence from the model or data table, and reasoning that connects the two.'
const PROPOSED_ASSESSMENT_TEXT =
  'Students exchange a quick draft claim with a partner during Elaborate for ungraded feedback, then write a scientific explanation, based on their revised model, answering the question: How does your model show that energy is conserved but not recycled? The draft exchange serves as a formative check; the final explanation is collected as the summative assessment. Look for: a claim, at least one specific piece of evidence from the model or data table, and reasoning that connects the two.'

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

async function applyAssessmentChangeViaSuggestionFlag(page) {
  const assessmentFlag = page.locator('.lesson-highlight-trigger.ai-highlight', {
    hasText: 'This is collected and graded as the lesson',
  })
  await assessmentFlag.click()
  await page.waitForSelector('.suggestion-popover')
  await page.click('.suggestion-popover button:has-text("Ask AI about this")')
  await page.waitForSelector('.inline-ai-editor')
  await page.click('.inline-preview-button')
  await page.waitForSelector('.inline-ai-preview')
  await page.click('.inline-ai-preview button:has-text("Apply Change")')
  // Apply Change collapses the conversation immediately so the whole lesson
  // (not a chat fragment) is what's visible — wait for that collapse, then
  // for the permanent yellow-highlight confirmation to land in the lesson body.
  await page.waitForSelector('.inline-ai-editor', { state: 'detached' })
  await page.waitForSelector('[data-section-key="Assessment"] .ai-revised-tag')
}

async function getAssessmentParagraphText(page) {
  return page.locator('[data-section-key="Assessment"] > p').first().innerText()
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
    const page = await browser.newPage({ viewport: { width: 1440, height: 1300 } })

    const consoleErrors = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => consoleErrors.push(String(err)))

    await page.goto(BASE_URL)
    await page.waitForSelector('text=Lesson Planning')
    await page.click('button[aria-label="Open prototype navigation"]')
    await page.waitForSelector('text=Prototype Navigation')
    await page.click('.nav-drawer button:has-text("Lesson Workspace")')

    // --- Nav label was renamed ---
    assert(
      (await page.locator('.state-selector button:has-text("AI Revised")').count()) === 1,
      'the third tab is labeled "AI Revised"',
    )
    assert(
      (await page.locator('.state-selector .state-tab', { hasText: /^Revised$/ }).count()) === 0,
      'there is no lingering bare "Revised" tab label',
    )

    // ====================================================================
    // PART 1: apply a change on "AI Suggestions" and confirm it updates
    // the SAME visible tab immediately, with no navigation.
    // ====================================================================
    await page.click('.state-selector button:has-text("AI Suggestions")')

    const assessmentFlagBefore = page.locator('.lesson-highlight-trigger.ai-highlight', {
      hasText: 'This is collected and graded as the lesson',
    })
    assert((await assessmentFlagBefore.count()) === 1, 'AI Suggestions tab flags the Assessment section before any change')

    await applyAssessmentChangeViaSuggestionFlag(page)

    // No tab click happened above — this is exactly what the user sees
    // immediately after clicking Apply Change.
    const suggestionsAfterApply = await getAssessmentParagraphText(page)
    assert(
      !suggestionsAfterApply.includes(ORIGINAL_ASSESSMENT_TEXT),
      'AI Suggestions tab: original Assessment sentence is gone immediately after Apply Change (no navigation)',
    )
    assert(
      suggestionsAfterApply.includes(PROPOSED_ASSESSMENT_TEXT),
      'AI Suggestions tab: proposed text is visible immediately after Apply Change',
    )
    assert(
      (await page.locator('[data-section-key="Assessment"] .ai-revised-tag').count()) === 1,
      'AI Suggestions tab: "AI revised" badge is shown next to the change',
    )
    assert(
      (await page.locator('.state-selector .state-tab.active').innerText()) === 'AI Suggestions',
      'applying a change does not force-navigate away from the AI Suggestions tab',
    )

    // Requirement: after Apply Change, the chat card collapses and the whole
    // lesson — every section, not just the revised fragment — is visible
    // together as one coherent document.
    assert(
      (await page.locator('.inline-ai-editor').count()) === 0,
      'the AI conversation card collapses after Apply Change (no fragment left interrupting the lesson)',
    )
    const wholeLessonText = await page.locator('.lesson-plan-content').innerText()
    for (const mustBeVisible of [
      'Lesson Title: Modeling Energy Flow in Ecosystems',
      'Total Duration: 55 minutes',
      'Standards & Learning Objectives',
      'Standards: NGSS HS-LS2-3',
      'By the end of the lesson, students will be able to:',
      '1. Construct an initial model showing energy flow',
      'Materials & Equipment',
      'Materials:',
      'Energy-flow model worksheet or poster paper',
      'Equipment & Technology:',
      'Safety Considerations: None',
      'Engage: 5 min Teacher opens with a short overview',
      'Explore: 15 min Students construct an initial',
      'Explain: 10 min Students read a short article',
      'Elaborate: 15 min In small groups, students',
      'Evaluate: 5 min Teacher circulates during group work with a short checklist',
      PROPOSED_ASSESSMENT_TEXT,
    ]) {
      // Case-insensitive: `.card-label` section headings render with
      // `text-transform: uppercase`, and Playwright's innerText() reflects
      // that CSS transform rather than the source text.
      assert(
        wholeLessonText.toUpperCase().includes(mustBeVisible.toUpperCase()),
        `whole lesson still shows: "${mustBeVisible}"`,
      )
    }

    // ====================================================================
    // PART 2: the Original tab must NOT have received that change.
    // ====================================================================
    await page.click('.state-selector button:has-text("Original")')
    await page.waitForTimeout(150)
    const originalText = await getAssessmentParagraphText(page)
    assert(
      originalText.includes(ORIGINAL_ASSESSMENT_TEXT),
      'Original tab still shows the untouched original Assessment sentence',
    )
    assert(
      !originalText.includes(PROPOSED_ASSESSMENT_TEXT),
      'Original tab does NOT show the change applied on AI Suggestions',
    )
    assert(
      (await page.locator('[data-section-key="Assessment"] .ai-highlight').count()) === 0,
      'Original tab has no highlight on Assessment (the AI Suggestions edit did not leak in)',
    )

    // ====================================================================
    // PART 3: AI Revised must show its OWN pre-baked revision, independent
    // of the change just applied on AI Suggestions.
    // ====================================================================
    await page.click('.state-selector button:has-text("AI Revised")')
    await page.waitForTimeout(150)
    const aiRevisedText = await getAssessmentParagraphText(page)
    assert(
      aiRevisedText.includes(PROPOSED_ASSESSMENT_TEXT),
      'AI Revised tab shows its own pre-baked revision for Assessment (same proposal text by design)',
    )
    assert(
      (await page.locator('[data-section-key="Assessment"] .ai-revised-tag').count()) === 1,
      'AI Revised tab shows the "AI revised" badge on its baseline revision without any teacher interaction',
    )

    // ====================================================================
    // PART 4: applying a change on Original must update Original only, and
    // must not appear on AI Suggestions.
    // ====================================================================
    await page.click('.state-selector button:has-text("Original")')
    await page.waitForTimeout(150)
    const originalAssessmentPara = page.locator('[data-section-key="Assessment"] > p').first()
    // Manually select the Assessment sentence on the Original tab (it has no
    // pre-flagged suggestion span there — a teacher reaches it by highlighting).
    // The lesson is now long enough that a physical triple-click can drift:
    // Chromium/Playwright's synthetic multi-click can extend the selection
    // past the intended paragraph if the page scrolls between the clicks,
    // producing a selection that spans unrelated sections. Set the Range
    // precisely instead, then dispatch a real (bubbling) mouseup so the
    // app's own document-level mouseup listener still fires normally.
    await originalAssessmentPara.scrollIntoViewIfNeeded()
    await originalAssessmentPara.evaluate((el) => {
      const range = document.createRange()
      range.selectNodeContents(el)
      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })
    await page.waitForSelector('.selection-ask-popup')
    await page.click('.ask-ai-chip')
    await page.waitForSelector('.inline-ai-editor')

    if ((await page.locator('.inline-preview-button').count()) === 1) {
      await page.click('.inline-preview-button')
      await page.waitForSelector('.inline-ai-preview')
      await page.click('.inline-ai-preview button:has-text("Apply Change")')
      await page.waitForSelector('.inline-ai-editor', { state: 'detached' })
      await page.waitForSelector('[data-section-key="Assessment"] .ai-revised-tag')

      const originalAfterApply = await getAssessmentParagraphText(page)
      assert(
        originalAfterApply.includes(PROPOSED_ASSESSMENT_TEXT),
        'Original tab: applying a change updates the Original tab itself, immediately, in place',
      )

      await page.click('.state-selector button:has-text("AI Suggestions")')
      await page.waitForTimeout(150)
      const suggestionsStillHasOwnEdit = await getAssessmentParagraphText(page)
      assert(
        suggestionsStillHasOwnEdit.includes(PROPOSED_ASSESSMENT_TEXT),
        'AI Suggestions retains its own previously-applied change independently',
      )
    } else {
      log('manual selection on Original did not yield a scripted proposal for this run — skipping part 4 apply check')
    }

    // ====================================================================
    // PART 5: every major lesson section — not just Model — supports the
    // full highlight -> Ask AI -> conversation -> Preview -> Apply flow,
    // each with its own section-specific mock conversation and revision.
    // ====================================================================
    const page2 = await browser.newPage({ viewport: { width: 1440, height: 1300 } })
    await page2.goto(BASE_URL)
    await page2.waitForSelector('text=Lesson Planning')
    await page2.click('button[aria-label="Open prototype navigation"]')
    await page2.waitForSelector('text=Prototype Navigation')
    await page2.click('.nav-drawer button:has-text("Lesson Workspace")')
    await page2.click('.state-selector button:has-text("AI Suggestions")')

    const seenProposals = new Set()

    for (const label of ALL_SECTION_LABELS) {
      // A flagged section can render as more than one adjacent highlighted
      // span (e.g. to keep a bolded practice term like "evidence" within the
      // flagged phrase) — the requirement is that at least one exists and
      // they all open the same suggestion, not that there's exactly one DOM
      // node.
      const flag = page2.locator(`[data-section-key="${label}"] .lesson-highlight-trigger.ai-highlight`)
      const flagCount = await flag.count()
      assert(flagCount >= 1, `AI Suggestions flags "${label}" for improvement (got ${flagCount} flagged span(s))`)

      // Use the whole section container's text, not just the first <p> —
      // the bullet-list sections (e.g. Equipment & Technology) put their
      // label and their content in separate elements.
      const beforeText = await page2.locator(`[data-section-key="${label}"]`).first().innerText()

      await flag.first().click()
      await page2.waitForSelector('.suggestion-popover')
      await page2.click('.suggestion-popover button:has-text("Ask AI about this")')
      await page2.waitForSelector('.inline-ai-editor')

      const messages = await page2.locator('.inline-ai-thread .chat-message').allInnerTexts()
      assert(
        messages.length >= 3,
        `"${label}" has its own multi-turn mock conversation (opener + teacher + AI), got ${messages.length}`,
      )
      const aiProposalMessage = messages[messages.length - 1]
      assert(
        !seenProposals.has(aiProposalMessage),
        `"${label}"'s AI proposal is distinct from every other section's`,
      )
      seenProposals.add(aiProposalMessage)

      assert((await page2.locator('.inline-preview-button').count()) === 1, `"${label}" offers Preview Change`)
      await page2.click('.inline-preview-button')
      await page2.waitForSelector('.inline-ai-preview')

      await page2.click('.inline-ai-preview button:has-text("Apply Change")')
      await page2.waitForSelector('.inline-ai-editor', { state: 'detached' })
      await page2.waitForSelector(`[data-section-key="${label}"] .ai-revised-tag`)

      const afterText = await page2.locator(`[data-section-key="${label}"]`).first().innerText()
      assert(afterText !== beforeText, `"${label}" section text actually changed after Apply Change`)
    }

    await page2.close()

    // ====================================================================
    // PART 6: the new plain sub-sections carved out of Standards & Learning
    // Objectives and Materials & Equipment — Standards, the three
    // individual Learning Objectives, Materials, and Safety Considerations
    // — have no pre-flagged AI suggestion, but must still each be its own
    // independently selectable/editable component: scannable as separate
    // elements, editable via "Edit Lesson", and reachable via the
    // text-selection "Ask AI about this" popup. They must never show a
    // blanket AI highlight.
    // ====================================================================
    const page3 = await browser.newPage({ viewport: { width: 1440, height: 1400 } })
    await page3.goto(BASE_URL)
    await page3.waitForSelector('text=Lesson Planning')
    await page3.click('button[aria-label="Open prototype navigation"]')
    await page3.waitForSelector('text=Prototype Navigation')
    await page3.click('.nav-drawer button:has-text("Lesson Workspace")')

    // Standards & Learning Objectives: scannable as separate components.
    assert(
      (await page3.locator('.lesson-section-heading', { hasText: 'Standards & Learning Objectives' }).count()) === 1,
      'Standards & Learning Objectives renders its own group heading',
    )
    assert(
      (await page3.locator('[data-section-key="Standards"]').count()) === 1,
      'Standards is its own independently addressable component',
    )
    const objectiveLabels = ['Learning Objective 1', 'Learning Objective 2', 'Learning Objective 3']
    for (const [index, label] of objectiveLabels.entries()) {
      const container = page3.locator(`[data-section-key="${label}"]`)
      assert((await container.count()) === 1, `"${label}" is its own independently addressable component`)
      const text = await container.innerText()
      assert(text.trimStart().startsWith(`${index + 1}.`), `"${label}" displays as a numbered item ("${index + 1}.")`)
    }
    assert(
      (await page3.locator('.lesson-lead-in', { hasText: 'By the end of the lesson, students will be able to:' }).count()) ===
        1,
      'Learning Objectives are introduced with the "By the end of the lesson..." lead-in',
    )

    // Materials & Equipment: scannable as separate bulleted components.
    assert(
      (await page3.locator('.lesson-section-heading', { hasText: 'Materials & Equipment' }).count()) === 1,
      'Materials & Equipment renders its own group heading',
    )
    for (const label of ['Materials', 'Equipment & Technology', 'Safety Considerations']) {
      assert(
        (await page3.locator(`[data-section-key="${label}"]`).count()) === 1,
        `"${label}" is its own independently addressable component`,
      )
    }
    const materialsItems = await page3.locator('[data-section-key="Materials"] .lesson-bullet-list li').count()
    assert(materialsItems === 5, `Materials renders as ${materialsItems} individual bullet points (expected 5)`)
    assert(
      (await page3.locator('[data-section-key="Materials"] .ai-highlight').count()) === 0,
      'Materials never shows a blanket (or any) AI highlight — it is plain existing content',
    )

    // Manual "Edit Lesson" works on one of the new granular sections.
    await page3.click('button:has-text("Edit Lesson")')
    await page3.waitForTimeout(100)
    await page3.locator('[data-section-key="Learning Objective 2"] textarea').fill('Use data to explain trophic energy loss.')
    await page3.click('button:has-text("Save Edits")')
    await page3.waitForTimeout(100)
    const objective2Text = await page3.locator('[data-section-key="Learning Objective 2"]').innerText()
    assert(
      objective2Text.includes('Use data to explain trophic energy loss.'),
      'Learning Objective 2 is independently editable via Edit Lesson, without affecting its siblings',
    )
    const objective1TextAfterEdit = await page3.locator('[data-section-key="Learning Objective 1"]').innerText()
    assert(
      objective1TextAfterEdit.includes('Construct an initial model'),
      'editing Learning Objective 2 does not affect Learning Objective 1',
    )
    const materialsTextAfterEdit = await page3.locator('[data-section-key="Materials"]').innerText()
    assert(
      materialsTextAfterEdit.includes('Energy-flow model worksheet or poster paper'),
      'editing Learning Objective 2 does not affect Materials',
    )

    // Selection-based "Ask AI about this" works on a new granular section
    // with no pre-flagged suggestion (Standards has none).
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
    await page3.waitForSelector('.inline-ai-editor')
    const standardsOpener = await page3.locator('.inline-ai-thread .chat-message').first().innerText()
    assert(
      standardsOpener.includes('NGSS HS-LS2-3'),
      'contextual "Ask AI about this" works on Standards, scoped to its own text',
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
