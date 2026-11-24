# v0.5.1 Test Isolation Fix

- Test subprocesses now explicitly use their own temporary `data` directory, overriding an inherited `BI_DATA_DIR`.
- Temporary test fixtures exclude the developer's local `auth.json`, ensuring owner-setup tests begin unconfigured.
- No application runtime code or user workspace data is modified.
