# Knowunity Content OS

One board for the whole content team: raw-footage **drops**, the editor's **24-hour clock**, review, the **posting rota** between Immanuel and Adam, and the **60-posts-a-month** target across Instagram and TikTok.

Plain HTML, CSS and JavaScript. No build step, no framework, works on a phone. Open `index.html` and it runs.

## The system in one paragraph

Immanuel and Adam film in batches, two or three times a month. Each batch is a **drop**: the raw footage goes to Drive, the drop is created in the app with the link, the clip list and a brief, and the deadline is set automatically (sent + 24 h). The editor starts the drop, cuts every clip into as many variations as the brief asks for, and **logs the delivery**: the Drive folder plus one line per video. Every line becomes a video card that a creator reviews and approves within 24 h. Approved videos are **ready**; auto-fill puts them into the empty slots of the calendar, two per day. The day's poster, decided by the rota (and swappable per day), opens **Today**, posts on Instagram and TikTok and ticks both boxes. The month counter moves. Every code (`D07-C03-v2`) says which drop and which clip a video came from.

## Pages

| Page | What it is for |
|---|---|
| **Today** | Month progress against the target, pace, the day strip (2 posts per day), today's slots with Instagram/TikTok checkboxes, the next 7 days, editor deadlines with live countdowns, and videos waiting for review. |
| **Drops** | Every footage batch with sent time, editor, deadline countdown (or on time / late by), number of videos produced and the Drive links. Open one to see its timeline, clips, videos and actions. |
| **Videos** | Kanban board: In editing → Delivered → Changes requested → Ready to post → Scheduled → Posted. Drag cards or open them. Filter by drop, editor or text. |
| **Calendar** | Who posts on which day (rota + per-day swaps), every slot's state (posted, one platform, scheduled, empty, missed) and one-click auto-fill from the ready pool. |
| **Team & settings** | Members and roles, rota mode (alternate days / weeks / fixed weekdays), targets and turnaround hours, Drive folders, backup and restore. |
| **Playbook** | The agreed process, naming conventions, export spec, cross-posting checklist and what to do when something slips. Numbers update from the settings. |

Message templates (handoff, delivery, daily posting plan) are one click away and paste straight into WhatsApp or Slack.

## Try it now

1. Download or clone this repository.
2. Open `index.html` in a browser.

It starts in **"this device only"** mode with example data so every page has something on it. Use **Clear example data** when you want a blank board.

## Go live for the team

1. **Deploy** (pick one):
   - **GitHub Pages**: repository Settings → Pages → Source: *GitHub Actions*. The workflow in `.github/workflows/pages.yml` publishes the default branch on every push.
   - **Vercel**: import the repository, framework preset *Other*, no build command, output directory `.`. Every push redeploys.
2. **Share one board** across the team by connecting a free Supabase project: run `supabase/schema.sql`, paste the URL and key into `config.js`. Step by step in [docs/SETUP.md](docs/SETUP.md). Without this, each person sees only their own device's data.
3. Send the link to Adam and the editors. Everyone picks their name on first open; that personalises Today and stamps who sent or delivered what.

## Roles and rules

- **Creators (Immanuel, Adam)** film, send drops, review deliveries, and post on their rota days.
- **Editors** start drops, deliver within the turnaround, and log every video.
- **Editor turnaround: 24 h** from the moment a drop is sent. **Review turnaround: 24 h** from delivery. Both are settings.
- **A video is posted** when both Instagram and TikTok are ticked. Only posted videos count toward the monthly target.
- The board is the source of truth. If it is right, nobody has to ask.

The full process is in [docs/PLAYBOOK.md](docs/PLAYBOOK.md) and inside the app.

## Files

```
index.html            entry page
styles.css            design tokens (light + dark), layout, components
app.js                the application: state, rota, pages, drawers, actions, example data
store.js              storage adapters: this browser, or Supabase for the team
config.js             the only file to edit to connect Supabase
supabase/schema.sql   one table + policies for the shared board
docs/SETUP.md         deployment and Supabase walkthrough
docs/PLAYBOOK.md      the working agreement, in Markdown
tests/smoke.mjs       headless-browser test of the whole flow
```

## Data model

Every record is one row: `{ id, kind, data, updated_at }`.

| kind | data |
|---|---|
| `settings` | monthly target, posts per day, turnaround hours, drops per month, variations per clip, rota mode/anchor/order, week start, Drive folders |
| `member` | name, role (`creator` / `editor`), colour, order, archived |
| `drop` | number, title, sentBy, editorId, sentAt, dueAt, driveLink, brief, clips `[{id, name}]`, targetVideos, status (`sent` → `editing` → `delivered` → `approved`), editingStartedAt, deliveredAt, deliveredLink, deliveryNote, closedAt |
| `video` | code, title, dropId, clipId, editorId, status (`editing` / `delivered` / `changes` / `approved` / `scheduled` / `posted`), fileLink, caption, notes, platforms `{instagram, tiktok}`, scheduledDate, slot, posterId, postedDate, deliveredAt, approvedAt |
| `override` | date, posterId, note (a one-day swap of the rota) |

## Development

```
node tests/smoke.mjs
```

Boots the app in headless Chromium (needs Playwright), creates a drop, starts it, delivers four videos, approves, schedules, posts, swaps a poster, drags a card on the board, changes settings, reloads to check persistence, clears the example data and checks the phone layout. Screenshots land in `tests/output/`.
