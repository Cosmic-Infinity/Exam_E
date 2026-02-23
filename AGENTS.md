# AGENTS.md

## Project Overview

This repository contains a **university‑level paper evaluation and student view system**. The system is in **active development** and is being built for the first time. Expect rapid iteration and frequent changes across the codebase.

---

## Development Guidelines for Agents

### 1. No Backwards Compatibility Required

- Backwards compatibility is **not** a requirement at this stage.
- If a change introduces **system‑breaking behavior**, you must:
  - Warn the user immediately.
  - Remind them to inform the team group so everyone can adjust accordingly.

---

### 2. Database Policy

- The database is **regularly nuked and repopulated** with test data.
- Do not rely on persistent records.
- Avoid assumptions about long‑term stored state.

---

### 3. Documentation Requirements

- Documentation must be kept **up to date** with the implementation.
- If you detect any discrepancy between:
  - the documentation, and
  - the current code or system behavior,  
    you must notify the user immediately.

---

### 4. Communication Expectations

- When generating or modifying system‑level features, remind the user to:
  - Communicate breaking changes in the group.
  - Ensure all contributors are aware of updates that may affect workflows.
