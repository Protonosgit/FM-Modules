\# FantasticMirror Widget Developer Guide



A widget is a small self-contained web app (HTML/CSS/JS) that runs inside its own sandboxed `<iframe>` on the mirror display. This guide covers everything you need to know to build one: the files you ship, how to declare and request permissions, and the JavaScript API available to you at runtime.



\---



\## 1. What you ship



A widget folder contains:



| File | Required | Purpose |

|---|---|---|

| `plugin.json` | Yes | Widget manifest — identity, metadata, requested permissions |

| `index.html` | Yes | Entry point. The mirror bridge script is auto-injected into `<head>` before it loads |

| `example\_config.txt` | No | A suggested config snippet, offered to the user at install time (see below) |

| any other assets | No | CSS, JS, images, etc. served relative to your folder |



Your widget is served over `https://`, so relative paths, `fetch()` to your own bundled assets, and same-origin behavior all work normally.



\### `plugin.json`



```json

{

&#x20; "widgetID": "com.example.clock",

&#x20; "name": "Simple Clock",

&#x20; "author": "Jane Doe",

&#x20; "source\_link": "https://github.com/example/clock-widget",

&#x20; "description": "A minimal digital clock.",

&#x20; "version": "1.0.0",

&#x20; "permissions": \["dialog", "toast"]

}

```



| Field | Required | Notes |

|---|---|---|

| `widgetID` | Yes | Must start with a letter/digit, then only letters, digits, `.`, `\_`, `-` (max 128 chars). Used as your install folder name — keep it globally unique, e.g. reverse-DNS style. |

| `name` | Yes | Display name |

| `author` | Yes | |

| `source\_link` | Yes | |

| `description` | Yes | |

| `version` | Yes | |

| `permissions` | No | Array of permission strings your widget needs (see §3). Omit or leave empty if none. |



All string fields must be non-empty. An invalid `plugin.json` is rejected at import — it's never re-validated afterward, so get it right up front.



\### `example\_config.txt`



A convenience file offered to users on first install so they don't have to hand-write a config entry. It's either a single instance object or an array of instance objects (see §2 for the shape). Trailing commas are tolerated.



\---



\## 2. How a widget is placed (config.json)



The end user places instances of your widget by adding entries to the app's global config. Each entry:



| Field | Default | Notes |

|---|---|---|

| `widgetID` | — | Must match your `plugin.json` |

| `x`, `y` | `0` | Position, in grid units (1 unit ≈ 30dp) |

| `width`, `height` | `1` | Size, in grid units |

| `default\_visible` | `true` | Initial visibility |

| `params` | `{}` | Arbitrary JSON passed to your widget — see `getParams()` below |



> \*\*Known limitation:\*\* the config schema also accepts `x\_pos`/`y\_pos` (keyword positions like `"left"`/`"center"`/`"right"`) as an alternative to numeric `x`/`y`. This is \*\*not implemented yet\*\* — if `x\_pos`/`y\_pos` are present, `x`/`y` are silently left unset. Tell users to use numeric `x`/`y` for now.



A user can place multiple instances of the same widget; each gets its own zero-based \*\*index\*\* based on its position in the config array. That index is what other widgets use to reference it via the `widgets.\*` API.



\---



\## 3. Permissions



Permission strings go in `plugin.json`'s `permissions` array. They're \*\*case-sensitive\*\* — copy them exactly as below.



| Permission | Unlocks |

|---|---|

| `dialog` | Showing the shared on-screen modal via `mirror.native.dialog()` or `mirror.host.send('dialog', …)` |

| `toast` | Showing a small popup toast via `mirror.native.toast()` or `mirror.host.send('toast', …)` |

| `sensors` | The `sensor.readDeviceSensors()` call, \*\*and\*\* grants your iframe direct browser access to motion/orientation sensor APIs (accelerometer, gyroscope, magnetometer, generic Sensor, gamepad) |

| `mirror` | `reloadRoot()` — reloading the entire mirror page |

| `webfetch` | The `webFetch()` call. Note: lowercase, even though the JS method is `webFetch` |

| `websocket` | The `ws.connect()` call |

| `localNetwork` | Extends `webfetch`/`websocket` to reach loopback, link-local, and private-network hosts. Without it, requests to local/private IPs are blocked outright |

| `mirror\_management` | The `widgets.list()`/`show()`/`hide()` calls (control over other widget instances) |

| `camera` | Grants the iframe camera access (`getUserMedia` video); Android will prompt the user for the camera permission |

| `microphone` | Grants mic access; Android will prompt for the audio-recording permission |

| `location` | Grants the standard browser Geolocation API inside your iframe; Android will prompt for the location permission |

| `midi` | Grants Web MIDI API access |

| `picture\_in\_picture` | Grants the Picture-in-Picture API |

| `fullscreen` | Grants the Fullscreen API |



Only request what you actually use — unused permissions add friction for the user reviewing your widget at install time (sensitive ones like `camera`, `microphone`, `location`, and `mirror\_management` are flagged specially in the UI).



`encrypted-media` and `autoplay` are always allowed for every widget, no permission needed.



\### Sandbox constraints (apply to every widget, not permission-gated)



Your iframe runs with `sandbox="allow-scripts allow-forms allow-same-origin"`. That means:

\- \*\*No popups\*\* (`window.open` will not work)

\- \*\*No top-level navigation\*\* out of the mirror

\- \*\*No native browser dialogs\*\* — `alert()`, `confirm()`, `prompt()` are blocked. Use `mirror.native.dialog()` / `mirror.host.send('dialog', …)` instead (see below).



\---



\## 4. The `window.mirror` API



Every widget automatically gets a `window.mirror` object once loaded. All native calls return a `Promise` and reject after \*\*25 seconds\*\* if the host doesn't respond.



\### 4.1 `mirror.native`



```js

// Your instance's params from config.json

const params = await window.mirror.native.getParams();

```



| Call | Permission | Behavior |

|---|---|---|

| `getParams()` | none | Resolves with the `params` object from your config.json entry (`{}` if none set) |

| `dialog(config)` | `dialog` | Shows the shared on-screen modal. Resolves `true` on success, rejects with `"permission denied"` if you lack the permission. See below. |

| `toast(config)` | `toast` | Shows a small, non-blocking popup. Resolves `true` on success, rejects with `"permission denied"` if you lack the permission. See below. |

| `reloadRoot()` | `mirror` | Reloads the \*\*entire\*\* mirror page — every widget, not just yours. Use sparingly. |

| `webFetch(url, options)` | `webfetch` | HTTP(S) fetch — see below |

| `sensor.readDeviceSensors()` | `sensors` | See below — currently returns placeholder data |

| `widgets.list()` | `mirror\_management` | Resolves with `\[{index, visible}, …]` for every configured instance |

| `widgets.show(index)` / `widgets.hide(index)` | `mirror\_management` | Toggles another instance's visibility (animated fade, \~250ms). This state is \*\*not persisted\*\* — it resets to `default\_visible` on the next full reload. |

| `ws.connect(url, options)` | `websocket` | See below |

| `ws.send(connectionId, data, binary)` | `websocket` | See below |

| `ws.close(connectionId, code, reason)` | `websocket` | Closes a connection you opened |

| `on(event, handler)` | — | Subscribe to native events (currently `ws:message`, `ws:close`) |

| `resize(height)` | — | \*\*Not implemented\*\* — will reject with an "unknown method" error. |

| `calendar.getEvents(start, end)` | — | \*\*Not implemented\*\* — will reject with an "unknown method" error. |



\*\*`dialog(config)`\*\*



```js

await window.mirror.native.dialog({

&#x20; title: 'Reminder',

&#x20; message: 'Water the plants',

&#x20; timeoutMs: 8000,   // 0 disables auto-hide; omit for the 8s default

&#x20; css: '.box { border: 2px solid tomato; }', // optional, styles the shared modal only

});

```



This shows a single, shared modal overlay on top of the whole mirror (not scoped to your iframe). Since it's shared, don't assume exclusive control over it — another widget or a timeout can dismiss it. Because this goes through `mirror.native`, you get a `Promise` back — `await` it (or `.catch()`) if you want to know whether it actually displayed.



\*\*`toast(config)`\*\*



```js

await window.mirror.native.toast({

&#x20; message: 'Saved!',

&#x20; position: 'bottom',   // 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' — default 'bottom'

&#x20; timeoutMs: 3000,       // 0 = sticky, stays until another toast pushes it out of the DOM won't happen automatically — dismiss it yourself via a fresh call

&#x20; css: '.toast { background: #2a2; }', // optional, scoped to just this toast — never affects other toasts or widgets

});

```



Unlike the modal, toasts are non-blocking and multiple can be visible at once (in different positions, or stacked in the same zone). Each toast's `css` is fully scoped to itself, so it's safe for several widgets to fire toasts with different styling at the same time without interfering with each other. Prefer this over `dialog()` for routine, glanceable notices — reserve the modal for things that genuinely need the user's attention.



\*\*`webFetch(url, options)`\*\*



```js

const res = await window.mirror.native.webFetch('https://api.example.com/data', {

&#x20; method: 'GET',            // any HTTP verb, incl. non-standard ones (PROPFIND, etc.)

&#x20; headers: { 'Accept': 'application/json' },

&#x20; body: undefined,          // string; ignored for GET/HEAD

&#x20; ifNoneMatch: undefined,   // sets If-None-Match

&#x20; ifModifiedSince: undefined,

});

// res = { status, body, bodyEncoding: 'text' | 'base64', json?, headers: { etag?, lastModified?, contentType? } }

```



\- Only `http`/`https` schemes are allowed.

\- Up to 5 redirects are followed automatically.

\- Local/private-network targets are blocked unless you also have `localNetwork`.

\- Responses are capped at 2MB and time out after 10 seconds.

\- Text-like responses come back in `body` as a string, with a best-effort auto-parsed `json` field if the body looks like JSON. Binary responses come back as base64 in `body` with `bodyEncoding: "base64"`.



\*\*`sensor.readDeviceSensors()`\*\*



Resolves with an object containing only the keys for sensors physically present on the device, e.g.:



```js

{ ambientTemperature: 0.0, light: 0.0, proximity: 0.0, pressure: 0.0 }

// magneticFieldX / magneticFieldY / magneticFieldZ appear together if a magnetometer is present

```



> Presence indicates the sensor exists — the values themselves are currently fixed placeholders (`0.0`), not live readings. Don't build features that depend on real sensor data yet.



\*\*WebSockets\*\*



```js

const { connectionId } = await window.mirror.native.ws.connect('wss://example.com/socket');



window.mirror.native.on('ws:message', ({ connectionId, data, encoding }) => {

&#x20; // encoding is 'text' or 'base64'

});

window.mirror.native.on('ws:close', ({ connectionId, code, reason, error }) => { /\* ... \*/ });



await window.mirror.native.ws.send(connectionId, 'hello');                 // text

await window.mirror.native.ws.send(connectionId, base64Payload, true);     // binary (base64-encoded)

window.mirror.native.ws.close(connectionId, 1000, 'done');

```



\- Only `ws`/`wss` schemes are allowed; local/private targets need `localNetwork` too.

\- Inbound messages and closures arrive via `on('ws:message', …)` / `on('ws:close', …)`, \*\*not\*\* through the `connect()` promise — register your handlers so you don't miss anything, and match on `connectionId` if you have more than one socket open.



\*\*`widgets.list()` / `widgets.show()` / `widgets.hide()`\*\*



```js

const instances = await window.mirror.native.widgets.list();

// \[{ index: '0', visible: true }, { index: '1', visible: false }, …]



await window.mirror.native.widgets.hide('1');

await window.mirror.native.widgets.show('1');

```



These are handled locally by the mirror page itself (they never leave the WebView), so they resolve fast and don't count against any native round-trip budget. `show`/`hide` fade the target iframe in or out over \~250ms; the target widget is notified via its own `visibility` host event (see §4.2).



\### 4.2 `mirror.host`



A lightweight pub/sub channel between your widget and the mirror page itself.



```js

window.mirror.host.send(event, data);

window.mirror.host.on(event, handler);

```



Two events are handled by default — \*\*`dialog`\*\* and \*\*`toast`\*\* — as fire-and-forget equivalents of `mirror.native.dialog()` / `mirror.native.toast()`:



```js

window.mirror.host.send('dialog', {

&#x20; title: 'Reminder',

&#x20; message: 'Water the plants',

&#x20; timeoutMs: 8000,

&#x20; css: '.box { border: 2px solid tomato; }',

});



window.mirror.host.send('toast', {

&#x20; message: 'Synced',

&#x20; position: 'top-right',

&#x20; timeoutMs: 2500,

});

```



The behavior is identical to the `mirror.native` equivalents, minus the `Promise` — you don't get confirmation of success or a `"permission denied"` rejection back. \*\*Prefer `mirror.native.dialog()` / `mirror.native.toast()`\*\* when you care whether the call actually went through; use `mirror.host.send()` only when you're firing and forgetting.



Sending any other event name currently has no effect (there's no handler registered for it).



\*\*Listening for host events\*\*



```js

window.mirror.host.on('visibility', ({ visible }) => { /\* your widget was shown/hidden \*/ });

```



`visibility` fires on your own widget when another widget (with `mirror\_management`) calls `widgets.show()`/`widgets.hide()` on your index.



\---



\## 5. Design guidance



The app follows a MagicMirror-style philosophy: an always-on, glanceable display rather than an app you actively operate. Keep that in mind:



\- \*\*Transparent, dark-first UI.\*\* The mirror background is black and your iframe background is transparent by default — design for a dark surface with light, high-contrast text so widgets blend into the "mirror" rather than showing a white box.

\- \*\*Glanceable, not interactive.\*\* Favor passive, self-updating content (clocks, weather, calendars, feeds) over multi-step flows. There's no mouse/keyboard in typical use, and native dialogs are blocked. For brief, passive notices, reach for `toast()` first — it doesn't interrupt the whole display the way the shared modal does. Treat the modal (`dialog()`) as a rare interruption for things that genuinely need attention, not a routine UI pattern.

\- \*\*Fixed real estate.\*\* Your widget's `width`/`height` are fixed pixel dimensions set by the user's config, not fluid — design layouts that degrade gracefully at a fixed size rather than assuming responsive reflow.

\- \*\*Self-sufficient.\*\* Update yourself on a timer or via your own WebSocket/fetch polling rather than waiting on user input. A widget that just sits and renders the same thing until someone interacts with it isn't a good fit for this environment.

\- \*\*Minimal chrome.\*\* Skip borders, drop shadows, and heavy card backgrounds — let content sit directly on the black canvas, consistent with the rest of the mirror.

\- \*\*Request the minimum permissions.\*\* Sensitive permissions are surfaced prominently to the user before they install — only ask for what your widget actually needs.



\---



\## 6. Quick-start checklist



\- \[ ] `plugin.json` with all required fields and a minimal `permissions` list

\- \[ ] `index.html` as your entry point, transparent/dark background

\- \[ ] Use `getParams()` for any user-configurable settings instead of hardcoding

\- \[ ] Use `mirror.native.toast()` for routine notices, `mirror.native.dialog()` only for things that need real attention — both need their matching permission

\- \[ ] Design for a fixed-size, non-interactive, dark display

\- \[ ] Only request the permissions you actually call

