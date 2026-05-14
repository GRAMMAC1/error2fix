# @error2fix/cli

Post-failure terminal diagnosis CLI for `error2fix`.

This package owns the human-facing command line experience:

- Shell hook installation and cleanup.
- Local failure capture storage under `~/.e2f`.
- Latest failure inspection.
- Terminal and JSON formatting.

The CLI uses shell-generated captures as its data source. It does not require users to wrap commands with an `e2f run` flow.

