# Tasks — PricingAndOrderTime (Index)

This file exists alongside spec.md and plan.md for quick discovery. Detailed tasks are organized in the `tasks/` subfolder.

Task Locations (ID → file)
- T001–T002 → tasks/infra_tasks.md
- T003–T007 → tasks/testing_tasks.md
- T008, T016–T017, T019–T020 → tasks/service_tasks.md
- T011–T015 → tasks/database_tasks.md
- T018, T022 → tasks/interface_tasks.md
 - T016a → tasks/database_tasks.md
 - T016b → tasks/service_tasks.md
 - T016c, T016e → tasks/interface_tasks.md
 - T016d → tasks/testing_tasks.md

- Start here: `.Specs/PricingAndOrderTime/tasks/tasks.md` (domain index)
- Database: `.Specs/PricingAndOrderTime/tasks/database_tasks.md`
- Services: `.Specs/PricingAndOrderTime/tasks/service_tasks.md`
- Interface (API/Docs): `.Specs/PricingAndOrderTime/tasks/interface_tasks.md`
- Infra/Tooling: `.Specs/PricingAndOrderTime/tasks/infra_tasks.md`
- Testing: `.Specs/PricingAndOrderTime/tasks/testing_tasks.md`

Conventions
- IDs T001+ are global and stable; sub-tasks use dash suffixes (e.g., T011-01).
- Tests precede implementation; mark `[P]` only for independent files; include explicit dependencies.
