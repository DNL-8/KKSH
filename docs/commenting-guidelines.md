# Commenting And Docstring Guidelines

Purpose: keep code comments useful, short, and consistent across frontend/backend.

Rules:
- Prefer self-explanatory code over comments whenever possible.
- Add comments only when code intent is not obvious from names/structure.
- Describe *why* and constraints/tradeoffs, not obvious *what* statements.
- Keep comments in English for consistency in mixed-language teams.
- Keep comments near the relevant block and update/remove stale comments quickly.

Python docstrings:
- Use concise one-line summary first.
- Add Args/Returns only when behavior is not obvious.
- Document side effects and failure modes for service functions.

TypeScript/React comments:
- Avoid inline noise for trivial assignments.
- For hooks/effects, comment only when dependency choices are non-obvious.
- For accessibility behavior, document ARIA/keyboard rationale once per component.

Review checklist:
- Does the comment explain intent/constraint?
- Is it still true after this change?
- Can the code be renamed/refactored to remove the comment?
