# RFC 0016 — Space templates

- **Status:** Implemented — the guide is `plitzi-sdk-server/docs/templates.md`; delete this file once it is committed
- **Author:** Carlos Rodriguez
- **Date:** 2026-09-24
- **Scope:** `plitzi-sdk-server` (Prisma, REST API, seeds, the `plitziWebsite` and `plitziAuth` spaces), and one
  argument added to `@plitzi/sdk-mcp`'s preview

---

## 1. Summary

Any space can be offered as a **template**: a published snapshot of it (an environment, optionally a pinned revision)
that a new space starts as. The space's admin decides who can use it — only themselves, their workspace, or everyone.
Public templates go through platform review, and a reviewer can take them down again. Templates belong to a small set
of general categories. The dashboard gets a Template panel on the space page, a template picker when creating a space,
a filtered gallery on the home screen and a review queue. The public landing shows the public gallery, to get people
to sign up.

This is not the builder's **element templates**: small fragments of elements stored as resources on a CDN and dropped
into a page (`SpaceAddTemplateMutation`, `SegmentAddTemplateMutation`). Those are unchanged.

## 2. What exists today

- `src/services/templates` is a **code catalogue**: the demo specs in `prisma/mongo/seeds/spaces` (those with
  `template !== false`) are authored with `authorSpace` per request. `GET /spaces/templates` lists them, and
  `POST /spaces { template }` writes their documents into the new space.
- Three screens read that listing: the *Create Space* modal (`layoutContainer-2.ts`, a select), the home's "Start from
  a template" section (`home-authenticated.ts`) and the onboarding's "first space" step (`plitziAuth.ts`).
- Publishing (`SpacePublishMutation`) writes a Mongo `space` + `style` document tagged
  `{ environment, snapshot.revision }` and copies `SpaceAction` / `SpaceConnector` rows to that revision.
  `getOfflineData(spaceId, env, revision)` already reads a pinned revision.
- `SpaceCategory` exists (one row, "Others", `isDefault`), and `space.categoryId` points at it.

## 3. Decisions

| # | Decision |
|---|---|
| D1 | A template is a normal space. **One source**: the code catalogue is removed, and the seed turns the demo specs into public, approved templates in the database. |
| D2 | Visibility is `user` (the author, usable in any workspace they administer), `workspace` (members of the space's workspace, when creating inside that workspace), or `public` (everyone, including signed-out visitors browsing the gallery). |
| D3 | `public` needs **approval** by a platform admin (`adminManage`), who can also **revoke** it. Until then, the template works like a `workspace` one for its own workspace. |
| D4 | The source is a published **environment** (`development`, `staging`, `production`; **never `main`**, because the draft keeps changing) plus an optional **revision**. With no revision, the latest one in that environment is used. |
| D5 | A new space gets the **schema, the style, the actions and the connector manifests**. It does **not** get segments, plugins, uploaded resources or credentials. The author sees this warning when marking the space. |
| D6 | Categories reuse `SpaceCategory`: a short, global, seeded list with no editing UI. |
| D7 | Templates live in their own table (`space_template`), not in columns on `space`. |
| D8 | Signed-out visitors see the public gallery on the landing. Its call to action leads to sign-up. |

## 4. Data model

```prisma
enum TemplateVisibility {
  user
  workspace
  public
}

enum TemplateReviewStatus {
  none      // never asked to be public
  pending   // asked, not decided
  approved  // public, at `approvedRevision`
  rejected  // refused, with a note
  revoked   // was public, taken down, with a note
}

model SpaceTemplate {
  id               Int                  @id @default(autoincrement())
  spaceId          Int                  @unique @map("space_id")
  userId           Int?                 @map("user_id")          // the author; `user` visibility is theirs
  categoryId       Int                  @map("category_id")
  name             String               @db.VarChar(80)
  description      String               @default("") @db.VarChar(500)
  visibility       TemplateVisibility   @default(workspace)
  environment      String               @db.VarChar(255)
  revision         Int?                                           // null = latest in `environment`
  reviewStatus     TemplateReviewStatus @default(none) @map("review_status")
  approvedRevision Int?                 @map("approved_revision") // what the public gets
  reviewNote       String?              @map("review_note") @db.VarChar(500)
  reviewedBy       Int?                 @map("reviewed_by")
  reviewedAt       Int?                 @map("reviewed_at")
  createdAt        Int                  @map("created_at")
  updatedAt        Int                  @map("updated_at")
  // space: onDelete Cascade · author, reviewer: onDelete SetNull · category: restrict
}
```

**Why `approvedRevision` exists.** A reviewer approves what they looked at. If the template follows the latest
revision, the author could publish something else after approval, and the public would get unreviewed content. So
approval stores the revision it was given, and people outside the author's workspace always get that revision. The
author's own workspace gets the current configuration.

## 5. Who sees what

For a viewer `V` who is creating a space in workspace `W` (both optional: the landing has neither):

| Visibility | Listed when | Snapshot used |
|---|---|---|
| `public` | `approvedRevision` is set | `approvedRevision`, except for the case below |
| `public`, `workspace` | `V` belongs to the space's workspace **and** `W` is that workspace | `revision ?? latest` |
| `user` | `V` is the author (and administers `W`, which creating already requires) | `revision ?? latest` |

The space must be servable (`servableSpaceWhere()`). A template on a deleted, blocked or orphaned space is never
listed or used. Listing without `W` (the landing, and anonymous callers) only returns approved public templates.

## 6. Review lifecycle (public only)

```
          PUT visibility=public            approve (stores approvedRevision)
 none ─────────────────────────▶ pending ───────────────────────────────▶ approved
                                   │  ▲                                     │
                            reject │  │ PUT (resubmit)               revoke │
                                   ▼  │                                     ▼
                                rejected ◀──────────── PUT ─────────── revoked
```

- Any `PUT` on a public template sends it back to `pending`. It also **clears `approvedRevision`**, so the template
  leaves the public gallery until someone reviews it again. Its name, description and category are shown to the
  public too, and they have to be reviewed along with the content. The panel warns about this.
- Publishing a new snapshot never changes what the public sees, because it only gets `approvedRevision`. To offer a
  newer revision publicly, the author resubmits.
- Switching visibility away from `public` resets the review to `none`.

## 7. Copy on create

`POST /spaces { template: <id> }` resolves the template **for that caller and that workspace**, following §5. It
then:

1. Reads the Mongo `space` + `style` of `{ spaceId, environment, snapshot.revision }`.
2. Writes them as the new space's `main` documents. `schema.definition` is replaced with the new name and
   permanentUrl, and `schema.settings.debugMode` is dropped: it belongs to the source space's published site, not to
   its design. `plugins` is `{}`, and no segments are written.
3. Copies the `SpaceAction` and `SpaceConnector` rows of that revision into the new space as the live documents
   (`main`, revision 0). Credentials are not copied, and the linter flags any step that names a credential the new
   space lacks.

## 8. API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/templates?workspaceId=&category=` | optional | The catalogue for this viewer and workspace (§5): `{ templates, categories, review? }`. `review.pending` is only present for platform admins. |
| GET | `/templates/:id/thumbnail` | optional | The screenshot of the snapshot a public viewer would get, or placeholder if the viewer cannot see the template. |
| GET | `/spaces/:id/template` | space admin | `{ template \| null, sources, categories, leavesBehind }`: the current configuration, the published environments and their revisions, and what a copy would not carry. |
| PUT | `/spaces/:id/template` | space admin | Create or replace: `{ name, description, categoryId, visibility, environment, revision? }`. |
| DELETE | `/spaces/:id/template` | space admin | Stop offering it. |
| GET | `/admin/templates?status=` | `adminManage` | The review queue. |
| PATCH | `/admin/templates/:id/review` | `adminManage` | `{ decision: approve \| reject \| revoke, note? }`. `reject` and `revoke` need a note. |
| POST | `/spaces` | actor | `template` becomes the numeric template id (was the spec's permanentUrl). |

`GET /spaces/templates` is removed. Pre-release, so no alias is kept.

**Thumbnail.** The MCP preview (`@plitzi/sdk-mcp`, `createPreview`) always renders revision 0 (the latest in an
environment). It gains an optional `revision`, carried by `PreviewClient.render` and the space thumbnail's cache key,
so a public card shows the approved revision and not a newer unreviewed one. This is a general capability ("preview a
published revision") and adds no template-specific code to the platform.

## 9. Dashboard (`plitziWebsite`) and onboarding (`plitziAuth`)

- **Space page → Template panel** (space admins): the current state (off, visibility, review badge with the note) and
  a form with name, description, category, visibility, environment and revision ("Latest", then each published
  revision). The static warning from D5 goes above Save, plus the concrete `leavesBehind` counts (plugins, segments,
  credentials the actions name). There is also a "Stop offering" button.
- **Create Space modal**: the template select reads `/templates?workspaceId=<current>` and shows "Name · Category";
  its empty choice stays "Blank space".
- **Home → Start from a template**: category chips that filter the listing with `&category=`, cards with a thumbnail,
  and a "Review queue (N)" link when `review` is present.
- **`/admin/templates`**: the queue, with Approve / Reject (note) / Revoke (note) and a link to the source space.
- **Landing**: a public gallery section with the approved templates (thumbnail, name, category) and a "Start with
  this" button that leads to sign-up.
- **Onboarding (first space)**: reads `/templates?workspaceId=<personal>`.

## 10. Seeds

- `SpaceCategory` gains fixed ids for these general categories: Landing page, Portfolio, Business, Event, Blog,
  Application, Others (the default, id 1).
- `SeedSpaceSpec` gains `category`. Each demo spec with `template !== false` is published to `production`
  revision 1 by the seed (idempotent: the seed's own snapshot is rewritten, not duplicated). The seed also upserts a
  `public` + `approved` template row pinned to that revision.

## 11. Open

- **Pinned revision vs. an existing old space.** Deleting an old snapshot is not a feature today. If it ever is, the
  pin needs a guard.
- **Uploaded resources** stay linked to the author's CDN URLs, and deleting them breaks every copy. This was accepted
  in D5 as the price of not copying them.
- **Plan gating** — decided: none. A copy is an ordinary space and the plan's ceilings bind it at publish, as any other.

## 12. Implementation checklist

- [x] Prisma: enums + `SpaceTemplate` + relations; migration applied to `project_test` and `project`
- [x] `services/templates`: visibility query, snapshot resolution, copy, `leavesBehind`; unit tests
- [x] Routes: `/templates`, `/templates/:id/thumbnail`, `/spaces/:id/template`, `/admin/templates`; auth policy;
      `POST /spaces` switched to ids; `/spaces/templates` removed
- [x] `@plitzi/sdk-mcp` preview `revision` + thumbnail cache key
- [x] Seeds: categories, `category` per spec, production snapshot + public template rows
- [x] Dashboard: Template panel, create modal, home gallery + chips, admin queue, landing gallery; onboarding
- [x] E2E: lifecycle/onboarding updated, template flow (visibility matrix, review, copy)
- [x] Docs guide (`docs/templates.md`), then delete this RFC
