# SVN Studio

A GitLab-style SVN client, shipped two ways from one design:

- **Web**: React + TypeScript + Monaco Editor frontend, Node.js/Express REST API backend that wraps the `svn` CLI.
- **Windows**: WPF (.NET 8) desktop app, MVVM (CommunityToolkit.Mvvm), calling the `svn` CLI directly via `Process.Start`.

Both share the same 3-panel IDE layout: file tree (left) · file viewer/editor (center) · SVN operations — commit, update, revert, history, lock (right).

## Prerequisites

- [Subversion command-line client](https://subversion.apache.org/packages.html) (`svn`) installed and on `PATH` — required by both apps; neither embeds an SVN library.
- Node.js 20+ and npm (web app).
- .NET 8 SDK (Windows app). Windows 10/11 to run it.

## Repository layout

```
UI_SVN/
  web/
    server/   Express + TypeScript REST API wrapping the svn CLI
    client/   React + TypeScript + Monaco Editor UI
  windows/
    SvnClient.sln
    SvnClient.App/   WPF .NET 8 desktop client (MVVM)
```

## Running the web app

**Backend**

```bash
cd web/server
cp .env.example .env   # set SETTINGS_SECRET to a random string
npm install
npm run dev
```

Starts the API on `http://localhost:4000`. Credentials are encrypted at rest (AES-256-GCM, keyed from `SETTINGS_SECRET`) in `web/server/data/settings.enc.json`.

**Frontend**

```bash
cd web/client
npm install
npm run dev
```

Opens on `http://localhost:5173`, proxying `/api/*` to the backend (see `vite.config.ts`).

First run: open **Settings** in the top bar, enter the repository URL, credentials, and a local folder, then either **Checkout Repository** (fresh clone) or **Relink Working Copy** (folder is already an SVN checkout).

## Running the Windows app

```bash
cd windows
dotnet build
dotnet run --project SvnClient.App
```

Or open `SvnClient.sln` in Visual Studio 2022+ and run. Settings are stored in `%AppData%\SvnStudio\settings.json`; the password is protected with Windows DPAPI (`CurrentUser` scope), not stored in plain text.

The Windows app is editable by default (per spec); the web app defaults to **read-only** viewing and only writes to the working copy when you flip the **Enable editing** toggle in the top bar.

## REST API (web backend)

| Method | Path | Purpose |
|---|---|---|
| GET | `/svn/tree` | Merged `svn list -R` + `svn status` tree |
| GET | `/svn/file?path=` | File content (`svn cat`, falls back to disk for unversioned files) |
| PUT | `/svn/file` | Write file content directly to the working copy (edit mode) |
| GET | `/svn/diff?path=` | `svn diff` for a path |
| GET | `/svn/history?path=` | `svn log --xml -v` |
| POST | `/svn/upload` | Multipart upload into a folder + `svn add` |
| POST | `/svn/create-folder` | `svn mkdir --parents` |
| POST | `/svn/delete` | `svn delete --force` |
| POST | `/svn/rename` | `svn move` |
| POST | `/svn/commit` | `svn commit -m` over selected paths |
| POST | `/svn/update` | `svn update` |
| POST | `/svn/revert` | `svn revert` (all or selected paths) |
| POST | `/svn/lock` / `/svn/unlock` | `svn lock` / `svn unlock` |
| GET/PUT | `/settings` | Read/write repo URL, username, password, working copy path |
| POST | `/settings/checkout` | `svn checkout` into the configured folder |
| POST | `/settings/relink` | Point at an existing working copy without re-cloning |

All path-taking endpoints reject any path that resolves outside the configured working copy root.

## Security notes

- The `svn --password` flag is visible to other processes on the same machine via the process list; for hardened deployments, seed SVN's own auth cache once (`svn --username U --password P info <url>`) or use a system credential helper instead of passing the password on every call.
- Web credentials are AES-256-GCM encrypted at rest; Windows credentials are DPAPI-protected — both are still decrypted in-process to invoke the CLI, since svn has no way to accept a credential handle.
- Uploads and all file operations validate that the target path stays inside the working copy root (no `../` traversal).

## Extending

- **Branch/Tag creation** (marked optional in the spec) can be added as `svn copy <trunk-url> <branch-url> -m "..."` — wire it into `svnService.ts` / `SvnCliService.cs` and a new toolbar action the same way `commit`/`update` are wired.
- **Conflict resolution UI**: `svn status --xml` already reports `conflicted`; the diff view highlights `<<<<<<<`/`=======`/`>>>>>>>` markers as plain text today — swap in a proper 3-way merge view if needed.
