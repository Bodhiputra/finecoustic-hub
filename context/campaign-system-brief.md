# Campaign system — product brief

*Fine Hub / Marketing · 2026*

## Hierarchy

```
Campaign (e.g. "FBS launch")
├── [optional] Flow     — one per campaign; source of truth for dependencies
│   └── views: Flow | Board | List  (projections of the same tasks)
└── [optional] Board(s) — kanban-only workstreams (KOL, email, …)
    └── views: Board | List only (never becomes a flow)
```

## One-way rule

| Direction | Allowed |
|-----------|---------|
| Flow → Board / List | Yes — same tasks, different layout |
| Board / List → Flow | **No** |

## Flow workspace (core)

- **Tasks and milestones** are rows in one pool (`campaign_id` set, `board_id` null).
- **Flow view** — React Flow canvas: drag nodes, connect arrows, auto-save `flow_data`. Only tasks explicitly placed on the flow (via **Add task** / **Add milestone**) appear as nodes; the campaign pool can hold tasks visible in Board/List without being on the canvas.
- **Board view** — same tasks in status columns (todo → done); vertical order from flow graph.
- **List view** — same tasks, flat list, same flow order.
- Create via toolbar: **Add task** / **Add milestone** (not on-canvas creation).
- Delete node on canvas (Backspace/Delete) removes layout only — task row stays.
- Milestones use ◇ on flow, board, and list.

## Campaign list card

- **Add flow** — only if campaign has no flow yet (max one flow per campaign)
- **Add board** — anytime; multiple kanban-only boards OK
- Chips: `Flow` opens flow workspace; `{name} · Board` opens kanban board

## URLs (Marketing)

| Page | Query |
|------|--------|
| Campaign list | `?tool=campaigns` |
| Flow workspace | `?tool=campaigns&flow={campaignId}&cview=flow\|board\|list` |
| Kanban board | `?tool=campaigns&board={boardId}&cview=board\|list` |

`cview` = campaign sub-view (avoids clashing with department `view`).

## Tasks

| Context | `campaign_id` | `board_id` |
|---------|---------------|------------|
| Flow tasks | set | null |
| Kanban board tasks | set | set |

## Not built yet

- Flow sidebar task bank / drag-from-palette
- Board tool on individual flow nodes
- Collaborative flow editing (Yjs / Liveblocks)
- Assigner / assignee permissions (port from Appdev)
- Realtime polling + presence
