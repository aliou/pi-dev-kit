# Components

TUI components render custom UI in the terminal. They are used in `ctx.ui.custom()`, `renderResult`, and other display contexts.

## Component Interface

```typescript
import type { Component, Theme } from "@mariozechner/pi-tui";

class MyComponent implements Component {
  render(maxWidth: number, maxHeight: number): string {
    return "Hello from my component";
  }

  // Optional: handle keyboard input
  handleInput?(key: string): void;
}
```

`render` is called whenever the TUI needs to repaint. Return a string (can include ANSI codes via theme helpers). `maxWidth` and `maxHeight` are the available terminal dimensions.

## Available Components from pi-tui

Before creating custom components, check if an existing one fits your need:

| Component | Description |
|---|---|
| `Text` | Styled text with wrapping |
| `Box` | Container with borders and padding |
| `Container` | Vertical/horizontal layout |
| `Spacer` | Empty space |
| `Input` | Text input field |
| `Editor` | Multi-line text editor |
| `SelectList` | Scrollable selection list |
| `SettingsList` | Key-value settings display |
| `Loader` | Loading spinner |
| `CancellableLoader` | Loader with cancel support |
| `Markdown` | Markdown rendering |
| `Image` | Image rendering (kitty/sixel protocol) |
| `TruncatedText` | Text with line limit and expand/collapse |

Import from `@mariozechner/pi-tui`:

```typescript
import { Text, Box, Container, SelectList } from "@mariozechner/pi-tui";
```

## Utility Components from pi-coding-agent

These are higher-level components for common extension patterns:

| Component | Description |
|---|---|
| `DynamicBorder` | Border that adjusts to content width |
| `BorderedLoader` | Loader inside a bordered box with optional cancel |
| `ToolExecutionComponent` | Standard tool execution display |

Import from `@mariozechner/pi-coding-agent`:

```typescript
import { DynamicBorder, BorderedLoader } from "@mariozechner/pi-coding-agent";
```

## Using ctx.ui.custom()

`custom()` displays a full-screen component and returns when the component calls `done()`.

```typescript
const result = await ctx.ui.custom<string>((tui, theme, kb, done) => {
  return new MyPickerComponent(theme, items, (selected) => done(selected));
});
```

Parameters passed to the factory:
- `tui`: The TUI instance (rarely needed directly).
- `theme`: Current theme for styling.
- `kb`: Keybinding configuration.
- `done(value)`: Call to close the component and return the value.

The generic type (`<string>` above) is the type of value passed to `done()`.

Mode behavior:
- Interactive: returns the value passed to `done(value)`.
- RPC: returns `undefined` (by design; no local TUI).
- Print: returns `undefined`.

Important: `undefined` is ambiguous. In Interactive mode you can also produce it yourself by calling `done(undefined)`. If you need to detect RPC fallback, use explicit non-undefined sentinels for interactive close paths (`null`, `"closed"`, `false`, etc.).

See `references/modes.md` for the three-tier pattern.

## Theme Styling

All render functions receive a `theme` object for consistent styling:

```typescript
// Foreground colors
theme.fg("toolTitle", text)    // Tool names
theme.fg("accent", text)       // Highlights
theme.fg("success", text)      // Green
theme.fg("error", text)        // Red
theme.fg("warning", text)      // Yellow
theme.fg("muted", text)        // Secondary text
theme.fg("dim", text)          // Tertiary text

// Text styles
theme.bold(text)
theme.italic(text)
theme.strikethrough(text)
```

## `renderResult` is not a Component

`renderResult` is a plain render function. It returns a string (or `undefined`) and is not an interactive `Component` class.

```typescript
renderResult(result, { expanded, isPartial }, theme) {
  if (isPartial) return theme.fg("muted", "Loading...");

  const items = result.details?.items ?? [];
  const visible = expanded ? items : items.slice(0, 5);
  return [
    theme.fg("success", `Found ${items.length} results`),
    ...visible.map((item: string) => `  ${theme.fg("accent", item)}`),
  ].join("\n");
},
```

For full `renderCall`/`renderResult` formatting rules, follow `references/tools.md` (Tool UI Rendering Guidelines + consistency contract).

## Keyboard Handling in custom()

Interactive components handle keyboard input through `handleInput`:

```typescript
class MyComponent implements Component {
  private done: (value: string | null) => void;

  constructor(done: (value: string | null) => void) {
    this.done = done;
  }

  handleInput(key: string) {
    if (key === "escape" || key === "q") {
      this.done(null); // Cancel (explicit sentinel)
    }
    if (key === "return") {
      this.done("selected"); // Confirm
    }
  }

  render(maxWidth: number, maxHeight: number): string {
    return "Press Enter to confirm, Esc to cancel";
  }
}
```

## Code Highlighting

For displaying code in renderers:

```typescript
import { highlightCode, getLanguageFromPath } from "@mariozechner/pi-coding-agent";

const lang = getLanguageFromPath("/path/to/file.ts"); // "typescript"
const highlighted = highlightCode(code, lang, theme);
```
