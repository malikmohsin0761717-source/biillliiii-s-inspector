# Decisions feature implementation patch

## Added
- Optional decision reason (up to 2,000 characters).
- Edit existing decision text and reason.
- Delete a selected decision after an explicit confirmation.
- `updatedAt` timestamp when a decision is edited.
- Decision reason and edit timestamp in the Markdown project export.
- Existing decisions without a reason remain compatible.
- All decision operations remain scoped to the selected project and protected by the existing authenticated project API boundary.

## Validation
- `node --check server.js` — PASS.
- `node --check ui/app.js` — PASS.
- `node --test tests/decisions-feature.test.js` — expected to validate source/UI wiring.

## Integration limitation
This patch was prepared from the supplied v0.5.5 patch set. The complete current development folder and the separately reported v0.5.6 Checklist patch were not supplied in this turn. Therefore do not replace the user's current `server.js` or `ui/app.js` wholesale until the v0.5.6 changes are merged/reconciled. The API/UI integration suite also requires the missing base `monitoring/` and `data/` project files.
