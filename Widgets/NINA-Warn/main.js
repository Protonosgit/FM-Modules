(() => {
	"use strict";

	const DEFAULTS = Object.freeze({
		ags: ["110000000000"],
		maxAgeInHours: 6,
		maxWarnings: 5,
		updateIntervalInSeconds: 120,
		showCity: true,
		showDate: true,
		showNoWarning: false,
		notifyOnInitial: false,
		notificationTone: true,
		dialogTimeoutMs: 10000,
	});

	const elements = {
		warnings: document.getElementById("warnings"),
		updated: document.getElementById("updated"),
		status: document.getElementById("status"),
	};
	let params = { ...DEFAULTS };
	let timer;
	let hasBaseline = false;
	let knownIds = new Set();

	function normalizeParams(raw) {
		const value = raw && typeof raw === "object" ? raw : {};
		const ags = Array.isArray(value.ags) ? value.ags : [value.ags];
		return {
			...DEFAULTS,
			...value,
			ags: ags.filter(item => /^\d{12}$/.test(String(item))).map(String),
			maxAgeInHours: Math.max(1, Number(value.maxAgeInHours) || DEFAULTS.maxAgeInHours),
			maxWarnings: Math.max(1, Math.round(Number(value.maxWarnings) || DEFAULTS.maxWarnings)),
			updateIntervalInSeconds: Math.max(30, Number(value.updateIntervalInSeconds) || DEFAULTS.updateIntervalInSeconds),
		};
	}

	async function fetchJson(url) {
		if (!window.mirror?.native?.webFetch) throw new Error("This widget requires the mirror webFetch API.");
		const response = await window.mirror.native.webFetch(url, { method: "GET" });
		if (!response || response.status < 200 || response.status >= 300) throw new Error(`NINA request failed (${response?.status ?? "unknown"}).`);
		return response.json || JSON.parse(response.body);
	}

	function regionUrl(ags) {
		return `https://warnung.bund.de/api31/dashboard/${String(ags).slice(0, 5)}0000000.json`;
	}

	function flatten(value) {
		if (Array.isArray(value)) return value;
		if (Array.isArray(value?.warnings)) return value.warnings;
		if (Array.isArray(value?.alerts)) return value.alerts;
		return [];
	}

	function text(value) {
		if (typeof value === "string") return value.trim();
		if (value && typeof value === "object") return text(value.de || value.en || Object.values(value)[0]);
		return "";
	}

	function toWarning(alert) {
		const data = alert?.payload?.data || alert?.data || alert?.info?.[0] || alert || {};
		const area = data.area?.[0] || alert?.area?.[0] || {};
		const title = text(alert?.i18nTitle) || text(data.i18nTitle) || text(data.headline) || text(data.event) || text(alert?.title) || "NINA warning";
		const description = text(data.description) || text(data.instruction) || text(alert?.description);
		const sent = alert?.sent || data.sent || alert?.timestamp || data.sentDate;
		return {
			id: String(alert?.id || data.identifier || data.id || `${title}|${sent || description}`),
			title,
			description,
			city: text(alert?.cityNames?.join?.(", ")) || text(area.areaDesc) || text(data.areaDesc),
			severity: text(data.severity) || "Minor",
			provider: text(data.provider) || text(alert?.sender),
			sent,
		};
	}

	function severityClass(severity) {
		return ["Severe", "Moderate", "Minor", "Cancel", "Fine"].includes(severity) ? severity : "Minor";
	}

	function formatDate(value) {
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? "" : date.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
	}

	function render(warnings) {
		elements.warnings.replaceChildren();
		if (!warnings.length) {
			if (params.showNoWarning) {
				const empty = document.createElement("p");
				empty.className = "no-warning";
				empty.textContent = "No active warnings";
				elements.warnings.appendChild(empty);
			}
			return;
		}
		warnings.slice(0, params.maxWarnings).forEach(warning => {
			const item = document.createElement("article");
			item.className = `warning severity-${severityClass(warning.severity)}`;
			const marker = document.createElement("div");
			marker.className = "marker";
			marker.textContent = warning.severity === "Cancel" ? "OK" : "!";
			const content = document.createElement("div");
			content.className = "warning-content";
			const title = document.createElement("h2");
			title.textContent = warning.title;
			content.appendChild(title);
			if (params.showCity && warning.city) {
				const city = document.createElement("div");
				city.className = "city";
				city.textContent = warning.city;
				content.appendChild(city);
			}
			if (warning.description) {
				const description = document.createElement("p");
				description.textContent = warning.description;
				content.appendChild(description);
			}
			if (params.showDate && warning.sent) {
				const date = document.createElement("time");
				date.textContent = formatDate(warning.sent);
				content.appendChild(date);
			}
			item.append(marker, content);
			elements.warnings.appendChild(item);
		});
	}

	function playTone() {
		if (!params.notificationTone) return;
		try {
			const AudioContext = window.AudioContext || window.webkitAudioContext;
			if (!AudioContext) return;
			const context = new AudioContext();
			const oscillator = context.createOscillator();
			const gain = context.createGain();
			oscillator.type = "sine";
			oscillator.frequency.setValueAtTime(660, context.currentTime);
			oscillator.frequency.setValueAtTime(880, context.currentTime + 0.12);
			gain.gain.setValueAtTime(0.0001, context.currentTime);
			gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02);
			gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.42);
			oscillator.connect(gain).connect(context.destination);
			oscillator.start();
			oscillator.stop(context.currentTime + 0.45);
			oscillator.addEventListener("ended", () => context.close());
		} catch (error) {
			console.warn("NINA notification tone unavailable.", error);
		}
	}

	function notify(warnings) {
		const fresh = warnings.filter(warning => !knownIds.has(warning.id));
		if (!hasBaseline && !params.notifyOnInitial) {
			knownIds = new Set(warnings.map(warning => warning.id));
			hasBaseline = true;
			return;
		}
		hasBaseline = true;
		fresh.forEach(warning => {
			playTone();
			window.mirror?.native?.dialog?.({
				title: "NINA warning",
				message: `${warning.title}${warning.city ? ` - ${warning.city}` : ""}${warning.description ? `\n${warning.description}` : ""}`,
				timeoutMs: params.dialogTimeoutMs,
			}).catch(error => console.warn("NINA dialog unavailable.", error));
		});
		knownIds = new Set(warnings.map(warning => warning.id));
	}

	async function refresh() {
		try {
			const responses = await Promise.all(params.ags.map(ags => fetchJson(regionUrl(ags))));
			const warnings = responses.flatMap(flatten).map(toWarning).filter(warning => {
				const age = (Date.now() - new Date(warning.sent).getTime()) / 3600000;
				return !warning.sent || Number.isNaN(age) || age <= params.maxAgeInHours;
			});
			const unique = [...new Map(warnings.map(warning => [warning.id, warning])).values()];
			render(unique);
			notify(unique);
			elements.updated.textContent = `Updated ${new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
			elements.status.hidden = true;
		} catch (error) {
			elements.status.textContent = error.message || "Unable to load NINA warnings.";
			elements.status.hidden = false;
			console.error("NINA widget:", error);
		}
	}

	async function init() {
		try {
			params = normalizeParams(await window.mirror.native.getParams());
		} catch (error) {
			params = { ...DEFAULTS };
			console.warn("NINA widget params unavailable; using defaults.", error);
		}
		await refresh();
		timer = setInterval(refresh, params.updateIntervalInSeconds * 1000);
	}

	init();
})();
