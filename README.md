# Moments

A minimalist flash note / fleeting thoughts capture plugin for Obsidian.

**Capture ideas instantly, backed by Markdown.**

![Moments Screenshot](https://raw.githubusercontent.com/obsidian-moments/obsidian-moments/main/screenshot.png)

## Features

- ✨ **Quick capture**: Press Enter to save your thought instantly
- 📝 **Markdown-backed**: Your moments are stored in a plain Markdown file
- 🔗 **Obsidian syntax**: Full support for `[[links]]`, `#tags`, and embeds
- 🔍 **Built-in search**: Filter your moments with instant search
- ✏️ **Inline editing**: Double-click to edit any moment
- ↩️ **Undo delete**: Accidentally deleted? Click to restore
- 🎨 **Theme-friendly**: Adapts to your Obsidian theme

## Philosophy

**Markdown is the single source of truth.**

Unlike other note-capturing tools that store data in proprietary formats, Moments stores everything in a plain Markdown file. Your data is:

- **Visible**: Open the file in any text editor
- **Portable**: No vendor lock-in
- **Searchable**: Works with Obsidian's native search
- **Version-controlled**: Use git to track changes

## Installation

### From Obsidian Community Plugins

1. Open **Settings → Community plugins**
2. Select **Browse** and search for "Moments"
3. Select **Install**, then **Enable**

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/obsidian-moments/obsidian-moments/releases/latest)
2. Create a folder named `moments` in your vault's `.obsidian/plugins/` directory
3. Copy the downloaded files into the `moments` folder
4. Reload Obsidian and enable the plugin in **Settings → Community plugins**

## Usage

### Opening Moments

- Click the ✨ icon in the ribbon
- Use the command palette: `Moments: Open Moments`
- Use the hotkey (assign in **Settings → Hotkeys**)

### Capturing Moments

1. Type your thought in the input field
2. Press **Enter** to save (or **Shift+Enter** for a new line)
3. Your moment is instantly saved to the Markdown file

### Editing Moments

- **Double-click** a moment to edit it inline
- Press **Enter** to save, **Escape** to cancel
- Or click the edit ✏️ button that appears on hover

### Deleting Moments

- Click the delete 🗑️ button that appears on hover
- A toast notification appears with an **Undo** option

### Searching Moments

- Type in the search box to filter moments
- Search is instant with debouncing for performance

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **Storage file path** | Where to store moments | `Moments.md` |
| **Auto-create file** | Create file if it doesn't exist | `true` |
| **New entry position** | Insert new moments at top or bottom | `Top (newest first)` |
| **Enter key behavior** | Enter to save, or Shift+Enter to save | `Enter to save` |
| **Double-click to edit** | Enable inline editing | `true` |
| **Show timestamps** | Display creation time on moments | `true` |
| **Timestamp format** | Format string (moment.js) | `YYYY-MM-DD HH:mm` |
| **Show search box** | Display the search filter | `true` |
| **Maximum entries to display** | Limit for performance (0 = no limit) | `200` |
| **Soft delete to archive** | Move deleted items to archive section | `false` |

## File Format

Moments stores data as a simple Markdown list:

```markdown
---
moments-plugin: true
---

- 2026-01-02 10:21 This is a moment #tag [[Link]]
  Second line of content
  ^m-abc123

- 2026-01-02 09:15 Another moment
  ^m-def456
```

Each moment includes:
- **Timestamp prefix**: When it was created
- **Content**: Your text with Markdown support
- **Block ID**: Unique identifier for stable editing

## Commands

| Command | Description |
|---------|-------------|
| `Moments: Open Moments` | Open or focus the Moments view |
| `Moments: Quick capture` | Open Moments and focus the input |
| `Moments: Toggle search` | Focus the search box |

## Development

```bash
# Install dependencies
npm install

# Development mode (watch)
npm run dev

# Production build
npm run build

# Lint
npm run lint
```

## License

[MIT](LICENSE)

## Credits

Inspired by the minimalist design philosophy of [obsidian-kanban](https://github.com/mgmeyers/obsidian-kanban).
