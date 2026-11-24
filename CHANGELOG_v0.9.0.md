# Biillliiii Inspector v0.9.0 — AI Workspace Completion

## Included
- AI Teacher learning goals: add, remove, and save up to 30 goals.
- AI Teacher completed lessons: add, remove, and save up to 100 lessons.
- Learning notes remain supported and are saved with goals and completed lessons through the existing owner-protected local progress endpoint.
- Saved Chatbot and Teacher conversations remain separate; each history entry now has an explicit delete action with confirmation.
- Added focused automated test cases for learning-progress controls, conversation deletion, and opt-in project context (not executed yet, per user instruction).
- Optional project context can be attached to a message in either AI mode. It is OFF by default and requires selecting a project, enabling the checkbox, and pressing Send to AI.
- Only project name, ID, type, goal, last completed task, next step, and up to 20 checklist items are included. Project notes, decisions, and session records are excluded.
- When selected, project context is saved in that conversation and may be included again when later requests send the conversation history.

## Privacy and scope
- No API key, `.env`, cloud credentials, or Supabase connection settings are added or enabled.
- Existing OpenAI disabled-by-default behavior is unchanged.
- No automatic project upload, monitoring, or external action is introduced.
- Existing local AI progress and conversation files are not deleted or migrated.

## Verification status
- Per user instruction, no tests or audit were run during this implementation phase.
- Full syntax, automated, security, storage, UI, and integration verification is deferred until all planned implementation work is complete.
