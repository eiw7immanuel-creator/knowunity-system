# Knowunity Content OS

One calm board for the content team: raw-footage **drops**, the editor's **24-hour clock**, review, **posting turns** between Immanuel and Adam, and the **60-posts-a-month** target across Instagram and TikTok.

Plain HTML, CSS and JavaScript. No build step, no framework, works on a phone. Open `index.html` and it runs.

## The system in one paragraph

Immanuel and Adam film in batches, two or three times a month. Each batch is a **drop**: the raw footage goes to Drive, the drop is sent from the app with the link and a note, and the editor's deadline is set automatically (sent + 24 h). The editor taps **Start editing**, makes the videos, then taps **Deliver**: paste the folder link, one title per line. Every line becomes a video that a creator approves with one tap (or sends back with a note). Approved videos are **ready**; **Fill empty days** puts them on the calendar, two per day. The day's poster opens Home, posts on Instagram and TikTok, and ticks both. The month counter moves. Every code (`D07-C03-v2`) says which drop and which clip a video came from.

## What each person sees

| Person | Home shows | Tabs |
|---|---|---|
| **Creator** (Immanuel, Adam) | Month progress, today's two posts with Instagram / TikTok / YouTube ticks, videos to review with Approve buttons, what is with the editor, the next 7 days | Home · Calendar · Drops · Videos · Settings |
| **Editor** | One big card per drop with the deadline, the notes, **Open footage** and one button (**Start editing** or **Deliver**), plus any video sent back with a note | Home · Videos · How it works |

Everyone gets a personal invite link (**Settings → Team → Invite** copies it together with a three-line explanation). Opening it signs that device in as that person, so the editor never sees a chooser or a setting. Nothing is locked; it only decides what Home shows first.

## Pages

| Page | What it is for |
|---|---|
| **Home** | Everything that needs doing today, for the person using the device (see above). |
| **Calendar** | Who posts on which day, two dots per day (posted, planned, empty, missed). Tap a day to pick videos, tick platforms or swap the poster. |
| **Drops** | Every footage batch with its deadline chip. Tap one for the progress, the videos and the messages to copy. |
| **Videos** | One simple list with filter chips: To review, Ready, Planned, Posted, In editing. |
| **Settings** | You, team, posting turns (daily, weekly or fixed weekdays), goals and deadlines, Drive folders, backup and restore. |
| **How it works** | The three steps, the words we use, the folder structure. |

Ready-made messages (handoff, delivery, today's plan) copy with one tap and paste straight into WhatsApp or Slack.

## Try it now

1. Download or clone this repository.
2. Open `index.html` in a browser.

It starts in **"this device only"** mode with example data so every page has something on it. Use **Clear example data** for a blank board.

## Go live for the team

1. **Vercel** hosts the app: import the repository, framework preset *Other*, no build command, output directory `.`. Every push redeploys.
2. **Your Oracle Cloud VM** runs the team server: `git clone` this repository on the VM and run `sudo bash server/install.sh`. One command installs Node.js, Caddy with a free HTTPS certificate, a system service, and prints the API URL and a team key. Open ports 80/443 once in the Oracle console.
3. **Connect** the app once: Settings → Team server → paste URL and key. Then **Settings → Team → Invite** copies a personal link for each person that connects their device and signs them in.

Step by step, with troubleshooting: [docs/SETUP.md](docs/SETUP.md). The server pushes every change to all open phones within a second.

## Rules

- **Editor turnaround: 24 h** from the moment a drop is sent. **Review: 24 h** from delivery. Both are settings.
- **A video is posted** when Instagram, TikTok and YouTube Shorts are all ticked. Only posted videos count toward the monthly target.
- The board is the source of truth. If it is right, nobody has to ask.

The full process is in [docs/PLAYBOOK.md](docs/PLAYBOOK.md).

## Design

Soft lavender background, white rounded cards, one purple accent, Nunito. To match the exact brand purple, change `--primary` and `--primary-hover` at the top of `styles.css`. Light and dark mode both work.

## Files

```
index.html            entry page
styles.css            design tokens (light + dark), layout, components
app.js                the application: state, turns, pages, sheets, actions, example data
store.js              storage adapters: team server, Supabase (alternative), this browser
config.js             optional pinned connection (normally untouched)
server/server.js      the team server: zero dependencies, one JSON file, live push updates
server/install.sh     one-command installer for an Oracle Cloud VM (Node, Caddy HTTPS, service)
supabase/schema.sql   alternative backend
docs/SETUP.md         Vercel + Oracle walkthrough with troubleshooting
docs/PLAYBOOK.md      the working agreement, in Markdown
tests/smoke.mjs       headless-browser test of the whole flow
tests/sync.mjs        two browsers against the real team server
```

## Data model

Every record is one row: `{ id, kind, data, updated_at }`.

| kind | data |
|---|---|
| `settings` | monthly target, posts per day, turnaround hours, drops per month, variations per clip, turns mode/anchor/order, week start, Drive folders |
| `member` | name, role (`creator` / `editor`), colour, order, archived |
| `drop` | number, title, sentBy, editorId, sentAt, dueAt, driveLink, brief, clips `[{id, name}]`, targetVideos, status (`sent` → `editing` → `delivered` → `approved`), editingStartedAt, deliveredAt, deliveredLink, deliveryNote, closedAt |
| `video` | code, title, dropId, clipId, editorId, status (`editing` / `delivered` / `changes` / `approved` / `scheduled` / `posted`), fileLink, caption, notes, platforms `{instagram, tiktok}`, scheduledDate, slot, posterId, postedDate, deliveredAt, approvedAt |
| `override` | date, posterId, note (a one-day swap of the turns) |

## Development

```
node tests/smoke.mjs   # one browser: every page and the whole drop flow
node tests/sync.mjs    # two browsers, one shared board (mock Supabase API)
```

Both need Playwright and Chromium. The smoke test sends a drop, starts it, delivers four videos, approves, plans, posts, swaps a poster, filters the list, sends a video back with a note, checks the editor's home, changes settings, reloads to check persistence, clears the example data and checks the phone layout. The sync test starts the real team server, connects a creator on desktop, lets the editor join on a phone through the invite link, and checks that drops, deliveries, approvals, change notes and renames show up on the other side within seconds, that a wrong key is refused, and that the data survives a server restart. Screenshots land in `tests/output/`.
