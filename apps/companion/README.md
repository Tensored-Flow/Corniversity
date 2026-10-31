# Corniversity desktop companion

The companion is the only part of Corniversity that can see files on your computer. A deployed
server cannot watch a Windows folder; this small Node program does, and talks to the university
over outbound HTTPS. Nothing listens on your machine and nothing starts at login unless you set
that up yourself.

What it does, in order:

1. **Pair** once with a one-time code from *Library → Desktop sync*. The university returns a
   narrow device token (stored in your user profile, never in the library folder or the repo).
   Revoke it any time from the Library page.
2. **Register** each file in the inbox: filename, size, SHA-256, PDF title/author/page count.
   Only these facts leave the device. The file appears in the Library as *registered on your
   desktop*, reference-only.
3. **Upload** a file's bytes only after you grant *private storage* for that item in the Library.
   Extraction, indexing and tutor access are separate permissions you grant per item.

## Commands (PowerShell-friendly)

Run from the repository root. Arguments after `--` go to the companion.

```powershell
# 1. Create a pairing code in the Library, then:
pnpm library:pair -- --server http://localhost:3000 --code 1234-5678 --name "Leon's desktop" --root "C:\Users\leon\Documents\Corniversity-Library"

# 2. See what would be registered (no network, nothing sent)
pnpm library:sync -- --dry-run

# 3. Register files once, and send any uploads you have permitted
pnpm library:sync

# 4. Keep watching; the Library shows "desktop sync online" while this runs (Ctrl+C stops it)
pnpm library:watch

# Other
pnpm library:status
pnpm --filter @corniversity/companion start -- pause
pnpm --filter @corniversity/companion start -- resume
pnpm --filter @corniversity/companion start -- unpair
```

Requirements: Node 22 or newer (the repository already needs it). No Docker, WSL or admin rights.

## Folder layout

`--root` defaults to `CORNIVERSITY_DATA_ROOT` or `~/Documents/Corniversity-Library`. Pairing
creates the layout if it is missing:

```
<root>/
  inbox/
    mathematics/  physics/  chemistry/  computer-science-ai/  neuroscience/  cognitive-science/
  originals/   processed/   exports/   requests/   quarantine/
```

Only `inbox/` is watched. Course subfolders are optional: a file can support several courses;
you attach it to courses in the Library after confirming its metadata. Files do not need perfect
names. Accepted: `.pdf`, `.md`, `.txt`. Temporary and hidden files, and symbolic links, are ignored.

## Behaviour you can rely on

- **Stability**: a file is hashed only after its size and modification time stop changing, so a
  download or copy in progress is not registered half-written.
- **Deduplication**: unchanged files are not re-hashed; identical content under another name is
  reported as a duplicate by the university rather than stored twice.
- **Retries**: network errors and server errors back off exponentially (1 s, 2 s, 4 s, …, max 60 s).
  A refused token is not retried: the watcher stops and tells you to pair again.
- **Pause**: `pause` keeps the watcher alive but registers and uploads nothing; the Library shows
  *paused*. `resume` continues.
- **Offline state**: when the watcher is not running, the Library says *desktop sync offline*.
  Items whose bytes were already stored remain fully usable.

State (which files have been seen) lives next to the configuration:
Windows `%APPDATA%\Corniversity\`, elsewhere `$XDG_CONFIG_HOME/corniversity/`. Set
`CORNIVERSITY_COMPANION_HOME` to move both.
