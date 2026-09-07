# Widget Developer Guide 2.0

This guide explains how to build a widget for the mirror platform: a small, sandboxed
web app that gets embedded on a shared always-on display alongside other widgets. If
you can write HTML/CSS/JS, you can build a widget — no native/Android code required.

---

## 1. Quick Start

1. Pick a unique **widgetID** (see [naming rules](#plugin-json-manifest)).
2. Create a folder with that ID containing `manifest.json` and `index.html`.
3. Build your UI with plain HTML/CSS/JS. Design it to fill *whatever* container it's
   given — you don't control your own size or position (see [Layout](#4-layout-system)).
4. Only request the [permissions](#5-permissions) you actually use.
5. Optionally ship an `example_config.txt` so users get a sensible starting config.
6. Package the folder for distribution (zip / git repo / shared catalog).

---

## 2. How Widgets Work

- Each widget is a self-contained mini web app that gets loaded into its own
  **sandboxed iframe** on the shared display.
- The host page automatically injects a small bridge script before your widget loads.
  You never add this yourself — as soon as your page runs, `window.mirror` is already
  available.
- **You do not control where or how big your widget is.** Placement (grid cell,
  span, or fixed position) is chosen by whoever configures the mirror, not by you as
  the widget author. Your job is to make the widget look good at *any* size it's
  given.
- Widgets are single-page apps. There's no multi-page navigation — build one page
  that updates itself over time (timers, polling, bridge events).
- The iframe sandbox allows scripts, forms, and same-origin storage, but **not**
  popups, top-level navigation, or native browser dialogs. See
  [Sandbox Limitations](#7-sandbox-limitations).

---

## 3. File & Folder Structure

A widget is a folder containing at minimum:

```
my-widget/
├── manifest.json          # required — manifest
├── index.html            # required — entry point
├── style.css
├── script.js
├── example_config.txt    # optional — suggested config snippet
└── assets/
    ├── icon.png
    ├── logo.svg
    └── font.woff2
```

**Rule: the root of your widget folder may only contain `.txt`, `.json`, `.js`,
`.css`, and `.html` files.** Anything else — images, fonts, audio, video, or any
other binary/media asset — must live inside an `assets/` subfolder (nested folders
inside `assets/` are fine), and be referenced with a relative path:

```html
<img src="assets/icon.png" alt="">
<link rel="preload" href="assets/font.woff2" as="font" type="font/woff2" crossorigin>
```

Always use **relative paths** within your own folder (`assets/x.png`, `./script.js`).
Never hardcode absolute URLs to your own files — the exact host your widget is
served from is an internal implementation detail and isn't something you should rely
on. Your widget also cannot read files outside its own folder.

### manifest.json (manifest)

| Field | Required | Rules |
|---|---|---|
| `widgetID` | ✅ | 1–128 chars, must start with a letter/digit, then letters/digits/`.`/`_`/`-` only. Cannot be `.` or `..`. This also becomes your widget's install folder name — keep it unique, e.g. reverse-DNS style (`com.yourname.clock`). |
| `name` | ✅ | 1–30 chars, single line. Shown to users. |
| `author` | ✅ | 1–30 chars, single line. |
| `source_link` | ✅ | Link to your widget's source/repo. |
| `description` | ➖ | Free text, shown to users if present. |
| `version` | ✅ | 1–20 chars (letters/digits/punctuation/spaces). |
| `permissions` | ➖ | Array of permission strings. See [Permissions](#5-permissions). Unknown strings are simply ignored — no unlock. |

```json
{
  "widgetID": "com.example.simpleclock",
  "name": "Simple Clock",
  "author": "Jane Doe",
  "source_link": "https://github.com/janedoe/mirror-clock",
  "description": "A minimal digital clock.",
  "version": "1.0.0",
  "permissions": []
}
```

### example_config.txt (optional)

A JSON snippet — one config object, or an array of them — that a user can choose to
merge into their own mirror configuration when they install your widget. Use it to
suggest sensible defaults (grid placement, starting `params`):

```json
{
  "widgetID": "com.example.simpleclock",
  "row": 0,
  "column": 0,
  "rowSpan": 1,
  "columnSpan": 1,
  "params": { "format": "24h" }
}
```

This is a convenience for the *user configuring their mirror* — it is not read or
used by your widget at runtime.

---

## 4. Layout System

Widget placement is entirely controlled by whoever configures the mirror, via config
entries. As a widget author you should design fluidly and, where relevant, document
what placement makes sense for your widget in your README/`example_config.txt`.

### Grid placement (recommended)

The default and recommended system. The mirror is divided into a configurable grid
(rows × columns, e.g. 3×3 by default — the user can change this). A config entry
places a widget with:

- `row`, `column` — zero-indexed cell coordinates.
- `rowSpan`, `columnSpan` — how many cells to span (default `1`). Out-of-range
  spans are automatically clamped to fit the grid, so a misconfigured entry never
  breaks the layout. Be aware that the user controlls the ammount of cells in each direction. 
  The `...Span`-propperties are only used to define the aspect ratio while the position will 
  be done by the user

**Multiple widgets can share the exact same cell/span.** When that happens, they
automatically split the available space evenly (side-by-side or stacked, depending
on the mirror's split-direction setting) rather than overlapping. This means:

> You cannot assume you'll get the full width/height of your assigned cell — a
> sibling widget could be placed in the same spot at any time. **Always build fluid
> layouts** (`%`, `vw`/`vh`, `flex`, `clamp()`) rather than fixed pixel dimensions.

If you need a widget to always render at its full assigned footprint regardless of
siblings (e.g. a decorative full-bleed background widget), a config entry can set
`"overflow": true` to opt out of the auto-split behavior.

### Absolute (x/y) placement — special cases only

A config entry can instead provide `x`, `y`, `width`, and `height` (all in abstract,
density-scaled "block" units, roughly comparable to 30dp each) to pin a widget at a
fixed position/size outside the grid entirely. This is useful for rare cases like a
persistent corner overlay, but it **loses the automatic adaptivity** of the grid
system — it won't rescale sensibly across different displays or grid configurations.
Prefer the grid system unless you have a specific reason not to.

### Visibility

Every config entry has `default_visible` (default `true`) controlling whether the
widget is shown on mirror startup. Visibility can also be toggled at runtime by
widgets holding the `mirror_management` permission (see below), and you can react to
your own visibility changing:

```js
window.mirror.host.on('visibility', ({ visible }) => {
  visible ? resumeUpdates() : pauseUpdates();
});
```

Pausing timers/polling/animations while hidden is good practice — it saves battery
and avoids wasted native calls.

---

## 5. Permissions

Declare only what you use, in the `permissions` array of `manifest.json`. Permissions
marked **sensitive** are highlighted to the user before they install/update your
widget, since they grant broader access.

| Permission | Sensitive | Unlocks |
|---|---|---|
| `camera` | ✅ | `navigator.mediaDevices.getUserMedia({ video: true })` |
| `microphone` | ✅ | `navigator.mediaDevices.getUserMedia({ audio: true })` |
| `location` | ✅ | `navigator.geolocation.*` |
| `calendar` | ✅ | `window.mirror.native.calendar.*` (read-only device calendar) |
| `mirror_management` | ✅ | `window.mirror.native.reloadRoot()`, `window.mirror.native.widgets.*` |
| `websocket` | — | `window.mirror.native.ws.*` |
| `local_network` | ✅ | Allows `webFetch`/`ws.connect` to target loopback/LAN hosts (combine with `webfetch` or `websocket`) |
| `webfetch` | — | `window.mirror.native.webFetch(...)` |
| `dialog` | — | `window.mirror.native.dialog(...)` |
| `sensors` | — | Ambient sensor bridge + browser motion/orientation events |
| `fullscreen` | — | `element.requestFullscreen()` |
| `picture_in_picture` | — | `videoEl.requestPictureInPicture()` |
| `midi` | — | `navigator.requestMIDIAccess()` |

**No permission needed:** `window.mirror.native.toast(...)`, autoplay, and
Encrypted Media (DRM) playback are always available to every widget.

Declaring a sensitive permission is necessary but not always *sufficient* — for
`camera`/`microphone`/`location`/`calendar`, the person running the mirror must also
grant the underlying OS permission the first time it's needed. Always handle the
"denied" case gracefully (calendar calls resolve with an error string; media/geo
calls reject their promise) rather than assuming access is guaranteed.

---

## 6. Available APIs

### 6.1 The `window.mirror` bridge

Everything under `window.mirror.native.*` returns a `Promise` and times out
(rejecting) after roughly 25 seconds if nothing responds — always handle rejection.

```js
// Per-instance configuration set by whoever placed this widget (the "params" field
// of its config entry). Use this for anything you want the end user to customize.
const params = await window.mirror.native.getParams();

// Native modal dialog (auto-dismisses after timeoutMs, default 8s)
window.mirror.native.dialog({
  title: 'Reminder',
  message: 'Time to water the plants!',
  timeoutMs: 6000,
});

// Lightweight toast — no permission required
window.mirror.native.toast({
  message: 'Data refreshed',
  position: 'bottom-right', // top | bottom | top-left | top-right | bottom-left | bottom-right
  timeoutMs: 2500,
});

// HTTP(S) fetch that bypasses browser CORS (needs "webfetch"; add "local_network"
// for loopback/LAN hosts)
const response = await window.mirror.native.webFetch('https://api.example.com/weather', {
  method: 'GET',
  headers: { Accept: 'application/json' },
});
if (response.status === 200) {
  const data = response.json ?? JSON.parse(response.body);
  render(data);
}

// WebSocket bridge (needs "websocket"; add "local_network" for loopback/LAN hosts).
// The connect promise only resolves the initial handshake — subsequent traffic
// arrives as native events, not promise results.
const { connectionId } = await window.mirror.native.ws.connect('wss://example.com/socket');
window.mirror.native.on('ws:message', ({ connectionId: id, data, encoding }) => {
  if (id !== connectionId) return;
  console.log('message:', encoding === 'text' ? data : atob(data));
});
window.mirror.native.on('ws:close', ({ connectionId: id, code, reason }) => {
  if (id === connectionId) console.log('closed:', code, reason);
});
await window.mirror.native.ws.send(connectionId, 'hello');

// Read-only calendar (needs "calendar" + OS grant)
const events = await window.mirror.native.calendar.getEvents(
  Date.now(),
  Date.now() + 7 * 24 * 60 * 60 * 1000
);

// Ambient device sensors — see note below (needs "sensors")
const snapshot = await window.mirror.native.sensor.readDeviceSensors();
await window.mirror.native.sensor.subscribe(5000); // stream every 5s
window.mirror.native.on('sensor:data', (data) => updateReadout(data));

// Widget management — controls ANY widget on the mirror, including yourself
// (needs "mirror_management"); useful for building a dashboard/launcher widget
const widgets = await window.mirror.native.widgets.list();
await window.mirror.native.widgets.hide(someIndex);
await window.mirror.native.widgets.show(someIndex);
await window.mirror.native.reloadRoot(); // reloads the WHOLE mirror — use sparingly
```

You can also fire a dialog/toast as a one-way event instead of a promise call:

```js
window.mirror.host.send('toast', { message: 'Saved!' });
```

### 6.2 Standard browser APIs (unlocked by permissions)

Some capabilities are exposed through **standard web platform APIs**, gated by the
iframe's permission policy rather than a native call:

```js
// camera / microphone
const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

// location
navigator.geolocation.getCurrentPosition((pos) => console.log(pos.coords));

// device motion/orientation (part of "sensors")
window.addEventListener('devicemotion', (e) => console.log(e.acceleration));
window.addEventListener('deviceorientation', (e) => console.log(e.alpha, e.beta, e.gamma));

// fullscreen
document.documentElement.requestFullscreen();

// picture-in-picture
videoEl.requestPictureInPicture();

// Web MIDI
navigator.requestMIDIAccess().then((access) => { /* ... */ });
```

Note that `sensors` covers two different things: standard motion/orientation events
(above) **and** the native ambient-sensor bridge (temperature, humidity, light,
proximity, pressure, magnetic field) shown in 6.1, since those aren't exposed by any
standard web API.

### 6.3 Storage & caching notes

- `localStorage`/`IndexedDB` work, but treat them as a **best-effort cache only**,
  not durable storage — a widget's storage partition can become inaccessible if its
  config entry is reordered relative to other entries. Anything that must survive
  reconfiguration belongs in `params` (via `getParams()`), which is set and owned
  by whoever configures the mirror.
- There's no HTTP cache — every reload re-fetches your files fresh. Keep asset
  sizes reasonable, and prefer bundling assets locally over fetching them remotely
  where practical.

---

## 7. Sandbox Limitations

Your widget runs in a locked-down iframe. Specifically, you **cannot**:

- Open popups or new windows (`window.open`, `target="_blank"` links won't work).
- Navigate the top-level page.
- Use native `alert()`, `confirm()`, or `prompt()` — use
  `window.mirror.native.dialog()`/`toast()` instead.
- Read or write files outside your own widget folder.
- Call any native Android API beyond the documented `window.mirror.native.*`
  bridge — there is no general-purpose native access.

Regular cross-origin `fetch()`/`XMLHttpRequest` from your widget is still subject to
normal browser CORS rules; if a third-party API doesn't send permissive CORS
headers, use `window.mirror.native.webFetch()` instead, which makes the request
natively and isn't subject to browser CORS.

---

## 8. Testing Tips

- You can preview your HTML/CSS/JS in a normal browser tab for layout/styling, but
  `window.mirror` won't exist there — guard native calls if you want a graceful
  standalone preview:
  ```js
  if (window.mirror) {
    window.mirror.native.getParams().then(applyParams);
  }
  ```
- Test your layout at multiple sizes — narrow columns, full-row spans, and shared
  cells with a sibling widget — since you don't control which one you'll get.
- Test the "permission denied" and "no data" paths, not just the happy path.

---

## 9. Design Guide

The visual language is inspired by classic "magic mirror" style displays: minimal,
glanceable, and built to disappear into a dark pane of glass rather than look like
an app.

- **Transparent, black-friendly background.** Never paint an opaque background —
  let the mirror's black background show through (`background: transparent;` on
  `html`/`body` and your root element). Design as if your widget is floating text
  and icons on black glass, not a card on a page.
- **No chrome.** Skip borders, drop shadows, card backgrounds, and skeuomorphic
  decoration. Content should read as light directly on black.
- **Light text, generous contrast.** Favor white/light or a single accent color
  for text and icons, with strong contrast against black. Avoid low-contrast grays
  for anything meant to be read from across a room.
- **Fully fluid layout.** Never assume a fixed pixel size — use relative units
  (`%`, `vw`/`vh`, `flex`, `clamp()` for type scale) so your widget looks correct
  whether it's a full row or one of four widgets sharing a cell.
- **Legible at a distance.** Use larger, simple, high-legibility type. Avoid very
  thin font weights at small sizes. Bundle a web font locally in `assets/` if you
  need something specific — don't assume internet access.
- **Minimal, infrequent motion.** This is an ambient always-on display, not an
  interactive app. Keep animations subtle and updates infrequent; avoid large
  bright static regions held on screen for very long periods.
- **Respect empty space.** Don't fill every pixel — magic-mirror widgets typically
  favor a few clean lines of information over dense dashboards.
- **Icons over long text** where possible, since space is often tight and shared
  with neighboring widgets.

A good mental model: your widget should look like it was always part of the mirror,
not like a webpage embedded in one.
