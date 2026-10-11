# SIDIR — Recovery checkpoints

## Current protected checkpoint

- Date: 2026-10-11
- Purpose: last known working preview before utilities/service-layer modularization
- Commit: `6a04e26d74a15b1eecb8aa5a3c54483ce1fdc2dc`
- Backup branch: `backup/sidir-2026-10-11-pre-utils-services`
- Working branch: `fix/sidir-sep27-save-friday-bonus-messages`

The backup branch must remain unchanged. It is the rollback point if the modularization work introduces a regression.

## Working rule from this checkpoint onward

Before any structural refactor, data migration, authentication change, or production release:

1. verify the current working build;
2. record the exact commit SHA;
3. create a dedicated `backup/sidir-YYYY-MM-DD-<purpose>` branch;
4. do not continue until the backup branch resolves to the expected commit;
5. perform changes on a separate working branch;
6. never force-push or rewrite backup history;
7. merge only after automated verification plus the relevant manual acceptance test.

Small copy-only or documentation changes do not require a new recovery branch, but any change that can affect runtime behavior does.

## Rollback principle

A rollback restores code to a verified checkpoint. Database/schema rollback must be evaluated separately because additive migrations may remain compatible even if the UI code is restored. Destructive database rollback is never automatic.
