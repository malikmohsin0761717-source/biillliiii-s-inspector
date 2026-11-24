# v0.5.5 Startup Path Display Correction

- Replaced the hard-coded `data/projects.json` and `data/auth.json` startup text.
- Startup now prints the actual resolved workspace directory, project data file, and owner authentication file selected by `BI_DATA_DIR`.
- No data files, authentication values, project records, or monitoring files are changed.
- Added a regression test to prevent the old misleading fixed-path text from returning.
