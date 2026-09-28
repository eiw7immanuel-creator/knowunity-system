# Setup: Vercel + your Oracle Cloud VM

Two parts, about ten minutes in total:

1. **Vercel** hosts the app (the static files in this repository). Every push redeploys.
2. **Your Oracle Cloud VM** runs the tiny team server (`server/server.js`) that holds the shared board and pushes every change to all open phones instantly.

No secrets live in the repository. The connection is pasted into the app once and travels to the team inside their invite links.

## 1. Vercel

1. vercel.com → **Add New → Project** → import `knowunity-system` from GitHub.
2. Framework preset **Other**. Leave *Build Command* empty, *Output Directory* `.` (a dot). Deploy.
3. You get a URL like `https://knowunity-system.vercel.app`. Vercel deploys the repository's default branch on every push.

`.vercelignore` keeps the server, tests and docs out of the deployment.

## 2. Team server on Oracle Cloud (one command)

You need a VM with SSH access (an Always Free *Ampere A1* or *Micro* instance is plenty; Ubuntu or Oracle Linux both work).

```
ssh ubuntu@<your-vm-ip>            # or opc@… on Oracle Linux
git clone https://github.com/eiw7immanuel-creator/knowunity-system.git
sudo bash knowunity-system/server/install.sh
```

The installer installs Node.js and Caddy, creates a system service, gets a free HTTPS certificate for `<your-ip>.sslip.io`, opens ports 80/443 on the VM, and ends with:

```
   API URL:   https://130-61-1-2.sslip.io
   Team key:  3f9c…
```

**One thing only the Oracle console can do (once):** Networking → Virtual Cloud Networks → your VCN → Security Lists → Default Security List → **Add Ingress Rules**: Source `0.0.0.0/0`, protocol TCP, destination ports `80,443`. Without this, the VM is unreachable from the internet even though the installer opened the VM's own firewall.

Check from your laptop (the certificate can take about a minute the first time):

```
curl https://130-61-1-2.sslip.io/api/health      → {"ok":true}
```

Own domain instead of sslip.io: point an A record at the VM, then run `DOMAIN=board.example.com sudo -E bash knowunity-system/server/install.sh`.

## 3. Connect the app (once, on your own phone or laptop)

Open the Vercel URL → **Settings → Team server** → paste the API URL and the team key → **Connect**. If you already used the app on this device, the checkbox uploads that board to the (still empty) server; leave it unticked if it is only example data.

Settings then shows **Live** and the last sync time.

## 4. Invite the team

**Settings → Team**: rename *Editor 1* to the editor's real name, add anyone else. Then tap **Invite** next to a person and paste the copied message into WhatsApp. The link inside carries the server connection and who they are: opening it connects the device and signs them in, with no question asked. The editor lands on a Home with one card per drop, **Open footage** and **Deliver**.

When you send a drop, tap **Copy message for editor** and paste it into the chat: the drop shows up on the editor's Home within a second, but the board itself does not send notifications.

## 5. How the live sync works

Every open tab keeps a connection to the server (Server-Sent Events). When anyone saves, the server tells every tab and each one refreshes within about a second. If the connection drops (phone in a pocket, VM restarting), the tab shows *Reconnecting…*, checks the server every 8 seconds and reconnects by itself. Bringing a tab back to the front always refreshes it. In the automated test (`node tests/sync.mjs`) changes reached the other browser in under two seconds.

## 6. Backups, updates, security

- **Data**: `/var/lib/knowunity/items.json` on the VM, plus a daily copy in `/var/lib/knowunity/backups/` (14 kept). **Settings → Data → Download backup** saves the same thing from any device; **Restore backup** puts it back.
- **Update the server**: on the VM, `cd knowunity-system && git pull && sudo bash server/install.sh` (keeps the key and the data).
- **Who can access the board**: anyone who has the team key, which is inside every invite link. Share invites privately. To lock someone out, change `KU_KEY` in `/etc/knowunity/env`, run `sudo systemctl restart knowunity-api`, then re-invite everyone.
- The repository and the Vercel site contain no secrets.

## Troubleshooting

| Symptom | What to check |
|---|---|
| **Could not reach the server** when connecting | The ingress rule for 80/443 in the Oracle console (step 2). Then `sudo systemctl status knowunity-api caddy` on the VM. |
| **Team key not accepted** | Copy the key again from `/etc/knowunity/env` on the VM. |
| `curl https://…/api/health` fails with a certificate error | Caddy is still fetching the certificate; wait a minute and try again. `sudo journalctl -u caddy -n 30` shows progress. |
| A colleague's phone shows an empty board | They opened the plain site instead of their invite link. Send the invite again. |
| Settings shows **Reconnecting…** for long | The VM is down or the ports closed. Data is safe on the server; the phone catches up when it is back. |

## Alternative: Supabase

If you would rather not run a VM, `supabase/schema.sql` and the `supabase` section of `config.js` connect the same app to a free Supabase project (polling instead of instant push).
