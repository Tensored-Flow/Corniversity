# Decisions
- 2026-11-12: User explicitly selected full completion of all five courses, accepting longer duration.
- Selected CHE-101, PHY-210, MAT-230, MAT-261, CSA-210. Preserve their existing promises and canonical IDs.
- Adapt build-brilliant-courses pedagogy to Corniversity existing schema and long-form format; do not introduce a second course engine or forced micro-lessons.

## Ownership refinement
Science author owns CHE-101 and CSA-210. Lead owns PHY-210 units 09–10; a separate writer will own PHY-210 units 01–08 when the engine slot is free. No concurrent edits within a unit.

## Renderer repair within scope
Executable CS examples revealed renderMarkdown split blank lines inside fenced code, producing multiple code blocks and prose. Lead owns markdown.ts/test for a narrow parser-boundary repair. A regression reproduced the defect before repair; existing sanitisation/math/environment tests retained.
