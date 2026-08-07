# Task workflow (Phase 1)

Internal hub tasks use a **workflow-driven status model**. Status is not a free-form field.

## Roles

| Role | Definition |
|---|---|
| **Assigner** | `created_by` on the task. Fixed at creation; reassigning the assignee does not change the assigner. |
| **Assignee** | `assignee` field. If empty, the assigner acts as assignee. |

Matching uses case-insensitive display names (`personKey`).

## States

Default board columns: `todo` → `in_progress` → `in_review` → `done`.

| Transition | Who |
|---|---|
| `todo` → `in_progress` | Assignee (**Accept**) |
| `in_progress` → `in_review` | Assignee (**Request review**) |
| `in_review` → `done` | Assigner only (**Mark done**) |
| `in_review` → `in_progress` | Assigner only (**Send back**) |
| → `cancelled` | Assigner (or manager) |
| → `done` (direct) | Assigner only, and only from `in_review` |

Milestones and events keep their own status controls (scheduled / completed / cancelled).

## UI

- **Task panel:** read-only status label + role-based action buttons (no status picker).
- **Board drag:** same rules as API; failed moves show a toast.
- **Assignee:** select from active hub team members (not free text).

## API

`PATCH /api/v1/internal/tasks/:id`

- `{ workflow_action: "accept" | "request_review" | "approve" | "send_back" }` — preferred for panel buttons.
- `{ status: "..." }` — allowed when transition rules pass (e.g. board drag).
- Generic saves must not change `status`; panel strips status on save.

Validation lives in `lib/task-workflow.js` and `updateTask` in `lib/internal-data.js`.

## Later phases

- **Phase 2:** in-app notifications (assigned, review requested, done, send back).
- **Phase 3:** performance fixes; optional manager override when assigner is unavailable.
