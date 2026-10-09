# AGENTS.md

## Project Overview

This repository contains a **university‑level paper evaluation and student view system**. The system is in **active development** and is being built for the first time. Expect rapid iteration and frequent changes across the codebase.

---

## Development Guidelines for Agents

### 1. No Backwards Compatibility Required
- Backwards compatibility is **not** a requirement at this stage.
- Although if a change introduces **system‑breaking behaviour**, you must:
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
- If you detect any discrepancy between the documentation, and the current code or system behaviour, you must notify the user immediately.

---

### 4. Communication Expectations
- When generating or modifying system‑level features, remind the user to:
  - Communicate breaking changes in the group.
  - Ensure all contributors are aware of updates that may affect workflows.

### 5. Environment details
 - Most of the team is developing on a Windows environment, but this application is being built to be deployed in Linux docker containers.
 - Remember to use appropriate shell commands accordingly.
 - One of the team members is on MacOS.

### 6. Mobile version considerations
 - The application has desktop and mobile views
 - The mobile version of the site can be found in `docker\frontend\src\app\pages\mobile`
 - Ensure that bug fixes/routing changes, if any, get applied to both the desktop and mobile versions.
 - DO NOT modify any UI features which already exist without explicit request of the developer. Although you may bring it to the attention of the developer if a certain feature isn't on par with the desktop version (and vice versa), i.e., flag discrepancies.
 - For new UI features added to the desktop version, you must confirm from the developer how to present them in mobile version, while providing suggestions regarding the same.


 ### 7. Testing credentials for API calls
 - Django admin : `admin@kiit.ac.in`, pass : `admin`
 - Faculty : id = `kavita.mishra@example.com`, pass : `Check@123`
 - Student : id = `2305101@kiit.ac.in`, pass : `Check@123`

 ### 8. UI Copy & End-User Standards
- Design exclusively for the end-user, never for the person prompting you.
- Zero "Proof-of-Work" Artifacts: Never include text, subtext, tags, or badges intended to prove you satisfied prompt instructions.
- Separate Logic from Copy: Functional or technical requirements (e.g., security, loaded models, database status) belong in code and architecture, not in visible UI copy unless explicitly requested, say, as an admin dashboard metric.
- Production Microcopy: Use standard, concise product copy (e.g., "Sign In" instead of "Protected Member Portal"; "Ready" instead of "Successfully integrated all 4 models").
- No Prompt Echoing: Do not reflect user prompts, instructions, or internal technical jargon back into public-facing component labels.
