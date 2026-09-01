(() => {
  "use strict";

  const DEFAULTS = Object.freeze({
    location: "Berlin, Germany",
    forecastDays: 5,
    showLocation: true,
    showAdditional: true,
    refreshMinutes: 15,
    temperatureUnit: "celsius",
    precipitationUnit: "mm",
  });

  const els = {
    location: document.getElementById("location"),
    updated: document.getElementById("updated"),
    currentIcon: document.getElementById("current-icon"),
    currentTemp: document.getElementById("current-temp"),
    humidity: document.getElementById("humidity"),
    highLow: document.getElementById("high-low"),
    forecast: document.getElementById("forecast"),
    additional: document.getElementById("additional"),
    additionalText: document.getElementById("additional-text"),
    status: document.getElementById("status"),
  };

  let params = { ...DEFAULTS };
  let timer = null;

  // Self-contained line-icon set (inline SVG, no network dependency). This
  // guarantees every weather scenario renders reliably — an external GIF/image
  // host would be a single point of failure in a sandboxed, offline-prone
  // WebView, so custom SVG was chosen over remote assets.
  const ICON_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';

  const ICONS = {
    sun: `<svg ${ICON_ATTRS}><circle cx="12" cy="12" r="4.1"/><line x1="12" y1="1.6" x2="12" y2="4.3"/><line x1="12" y1="19.7" x2="12" y2="22.4"/><line x1="1.6" y1="12" x2="4.3" y2="12"/><line x1="19.7" y1="12" x2="22.4" y2="12"/><line x1="4.7" y1="4.7" x2="6.6" y2="6.6"/><line x1="17.4" y1="17.4" x2="19.3" y2="19.3"/><line x1="4.7" y1="19.3" x2="6.6" y2="17.4"/><line x1="17.4" y1="6.6" x2="19.3" y2="4.7"/></svg>`,
    "sun-cloud": `<svg ${ICON_ATTRS}><circle cx="8.6" cy="7.8" r="3"/><line x1="8.6" y1="2.3" x2="8.6" y2="3.6"/><line x1="3.4" y1="7.8" x2="4.7" y2="7.8"/><line x1="4.6" y1="3.8" x2="5.5" y2="4.7"/><path d="M6.6 19.4h9.6a3.6 3.6 0 0 0 .5-7.16A4.5 4.5 0 0 0 8.3 10.4a3.5 3.5 0 0 0-1.7 9z"/></svg>`,
    cloud: `<svg ${ICON_ATTRS}><path d="M6 18.4h11.4a4 4 0 0 0 .5-7.96A5.15 5.15 0 0 0 8 8.5 4.05 4.05 0 0 0 6 18.4z"/></svg>`,
    fog: `<svg ${ICON_ATTRS}><line x1="3" y1="7.6" x2="21" y2="7.6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="16.4" x2="16.5" y2="16.4"/></svg>`,
    drizzle: `<svg ${ICON_ATTRS}><path d="M6 14h11a3.55 3.55 0 0 0 .4-7.08A4.65 4.65 0 0 0 8.4 5.3 3.65 3.65 0 0 0 6 14z"/><line x1="9" y1="17.8" x2="9" y2="19.2"/><line x1="13" y1="17.8" x2="13" y2="19.2"/><line x1="17" y1="17.8" x2="17" y2="19.2"/></svg>`,
    rain: `<svg ${ICON_ATTRS}><path d="M6 13h11a3.55 3.55 0 0 0 .4-7.08A4.65 4.65 0 0 0 8.4 4.3 3.65 3.65 0 0 0 6 13z"/><line x1="8.4" y1="16.8" x2="7.2" y2="20.2"/><line x1="12.4" y1="16.8" x2="11.2" y2="20.2"/><line x1="16.4" y1="16.8" x2="15.2" y2="20.2"/></svg>`,
    snow: `<svg ${ICON_ATTRS}><path d="M6 13h11a3.55 3.55 0 0 0 .4-7.08A4.65 4.65 0 0 0 8.4 4.3 3.65 3.65 0 0 0 6 13z"/><line x1="9" y1="16.4" x2="9" y2="20.4"/><line x1="7.2" y1="18.4" x2="10.8" y2="18.4"/><line x1="15" y1="16.4" x2="15" y2="20.4"/><line x1="13.2" y1="18.4" x2="16.8" y2="18.4"/></svg>`,
    thunder: `<svg ${ICON_ATTRS}><path d="M6 12.6h10.4a3.5 3.5 0 0 0 .4-6.96A4.6 4.6 0 0 0 8.4 4 3.6 3.6 0 0 0 6 12.6z"/><path d="M13.2 12.6l-3.1 5.4h2.7l-1.7 4.3 4.8-6.3h-2.7l1.6-3.4z" fill="currentColor" stroke="none"/></svg>`,
  };

  const WEATHER = {
    0: ["sun", "Clear sky"],
    1: ["sun-cloud", "Mainly clear"],
    2: ["sun-cloud", "Partly cloudy"],
    3: ["cloud", "Overcast"],
    45: ["fog", "Fog"],
    48: ["fog", "Rime fog"],
    51: ["drizzle", "Light drizzle"],
    53: ["drizzle", "Drizzle"],
    55: ["drizzle", "Heavy drizzle"],
    56: ["drizzle", "Freezing drizzle"],
    57: ["drizzle", "Heavy freezing drizzle"],
    61: ["rain", "Light rain"],
    63: ["rain", "Rain"],
    65: ["rain", "Heavy rain"],
    66: ["rain", "Freezing rain"],
    67: ["rain", "Heavy freezing rain"],
    71: ["snow", "Light snow"],
    73: ["snow", "Snow"],
    75: ["snow", "Heavy snow"],
    77: ["snow", "Snow grains"],
    80: ["rain", "Light showers"],
    81: ["rain", "Showers"],
    82: ["rain", "Heavy showers"],
    85: ["snow", "Snow showers"],
    86: ["snow", "Heavy snow showers"],
    95: ["thunder", "Thunderstorm"],
    96: ["thunder", "Thunderstorm with hail"],
    99: ["thunder", "Thunderstorm with heavy hail"],
  };

  function clampNumber(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.round(n)));
  }

  function normalizeParams(raw) {
    const p = raw && typeof raw === "object" ? raw : {};
    return {
      ...DEFAULTS,
      ...p,
      location: typeof p.location === "string" && p.location.trim() ? p.location.trim() : DEFAULTS.location,
      forecastDays: clampNumber(p.forecastDays, 1, 16, DEFAULTS.forecastDays),
      showLocation: p.showLocation !== false,
      showAdditional: p.showAdditional !== false,
      refreshMinutes: clampNumber(p.refreshMinutes, 5, 120, DEFAULTS.refreshMinutes),
      temperatureUnit: p.temperatureUnit === "fahrenheit" ? "fahrenheit" : "celsius",
      precipitationUnit: p.precipitationUnit === "inch" ? "inch" : "mm",
    };
  }

  async function nativeFetch(url) {
    if (!window.mirror?.native?.webFetch) {
      throw new Error("This widget requires the mirror webFetch API.");
    }
    const response = await window.mirror.native.webFetch(url, { method: "GET" });
    if (!response || response.status < 200 || response.status >= 300) {
      throw new Error(`Weather request failed (${response?.status ?? "no status"}).`);
    }
    if (response.json) return response.json;
    return JSON.parse(response.body);
  }

  async function geocode(location) {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", location);
    url.searchParams.set("count", "1");
    url.searchParams.set("language", "en");
    url.searchParams.set("format", "json");
    const data = await nativeFetch(url.toString());
    const first = data?.results?.[0];
    if (!first) throw new Error(`Location not found: ${location}`);
    return first;
  }

  async function fetchWeather(place) {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(place.latitude));
    url.searchParams.set("longitude", String(place.longitude));
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("forecast_days", String(params.forecastDays));
    url.searchParams.set("current", "temperature_2m,relative_humidity_2m,weather_code");
    url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max");
    url.searchParams.set("temperature_unit", params.temperatureUnit);
    url.searchParams.set("precipitation_unit", params.precipitationUnit);
    const data = await nativeFetch(url.toString());
    if (!data?.current || !data?.daily) throw new Error("Weather data was incomplete.");
    return data;
  }

  function weatherMeta(code) {
    return WEATHER[Number(code)] || ["cloud", "Weather"];
  }

  function iconMarkup(key) {
    return ICONS[key] || ICONS.cloud;
  }

  function formatTemp(value, digits = 0) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return "--°";
    return `${Number(value).toFixed(digits)}°`;
  }

  function dayLabel(dateString, index) {
    if (index === 0) return "Today";
    const date = new Date(`${dateString}T12:00:00`);
    return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date);
  }

  function render(place, data) {
    const currentMeta = weatherMeta(data.current.weather_code);
    const maxToday = data.daily.temperature_2m_max?.[0];
    const minToday = data.daily.temperature_2m_min?.[0];

    els.location.textContent = [place.name, place.admin1, place.country].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(", ");
    els.location.hidden = !params.showLocation;
    els.updated.textContent = `Updated ${new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
    els.currentIcon.innerHTML = iconMarkup(currentMeta[0]);
    els.currentIcon.setAttribute("title", currentMeta[1]);
    els.currentTemp.textContent = formatTemp(data.current.temperature_2m);
    els.humidity.textContent = `${Math.round(data.current.relative_humidity_2m)}%`;
    els.highLow.innerHTML = `<span class="high">${formatTemp(maxToday)}</span><span class="slash"> / </span><span class="low">${formatTemp(minToday)}</span>`;

    els.forecast.innerHTML = "";
    const times = data.daily.time || [];

    // Skip today (index 0) and start with tomorrow (index 1)
    times.slice(1).forEach((time, i) => {
      const dataIndex = i + 1;
      const card = document.createElement("article");
      card.className = "forecast-day";

      const meta = weatherMeta(data.daily.weather_code?.[dataIndex]);
      const rain = data.daily.precipitation_probability_max?.[dataIndex];

      card.innerHTML = `
        <div class="day-name">${escapeHtml(dayLabel(time, dataIndex))}</div>
        <div class="day-icon" aria-label="${escapeHtml(meta[1])}" title="${escapeHtml(meta[1])}">${iconMarkup(meta[0])}</div>
        <div class="range" aria-label="High ${formatTemp(data.daily.temperature_2m_max?.[dataIndex])}, low ${formatTemp(data.daily.temperature_2m_min?.[dataIndex])}">
          <span class="range-max">${formatTemp(data.daily.temperature_2m_max?.[dataIndex])}</span>
          <span class="range-min">${formatTemp(data.daily.temperature_2m_min?.[dataIndex])}</span>
        </div>
        <div class="day-rain">${rain === null || rain === undefined ? "" : `${Math.round(rain)}% rain`}</div>
      `;

      els.forecast.appendChild(card);
    });

    renderAdditional(data);
    els.status.hidden = true;
}
  function renderAdditional(data) {
    if (!params.showAdditional) {
      els.additional.hidden = true;
      return;
    }

    const todayRain = data.daily?.precipitation_probability_max?.[0];
    const code = Number(data.current?.weather_code);
    const notes = [];

    if ([95, 96, 99].includes(code)) notes.push("Thunderstorm conditions in the forecast");
    if ([71, 73, 75, 77, 85, 86].includes(code)) notes.push("Snow / wintry conditions");
    if ([45, 48].includes(code)) notes.push("Reduced visibility from fog");
    if (Number.isFinite(Number(todayRain)) && Number(todayRain) >= 30) notes.push(`Rain chance today up to ${Math.round(Number(todayRain))}%`);

    if (!notes.length) {
      els.additional.hidden = true;
      return;
    }
    els.additional.hidden = false;
    els.additionalText.textContent = notes.join(" · ");
  }

  function showError(error) {
    els.status.textContent = error?.message || "Unable to load weather.";
    els.status.hidden = false;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[ch]));
  }

  async function refresh() {
    try {
      const place = await geocode(params.location);
      const weather = await fetchWeather(place);
      render(place, weather);
    } catch (error) {
      showError(error);
      console.error("Weather widget:", error);
    }
  }

  async function init() {
    try {
      const raw = await window.mirror.native.getParams();
      params = normalizeParams(raw);
    } catch (error) {
      params = { ...DEFAULTS };
      console.warn("Weather widget params unavailable; using defaults.", error);
    }

    els.location.hidden = !params.showLocation;
    await refresh();
    if (timer) clearInterval(timer);
    timer = setInterval(refresh, params.refreshMinutes * 60 * 1000);
  }

  init();
})();
