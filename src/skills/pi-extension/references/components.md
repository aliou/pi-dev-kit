# Components

TUI components render custom UI in Pi. Use them in `ctx.ui.custom()`, tool renderers, message renderers, widgets, custom footers, and custom editors.

## Component Interface

```typescript
import type { Component } from "@earendil-works/pi-tui";

class MyComponent implements Component {
  render(width: number): string[] {
    return ["Hello from my component"];
  }

  handleInput?(data: string): void;

  invalidate(): void {
    // Clear cached render state.
  }
}
```

Rules:

- `render(width)` returns one string per line.
- Each rendered line must fit within `width`.
- Use `truncateToWidth()` or `wrapTextWithAnsi()` for long lines.
- Implement `invalidate()` and clear cached themed output.
- Use `matchesKey()` for key handling.

If a component displays a text cursor or embeds `Input`/`Editor`, implement `Focusable` and propagate `focused` to the child input so IME candidate windows appear in the right place.

## Built-in Components

Import common components from `@earendil-works/pi-tui`:

```typescript
import {
  Box,
  Container,
  Image,
  Input,
  Markdown,
  SelectList,
  SettingsList,
  Spacer,
  Text,
} from "@earendil-works/pi-tui";
```

Use existing components before creating your own:

| Component | Use for |
|---|---|
| `Text` | Wrapped multi-line text. |
| `Box` | Padded/background container. |
| `Container` | Vertical grouping of child components. |
| `Spacer` | Empty vertical space. |
| `Input` | Single-line text input. |
| `Editor` | Multi-line editor. |
| `SelectList` | Searchable/scrollable pickers. |
| `SettingsList` | Toggle and settings rows. |
| `Markdown` | Markdown with syntax highlighting. |
| `Image` | Inline images in supported terminals. |

Higher-level Pi components come from `@earendil-works/pi-coding-agent`:

```typescript
import {
  BorderedLoader,
  CustomEditor,
  DynamicBorder,
  getMarkdownTheme,
  getSettingsListTheme,
} from "@earendil-works/pi-coding-agent";
```

## `ctx.ui.custom()`

`custom()` temporarily replaces the editor with your component until `done(value)` is called.

```typescript
const result = await ctx.ui.custom<string | null>((tui, theme, keybindings, done) => {
  const list = new SelectList(items, Math.min(items.length, 10), {
    selectedPrefix: (text) => theme.fg("accent", text),
    selectedText: (text) => theme.fg("accent", text),
    description: (text) => theme.fg("muted", text),
  });

  list.onSelect = (item) => done(item.value);
  list.onCancel = () => done(null);

  return {
    render: (width) => list.render(width),
    invalidate: () => list.invalidate(),
    handleInput: (data) => {
      list.handleInput?.(data);
      tui.requestRender();
    },
  };
});
```

Callback args:

- `tui`: request renders and inspect terminal state.
- `theme`: current theme. Do not import a global theme.
- `keybindings`: current app keybindings.
- `done(value)`: close and resolve.

Use explicit non-`undefined` sentinels for close/cancel paths (`null`, `false`, `"closed"`). In RPC and print modes, `custom()` returns `undefined`, so `done(undefined)` makes fallback detection ambiguous.

## Overlay Mode

Use overlays for modal or side-panel UI without clearing existing content.

```typescript
const result = await ctx.ui.custom<string | null>(
  (_tui, _theme, _keybindings, done) => new MyOverlay({ onClose: done }),
  {
    overlay: true,
    overlayOptions: {
      anchor: "right-center",
      width: "50%",
      maxHeight: "80%",
      margin: 2,
      visible: (termWidth) => termWidth >= 80,
    },
  },
);
```

Overlay components are disposed when closed. Create a fresh instance each time you show one.

## Keyboard Handling

Use `matchesKey()` and `Key` from `pi-tui`.

```typescript
import { Key, matchesKey } from "@earendil-works/pi-tui";

handleInput(data: string): void {
  if (matchesKey(data, Key.up)) this.moveUp();
  if (matchesKey(data, Key.down)) this.moveDown();
  if (matchesKey(data, Key.enter)) this.confirm();
  if (matchesKey(data, Key.escape)) this.cancel();
}
```

Common IDs include `Key.enter`, `Key.escape`, `Key.tab`, `Key.up`, `Key.down`, `Key.left`, `Key.right`, `Key.ctrl("c")`, and `Key.ctrlShift("p")`.

## Line Width and ANSI

Rendered lines must not exceed the provided width.

```typescript
import { truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";

render(width: number): string[] {
  return wrapTextWithAnsi(this.theme.fg("accent", this.text), width);
}
```

Use:

- `visibleWidth(str)` to measure display width without ANSI codes.
- `truncateToWidth(str, width, ellipsis?)` for single-line truncation.
- `wrapTextWithAnsi(str, width)` for wrapping styled text.

## Theming

Use the `theme` passed into render/custom callbacks.

```typescript
theme.fg("accent", text);
theme.fg("muted", text);
theme.fg("success", text);
theme.fg("error", text);
theme.bg("toolPendingBg", text);
theme.bold(text);
```

For markdown in a tool or message renderer:

```typescript
const markdown = new Markdown(content, 0, 0, getMarkdownTheme());
```

If a component caches strings that already include theme escape codes, rebuild those strings in `invalidate()` so theme changes apply correctly.

## Common Patterns

### Selection dialog

Use `SelectList` with `DynamicBorder`.

```typescript
const result = await ctx.ui.custom<string | null>((tui, theme, _keybindings, done) => {
  const container = new Container();
  container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
  container.addChild(new Text(theme.fg("accent", theme.bold("Pick an option")), 1, 0));

  const list = new SelectList(items, Math.min(items.length, 10), {
    selectedPrefix: (t) => theme.fg("accent", t),
    selectedText: (t) => theme.fg("accent", t),
    description: (t) => theme.fg("muted", t),
    scrollInfo: (t) => theme.fg("dim", t),
    noMatch: (t) => theme.fg("warning", t),
  });
  list.onSelect = (item) => done(item.value);
  list.onCancel = () => done(null);

  container.addChild(list);
  container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

  return {
    render: (width) => container.render(width),
    invalidate: () => container.invalidate(),
    handleInput: (data) => {
      list.handleInput?.(data);
      tui.requestRender();
    },
  };
});
```

### Async operation with cancel

Use `BorderedLoader`.

```typescript
const result = await ctx.ui.custom<string | null>((_tui, theme, _keybindings, done) => {
  const loader = new BorderedLoader(_tui, theme, "Fetching data...");
  loader.onAbort = () => done(null);

  fetchData(loader.signal)
    .then((data) => done(data))
    .catch(() => done(null));

  return loader;
});
```

### Settings list

Use `SettingsList` and `getSettingsListTheme()` for toggles. For full extension settings, prefer `registerSettingsCommand` from `@aliou/pi-utils-settings`.

### Widgets and status

```typescript
ctx.ui.setStatus("my-extension", ctx.ui.theme.fg("accent", "active"));
ctx.ui.setStatus("my-extension", undefined);

ctx.ui.setWidget("my-extension", ["Line 1", "Line 2"]);
ctx.ui.setWidget("my-extension", ["Below editor"], { placement: "belowEditor" });
ctx.ui.setWidget("my-extension", undefined);
```

String-array widgets also work in RPC mode. Component widgets are TUI-only.

### Custom footer

```typescript
ctx.ui.setFooter((tui, theme, footerData) => ({
  invalidate() {},
  render(width: number): string[] {
    const branch = footerData.getGitBranch() ?? "no git";
    return [theme.fg("dim", `${ctx.model?.id ?? "no model"} (${branch})`)];
  },
  dispose: footerData.onBranchChange(() => tui.requestRender()),
}));

ctx.ui.setFooter(undefined);
```

### Custom editor

Extend `CustomEditor`, not the base editor, so app keybindings still work.

```typescript
class VimEditor extends CustomEditor {
  private mode: "normal" | "insert" = "insert";

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape) && this.mode === "insert") {
      this.mode = "normal";
      return;
    }
    super.handleInput(data);
  }
}

pi.on("session_start", (_event, ctx) => {
  ctx.ui.setEditorComponent((tui, theme, keybindings) => new VimEditor(tui, theme, keybindings));
});
```

Capture `ctx.ui.getEditorComponent()` before replacing the editor if you need to compose with another extension, then explicitly delegate to the previous component in your wrapper.

## Rendering Tools and Messages

`renderCall`, `renderResult`, and message renderers return `Component | undefined`, not raw strings.

```typescript
renderResult(result, options, theme) {
  if (options.isPartial) {
    return new Text(theme.fg("muted", "My Tool: loading..."), 0, 0);
  }
  return new Text(theme.fg("success", "Done"), 0, 0);
}
```

Return `undefined` only when fallback rendering is better than custom output.

## Mode Awareness

- Interactive mode supports all TUI APIs.
- RPC mode supports dialogs and fire-and-forget string events, but `custom()` returns `undefined`.
- JSON/print modes have no UI.

Read `references/modes.md` before using `ctx.ui.custom()` in commands or hooks.

## Checklist

- [ ] Existing components checked before custom component work.
- [ ] `render(width)` returns `string[]` and respects width.
- [ ] `invalidate()` clears cached themed output.
- [ ] Key handling uses `matchesKey()`.
- [ ] `ctx.ui.custom()` uses explicit sentinels and has RPC/print fallback.
- [ ] TUI-only methods are not treated as working in RPC.
- [ ] Tool/message renderers return components.
