# Writing spec for balivillas.ai guides (read fully before writing)

You write English-language SEO guides for balivillas.ai, a Bali villa management company that self-manages 20 private pool villas (Sanur, Canggu, Umalas, Ungasan), rents them daily/monthly/yearly by direct booking, sells villas, and manages villas for owners. Audience: international English readers searching Google.

Facts: read `content/blog/_facts.md` first. The plan row for each article (h1 draft, primary query, secondary queries, audience, user task, difference from neighbours, commercial target, related articles, facts_needed) is in `content/blog/_plan.tsv` (tab-separated; columns in the header row).

## File
One file per article: `content/blog/<hub>/<slug>.md` (hub and slug exactly as in the plan). UTF-8, LF.

```
---
page_id: P123
title: <50–62 characters, no brand suffix, the primary query worded naturally, a concrete promise>
description: <135–158 characters, contains the primary query naturally, says what the reader gets, ends with a reason to click>
h1: <the question or promise, 4–10 words, may differ from title>
lead: <one sentence, 20–35 words, the direct answer or the promise; shown under the H1>
primary_query: <from plan>
secondary_queries: <from plan, semicolon separated, you may add 1–3 more natural variants>
commercial_target: <from plan, e.g. /villa-management/>
related: <3–5 items "hub/slug" separated by "; " — must exist in _plan.tsv; prefer the plan's related_articles>
updated: 2026-09-18
priority: <from plan>
facts_to_verify: <semicolon-separated list of every specific legal/tax/visa figure, deadline or price you mention; "none" if none>
---
<body markdown>
```

## Body
- 1,300–2,000 words of main text (not counting FAQ). Depth over length; no padding.
- First two paragraphs answer the question directly (the reader should be able to stop there). Then the detail.
- 5–8 `##` H2 sections with specific, descriptive headings (not "Introduction", not "Conclusion"). Use `###` H3 only where an H2 really splits into sub-points. Do not repeat the primary query in every heading; each heading names a distinct sub-task.
- Include at least one markdown table where a comparison, checklist, cost breakdown or timeline helps. Include one bulleted checklist or step list where it fits the task.
- Use the primary query naturally 2–4 times in the body (once in the first 100 words) and each secondary query or a close paraphrase at least once where it fits. Never stuff; never write a sentence only to hold a keyword.
- Voice: "we" = The Host Bali team who manage villas in Bali; practical, direct, honest, no marketing fluff, no exclamation marks, no "in this article we will". British/international English. Short paragraphs (2–4 sentences). Contractions fine.
- Internal links in markdown: 2–4 links to commercial pages from the facts sheet (always the plan's commercial_target at least once, in a sentence where it helps, e.g. "our villas in Sanur"), plus 3–5 links to related guides as `/blog/<hub>/<slug>/` using slugs from `_plan.tsv` only. Anchor text = descriptive words, not "click here". Link to specific villa pages from the facts sheet when a concrete example helps (max 3).
- External links: at most 2, only to official sources (imigrasi.go.id, pajak.go.id, oss.go.id, kemenparekraf, BPS, a court/ministry site). No links to competitors or OTAs.
- Do not invent: no statistics, occupancy figures, survey results, "studies show", named clients, testimonials, case studies with numbers, exact fees or tax rates you are not sure about. Prices and rents: indicative ranges with "typically" / "indicative" and what drives them. Where a figure is legal/tax/visa, add "(as of 2026, verify)" and put it in facts_to_verify. When a rule changed recently or is unclear, say so and tell the reader what to check with whom.
- End the body with a short "What to do next" H2 (2–5 sentences + a list of 2–3 next steps) that leads to the commercial target. Do not write a CTA banner yourself; the template inserts it.
- Then a `## FAQ` section: 4–6 `### question?` headings, each followed by a 40–90 word answer paragraph. Questions should be real search phrasings from the secondary queries or "People also ask" style; do not repeat H2 content verbatim.

## Quality bar
- The plan's title/description/h1 are drafts: rewrite them to be specific and human. Titles must not all follow one pattern.
- Each article must be clearly different from its sibling named in difference_from_neighbours; link to that sibling once and say what it covers.
- Prefer explaining mechanisms, decision criteria, what to check, what goes wrong, what we do in practice, over generic lists.
- Run `python3 tools/blog/build.py --check` from the repo root when your batch is done and fix every problem it reports for your files (length, headings, FAQ count, dead links, title/description length).
