/* ==========================================================================
   Knowunity Content OS — configuration

   You normally do not need to edit this file.

   The team server (server/ on your Oracle Cloud VM) is connected from inside
   the app: Settings → Data → Connect team server, paste the API URL and the
   team key the installer printed. Everyone else gets it through their invite
   link (Settings → Team → Invite), so the key never has to live in the code.

   Optional: if this repository is private you may pin the connection here
   instead, so every device is connected without pasting anything.
   Leave both empty otherwise.
   ========================================================================== */
window.KU_CONFIG = {
  teamName: 'Knowunity Content',
  api: {
    url: '',   // e.g. 'https://130-61-1-2.sslip.io'
    key: ''    // the team key printed by server/install.sh
  },
  supabase: { url: '', anonKey: '', table: 'items' } // alternative backend, see docs/SETUP.md
};
