# Project Decisions

## Decision 001: Use GitHub Pull Requests for Code Review

#### Date: 2026-10-23

#### Status: Accepted

#### Context: We have finalized the recurring meeting schedule, completed the CP1 discussion, and designated the code steward for the current phase. 

- Recurring meeting schedule: From 21:00 to 22:00, every Thursday.
- Current code steward recorded
  - Name: 林念慈（Veronica Lin）
  - GitHub: @NienTL
  - Responsibilities: Maintain code quality, coordinate code reviews, and document significant technical decisions.
- Update (2026-11-24): steward role handed over to 葉沛鑫 (@leafs2), see Decision 002.

---

## Decision 002: Code Steward Handoff to 葉沛鑫 (@leafs2)

#### Date: 2026-11-24

#### Status: Accepted

#### Context: Every member must serve as code steward at least once before CP2 (due 2026-11-29). 林念慈 has been steward since 2026-10-23 (Decision 001), so the team agreed to rotate the role.

- Previous steward: 林念慈（Veronica Lin）, GitHub @NienTL, 2026-10-23 to 2026-11-23
- New steward: 葉沛鑫, GitHub @leafs2, from 2026-11-24
- Responsibilities: review and merge PRs, leave at least one specific comment on every approval (file or line, plus a question, concern or suggestion), keep DECISIONS.md up to date, and write the merge plan before merge day.
- Decided by: whole team, 2026-11-24, in our LINE group

#### Handoff notes (from @NienTL to @leafs2)

- Open PRs: #24 AI_Usage_Guidelines v1.1 (author @ning415415, waiting for the rule 3 command update); #1 leaf-test from 2026-09-21 (test PR, to be closed without merging).
- A steward does not approve or merge their own PR; PRs by @leafs2 are reviewed by another member (as #23 was, by @ning415415).
- Since PR #18, every PR uses `.github/pull_request_template.md`. Check that "AI assistance" and "How I checked it" are filled in before approving.
- Open issues from the Week 12 Lab review: #19 prompt test for targeted malicious minutes, #20 README setup errors on a new machine, #21 hosted version. Owners and dates still to be assigned.
- Before CP2: write the merge plan entry in DECISIONS.md (every open branch and PR, merge order and why, expected conflicts, PRs to close, what "done" means that day).
- Other: To be added by @NienTL in review

---
