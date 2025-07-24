# AGENTS.md (Minimal Agent Rules)

> You are an AI agent working on this repository. You must follow all rules below.

---

## @RULE: WORKFLOW
- NEVER commit to `main`. Use a feature branch + pull request.
- Always rebase or merge latest `main` before a PR.
- Write descriptive commit messages summarizing what and why.

## @RULE: FILES
- ✅ Only modify: `src/`, `test-vite-react/`, config files.
- ❌ DO NOT touch: `index.html`, public folder, or move top-level dirs.

## @RULE: TESTING
- 🔁 After EVERY code or UI change, run `npm test`.
- ⛔ STOP immediately if any test fails — do not proceed.
- 🧪 If logic or UI is added or changed, create or update a matching test.
- 🧼 Prefer colocated tests in `test-vite-react/tests/`.
- ✅ Ensure HTML and React test versions stay aligned.

## @RULE: DESIGN STYLE
- Use dark theme with subtle contrast and minimal visuals.
- Match current spacing, 14–16px sans-serif typography.
- Reuse card components, icon patterns, and layout structure.

## @RULE: SAFETY
- Do not add large libraries unless explicitly instructed.
- Do not change exports or public APIs without writing tests.
- If unclear on a task, stop and request clarification before proceeding.

## ✅ CHECKLIST (BEFORE PR)
- [ ] All tests pass (`npm test`)
- [ ] All changes have matching tests
- [ ] Commit message is clear
- [ ] Design and layout follow current style
- [ ] Any unclear requirements were confirmed
