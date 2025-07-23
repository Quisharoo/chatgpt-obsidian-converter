# Purpose
This document guides AI agents working on this repository. Follow these notes to ensure contributions remain consistent and maintainable.

# Git Workflow and Branch Management
- **NEVER commit directly to `main`** - always use feature branches for all changes
- **Create descriptive branch names** using format: `feature/description`, `fix/description`, or `docs/description`
- **Always create pull requests** for code review and discussion, even for small changes
- **Test changes thoroughly** before creating PRs (run tests, check deployment if applicable)
- **Use clear, descriptive commit messages** that explain what and why, not just what
- **One logical change per commit** - avoid mixing unrelated changes
- **Clean up local branches** after merging (delete feature branches)
- **Pull latest main** before starting new work to avoid conflicts

# Deployment and Production Considerations
- **Test deployment configurations** in feature branches before merging
- **Validate that builds work locally** before pushing deployment changes
- **Consider both React and vanilla HTML versions** when making changes
- **Ensure Vercel configuration works** with the project structure
- **Monitor deployment status** after merges to catch issues early
- **Document deployment-specific changes** in commit messages

# Communication and Documentation
- **Explain the reasoning** behind architectural decisions
- **Ask for clarification** when requirements are ambiguous
- **Provide progress updates** for complex changes
- **Document breaking changes** clearly in PRs
- **Link related issues or PRs** when relevant
- **Update README.md** when adding significant features

# Code Quality Standards
- **Prioritize readability** over cleverness
- **Use consistent naming conventions** across the codebase
- **Write clear, concise comments** that explain why the code exists, not what it does—unless the what is non-obvious. Avoid restating the code. Focus on intent, assumptions, edge cases, and reasoning.
- **Follow existing patterns** rather than introducing new approaches
- **Consider performance implications** but don't over-optimize prematurely

# Allowed Capabilities
- Modify or add source files under `src/` and `test-vite-react/`.
- Update documentation and tests when implementing new features.
- Improve accessibility, performance, or code structure while keeping behaviour intact.
- Run `npm install` and `npm test` within `test-vite-react` to validate changes.

# Guardrails and Limitations
- Avoid introducing heavy or unnecessary dependencies.
- Prefer simple, readable solutions over cleverness or micro-optimisations.
- Do not break existing public APIs or change folder structure without good reason.
- Keep browser compatibility in mind; the plain HTML version should remain functional without a build step.

# Reasoning About Structure and Conventions
- Components and hooks live under `src/` or `test-vite-react/src/`.
- Tests reside under `test-vite-react/tests/` and `test-vite-react/src/` for component tests.
- Maintain separation of concerns: UI components, hooks, and data helpers should remain modular and reusable.
- Use semantic HTML, ARIA attributes, and keyboard navigation for accessibility.
- Follow SOLID principles and clean architecture: keep modules small and focused.

# Collaboration Patterns
- When adding features, also update or create tests that cover the new behaviour.
- When making meaningful changes (UI/UX, functionality, data structures), write new tests or update existing ones as appropriate.
- Refactoring should retain existing functionality; ensure tests continue to pass.
- Document any notable design decisions in the README or comments.

# Testing and Verification
- Run `npm install` once to install dev dependencies if necessary.
- Execute `npm test` from `test-vite-react` and ensure all suites pass.
- If new behaviour affects the plain HTML example, consider adding tests in `tests/index.test.js`.
- Run the test suite after every change to verify all tests pass.
- Write or update tests for every meaningful change to ensure reliability and prevent regressions.

# Repo Structure Overview
- `index.html` – standalone HTML app using `src/questionGenerator.js`.
- `src/` – shared logic for generating and managing questions.
- `test-vite-react/` – Vite + React app showcasing the same functionality with component tests.
- `test-vite-react/tests/` – integration tests for both versions and unit tests for utilities.
- `vercel.json` – deployment configuration for Vercel hosting.
- `package.json` – root workspace configuration for monorepo support. 