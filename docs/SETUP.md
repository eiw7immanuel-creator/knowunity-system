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

5. Commit and push. After the redeploy the footer of the sidebar reads **Shared board · synced** instead of **Saved on this device**.

The app talks to Supabase through its REST API, refreshes the board every 20 seconds while a tab is open, and on every return to the tab. Two people editing the same card at the same second: the last save wins.

### Who can see and change the board

Anyone who has the deployed URL can read and write, because the anon key ships with the page. For a small trusted team that is the intended trade-off; there is nothing sensitive on the board itself, and the Drive links are protected by Drive's own sharing. If you ever want logins, enable Supabase Auth and change the four policies in `schema.sql` from `to anon, authenticated` to `to authenticated`.

### Moving existing data into the shared board

If someone already used the app on their own device: **Team → Data & storage → Download backup** there, then on the shared version **Restore backup**. Restoring replaces the whole board.

## 3. First run for the team

1. Open the link. Choose your name in **Who is using this device?** (it can be changed any time from the sidebar).
2. **Team**: rename *Editor 1* to the editor's real name, add more editors if there are several.
3. **Team → Posting rota**: pick the mode (alternate days is the default) and who starts. Check the "Next 10 days" preview.
4. **Team → Drive folders**: paste the standing Raw / Edits / Assets folders.
5. **Clear example data** (banner at the top), then send the first drop.

## Troubleshooting

| Symptom | What to check |
|---|---|
| Sidebar says **Save failed** | `config.js` URL or key has a typo, or `schema.sql` was not run (the policies are what allow the anon key to write). Hover the status for the exact error. |
| Board is empty on a colleague's phone | They are looking at a deployment without Supabase (each device keeps its own data). Complete section 2. |
| Fonts look different offline | The typefaces load from Google Fonts; without internet the system font is used. Everything still works. |
| A day shows the wrong poster | Check **Team → Posting rota** (mode, start date, first poster) and whether the day has a swap (ringed avatar in the calendar). |
| Downloads do nothing | Some embedded viewers block downloads. Use **Copy backup** and paste into a file instead. |
