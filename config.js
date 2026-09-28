/* ==========================================================================
   Knowunity Content OS — configuration
   This is the only file you need to touch to connect the team board.

   Leave `supabase.url` and `supabase.anonKey` empty and the app runs in
   "this device only" mode: everything is saved in the browser you open it in.
   That is perfect for trying it out, but the team will not see each other's
   changes.

   To share ONE board with Immanuel, Adam and the editors:
     1. Create a free project at https://supabase.com
     2. Open the SQL editor and run the contents of supabase/schema.sql
     3. Project settings -> API: copy the Project URL and the anon/publishable key
     4. Paste them below, commit, and redeploy. Done.
   Full walkthrough: docs/SETUP.md
   ========================================================================== */
window.KU_CONFIG = {
  teamName: 'Knowunity Content',
  supabase: {
    url: '',      // e.g. 'https://abcdefghijkl.supabase.co'
    anonKey: '',  // e.g. 'sb_publishable_...' or 'eyJhbGciOi...'
    table: 'items'
  }
};
