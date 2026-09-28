# Setup: deploy the app and share one board

Two independent decisions:

1. **Where the page is hosted** (GitHub Pages or Vercel; either is fine, both are free).
2. **Where the data lives.** Out of the box every browser keeps its own copy. To give Immanuel, Adam and the editors one shared board, connect Supabase (free tier is plenty). This takes about five minutes.

## 1. Hosting

### GitHub Pages

1. In the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. The workflow `.github/workflows/pages.yml` runs on every push to the default branch and publishes the repository as-is (there is nothing to build).
3. The URL is shown in **Settings → Pages** and in the workflow run, in the form `https://<user>.github.io/knowunity-system/`.

If the first run fails with "Pages is not enabled", do step 1 and re-run the workflow from the **Actions** tab.

### Vercel

1. vercel.com → **Add New → Project** → import this repository.
2. Framework preset **Other**. Leave *Build command* empty, *Output directory* `.` (a dot).
3. Deploy. Every push to the default branch redeploys automatically.

Both options serve the same files; nothing in the app depends on the host.

## 2. One shared board with Supabase

1. Create a free account at https://supabase.com and a new project (any region close to the team; remember the database password, you will not need it in the app).
2. In the project, open **SQL Editor → New query**, paste the whole content of `supabase/schema.sql`, click **Run**. This creates the `items` table and its access policies.
3. Open **Project Settings → API** (or **Connect** at the top). Copy:
   - **Project URL**, e.g. `https://abcdefghijkl.supabase.co`
   - the **anon / publishable** key (starts with `sb_publishable_` or `eyJ`). Never the service-role/secret key.
4. Edit `config.js`:

   ```js
   window.KU_CONFIG = {
     teamName: 'Knowunity Content',
     supabase: {
       url: 'https://abcdefghijkl.supabase.co',
       anonKey: 'sb_publishable_…',
       table: 'items'
     }
   };
   ```

5. Commit and push. After the redeploy, **Settings → Data** reads **Shared board: everyone sees the same thing** instead of **Saved in this browser only**.

The app talks to Supabase through its REST API, refreshes the board every 20 seconds while a tab is open, and on every return to the tab. Two people editing the same card at the same second: the last save wins.

### Who can see and change the board

Anyone who has the deployed URL can read and write, because the anon key ships with the page. For a small trusted team that is the intended trade-off; there is nothing sensitive on the board itself, and the Drive links are protected by Drive's own sharing. If you ever want logins, enable Supabase Auth and change the four policies in `schema.sql` from `to anon, authenticated` to `to authenticated`.

### Moving existing data into the shared board

If someone already used the app on their own device: **Team → Data & storage → Download backup** there, then on the shared version **Restore backup**. Restoring replaces the whole board.

## 3. First run and inviting the team

1. Open the link and pick your own name.
2. **Settings → Team**: rename *Editor 1* to the editor's real name, add more people if needed.
3. **Settings → Team → Invite** next to a person copies a ready-made message: a personal link (`…#as-<id>`) plus a three-line explanation of what they do. Paste it into WhatsApp. Whoever opens that link is signed in as that person on that device, with no question asked, and sees their own Home (the editor: one card per drop with **Open footage** and **Deliver**).
4. **Settings → Posting turns**: pick the mode (daily turns is the default) and who starts. Check the "Next 7 days" preview.
5. **Settings → Drive folders**: paste the standing Raw / Edits / Assets folders.
6. Send the first drop, then tap **Copy message for editor** and paste it into the chat. The board shows the drop on the editor's Home within seconds, but it does not send notifications by itself.

## 4. How the live sync works

With Supabase connected, every open tab checks the server every 8 seconds (a few kilobytes: ids and timestamps), downloads the board only when something changed, checks again 3 seconds after its own saves, and refreshes whenever the tab is brought back to the front. In practice a change made by one person shows up for the others within about 10 seconds, without reloading. **Settings → Data** shows the last sync time.

## Troubleshooting

| Symptom | What to check |
|---|---|
| A red **Could not save** message pops up | `config.js` URL or key has a typo, or `schema.sql` was not run (the policies are what allow the anon key to write). The message contains the exact error. |
| Board is empty on a colleague's phone | They are looking at a deployment without Supabase (each device keeps its own data). Complete section 2. |
| Fonts look different offline | The typefaces load from Google Fonts; without internet the system font is used. Everything still works. |
| A day shows the wrong poster | Check **Team → Posting rota** (mode, start date, first poster) and whether the day has a swap (ringed avatar in the calendar). |
| Downloads do nothing | Some embedded viewers block downloads. Use **Copy backup** and paste into a file instead. |
