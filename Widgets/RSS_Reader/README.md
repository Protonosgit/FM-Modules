# Mirror RSS Reader Plugin

Fetches an RSS or Atom feed and displays headlines, styled per the
MagicMirror-style design guidelines (transparent background, thin type,
single accent color).

## Install

1. In the app, use **Select folder** (SAF picker) and choose this `mirror-rss`
   folder. It will be imported under the `widgetID` `com.example.rssreader`.
2. Add an instance for it in `config.json` — **this plugin requires the
   `webfetch` permission**, and you must set `feedUrl` in `params`. See
   `config.example.json` for a fully-specified example. Minimal entry:

   ```json
   {
     "widgetID": "com.example.rssreader",
     "x": 0, "y": 0, "width": 6, "height": 4,
     "default_visible": true,
     "permissions": ["webfetch"],
     "params": { "feedUrl": "https://example.com/feed.xml" }
   }
   ```

3. If your feed URL points at a loopback / link-local / private (RFC1918/ULA)
   host — e.g. a self-hosted feed on your LAN — also add the `localNetwork`
   permission, or the fetch will throw a `blocked:` error.

## Customization (`params`)

All fields but `feedUrl` are optional; omitted fields fall back to the
defaults below.

| Param | Type | Default | Notes |
|---|---|---|---|
| `feedUrl` | string | *(required)* | RSS 2.0 or Atom feed URL. `http`/`https` only. |
| `displayMode` | `"cycle"` \| `"list"` | `"cycle"` | `cycle` fades through one headline at a time; `list` shows several stacked. |
| `maxItems` | number | `8` | Items kept from the feed, in both modes. |
| `cycleSeconds` | number | `8` | Cycle mode: seconds each headline is shown. |
| `refreshMinutes` | number | `15` | How often the feed is refetched. |
| `showDate` | boolean | `true` | Shows the item's publish date. |
| `showSource` | boolean | `true` | Shows the item's link hostname (e.g. `bbc.co.uk`). |
| `showDescription` | boolean | `false` | List mode only — shows a truncated summary under each title. |
| `descriptionMaxChars` | number | `140` | Truncation length for `showDescription`. |
| `locale` | BCP 47 string or `null` | `null` | e.g. `"de-DE"`. `null` = device locale. |
| `dateStyle` | `"full"` \| `"long"` \| `"medium"` \| `"short"` | `"medium"` | Passed to `Intl.DateTimeFormat`. |
| `accentColor` | CSS color string | `"#6fb7ff"` | Used for source/date metadata. |

## Behavior notes

- Both RSS 2.0 (`<item>`) and Atom (`<entry>`) feeds are parsed automatically
  — whichever the plugin finds first in the document.
- HTML in item descriptions is stripped down to plain text before display.
- If a scheduled refresh fails (feed temporarily down, network blip), the
  widget keeps showing the last successfully-loaded headlines rather than
  going blank. An error message only appears on a cold start with no data
  yet.
- `webFetch` — and therefore this plugin — is subject to the app's usual
  limits: 2MB response cap, 10s timeout, up to 5 redirect hops, `http`/`https`
  only (see §7 of the developer guide).
- Titles are clamped to 2–3 lines and dates/sources ellipsize rather than
  wrap, so pick a `width`/`height` generous enough for your feed's typical
  headline length.

## Permissions

- `webfetch` — required, to fetch the feed.
- `localNetwork` — only if `feedUrl` points at a loopback/private-network host.
