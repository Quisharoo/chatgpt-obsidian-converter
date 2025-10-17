# ChatGPT → Markdown Converter

Convert ChatGPT exports to clean Markdown. Web UI + Python CLI. All processing stays local.

## Features
- Drag-and-drop web UI (browser-only; no uploads)
- Python script for batch and automation
- Clean Markdown with clear User/Assistant sections
- Duplicate detection by conversation ID
- Chronological processing (oldest first)
- Safe, readable filenames with de-duplication

## Quick start: Web UI
- Requirements: Node 16+
- Install and run:
  - npm install
  - npm run dev
- Export from ChatGPT (Settings → Data controls → Export)
- Drop conversations.json or the export ZIP into the app
- Download converted Markdown to a folder you choose

## Quick start: Python CLI
- Requirements: Python 3.6+
- Place conversations.json next to chatgpt_converter.py
- Run: python3 chatgpt_converter.py
- Output: ChatGPT/*.md (duplicate-safe filenames)

## Output
- One Markdown file per conversation
- Clear User/Assistant sections; created timestamp
- Preserves code blocks; removes citation artifacts
- Filenames are readable; duplicates get “(2)”, “(3)”, …

## Tests
- Web UI tests: npm run test
  - First time: npm run test:install
- Python tests: npm run test:python

## Privacy
- Web UI: 100% client-side; nothing leaves your machine
- Python: local file read/write only

## Repository
- Web UI: index.html, src/
- CLI: chatgpt_converter.py
- Tests: tests/, test-vite-react/
- Contributor rules: see AGENTS.md

## License
MIT