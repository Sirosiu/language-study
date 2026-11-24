# Private Language Study

The lessons, dictionary lookup, PDFs and course downloads are public. **Your answers, notebook, added questions and saved dictionary words are private to your Supabase account.** Sign in from **My notebook** on the website.

## First sign-in

Open [My notebook](https://sirosiu.github.io/language-study/#fr/notebook). Create your account once, confirm the Supabase email if requested, then sign in. Use the same email and password in the website and Obsidian on every device. Enter passwords yourself; never put them in GitHub or your vault.

The project connection is already configured. Its publishable key is public by design. Database access is enforced by Supabase row-level security: an account can read and update only its own records. A signed-out visitor cannot read the private table.

## Install in your Syncthing vault

Download the [Obsidian plugin ZIP](https://sirosiu.github.io/language-study/downloads/sirosiu-language-study-plugin.zip). Extract its **sirosiu-language-study** folder into your vault’s **.obsidian/plugins/** folder. It contains main.js, manifest.json and styles.css.

In Obsidian, open Settings → Community plugins, enable community plugins if necessary, and enable **Sirosiu Language Study**. The plugin works on desktop, Android and iOS. Syncthing copies the plugin files and course notes; enable the plugin and sign in on each device.

Open the plugin settings. Leave the configured project URL and publishable key in place. Choose a course folder (default: **Language Study**), select **Install course notes**, then **Sign in**. There is one main note for each of the 15 languages. Existing notes in that folder are kept.

## Write and practise in either app

On the website, written answers save as you type while signed in. Comparing or marking an answer records its submitted/review state. Your notebook accepts Markdown. Added questions are available in Practice → Grammar rule → **My added questions**.

In Obsidian, use **Language Study: Answer a course question** to start answering there first. Put the cursor beside a course question to select its ID automatically, or enter an ID such as **fr-Q0001**. Write your answer in the practice window; it saves as a draft. Compare the model and choose a review mark when ready. Installed course JSON lets this work offline too.

Your saved work appears in **My study** at the end of the same language note. Edit **My notebook** as ordinary Markdown. You can also edit saved answers inside the **Your answer** fences, then tick **Submitted** and your review choice. Keep each item’s ID, fences and comment markers. Use **Language Study: Add my question** to create a question; edit its fields inside the same note afterward. Changes to the public lesson text or model-answer section do not count as your private answers.

Your website and Obsidian changes travel through Supabase. Obsidian reads and writes the vault while it is open, then Syncthing copies those Markdown changes between devices. If every Obsidian app is closed, website changes appear when one next opens. Base lesson edits are local course edits; private notebook, answers, added questions and saved words are the parts that sync.

## Offline edits and conflicts

Signed-in apps keep a local account backup and queue offline edits. They sync when reconnected. Save each website language offline from Study tools before losing internet. New dictionary lookups and source recordings need internet; individual letter recordings are included in the offline language pack.

If two devices edit the same item before syncing, both versions are kept. Open My notebook on the website or **Language Study: Review simultaneous edits** in Obsidian. Compare the versions, then choose the device or cloud version. Copy anything you want to merge before choosing.

To remove a synced item from both apps, use **Remove** on the website or tick **Delete this synced item** in Obsidian. Removing an entire Markdown block does not delete its cloud record. Deletions are stored as tombstones so a stale Syncthing file cannot silently bring an item back.

## Privacy and backups

Auth sessions and pending queues stay in each app’s device-local storage, outside the Syncthing vault. Only public connection settings are stored in plugin data.json. Your synced Markdown contains your private work: protect your devices and vault, and keep private backups out of public repositories. The vault and browser cache are not encrypted by this plugin.

Export a **Private backup** from My notebook or Obsidian settings before clearing browser/app data. Signing out hides private website data but keeps that account’s device backup for the next sign-in. Notes already written to your local vault remain there.

## Database setup and troubleshooting

The repository includes **supabase/migrations/202611240001_language_study.sql**. Run that migration once in the selected project’s SQL Editor if the private study table has not been installed. It adds the application table, ownership policy, revision-checked save function and Realtime publication entry. It does not change other application tables.

The private database and confirmation return URL are configured in the selected project. If sign-in succeeds but sync reports a missing table or function in a different project, apply that migration there. If email confirmation redirects to the wrong address after moving the site, update Supabase Authentication → URL Configuration → Site URL. The current address is **https://sirosiu.github.io/language-study/**. Password sign-in does not use OAuth or third-party login providers.

Use **Sync now** to retry a failed connection. If a Markdown marker is missing, restore it from Syncthing file versioning or a backup before retrying. If a note belongs to another account, choose a different course folder instead of sharing private study between accounts.
