(() => {
	"use strict";

	const DEFAULTS = Object.freeze({
		endpoint: "https://api.spotify.com/v1/me/player",
		accessToken: "",
		refreshSeconds: 10,
		showAlbum: true,
		showProgress: true,
	});

	const els = {
		cover: document.getElementById("cover"),
		placeholder: document.getElementById("cover-placeholder"),
		title: document.getElementById("title"),
		artist: document.getElementById("artist"),
		album: document.getElementById("album"),
		progress: document.getElementById("progress-bar"),
		elapsed: document.getElementById("elapsed"),
		duration: document.getElementById("duration"),
		status: document.getElementById("status"),
	};

	let params = { ...DEFAULTS };
	let trackState = null;
	let refreshTimer = null;
	let progressTimer = null;

	function normalizeParams(raw) {
		const source = raw && typeof raw === "object" ? raw : {};
		const refreshSeconds = Number(source.refreshSeconds);
		return {
			...DEFAULTS,
			...source,
			endpoint: typeof source.endpoint === "string" && source.endpoint.trim() ? source.endpoint.trim() : DEFAULTS.endpoint,
			accessToken: typeof source.accessToken === "string" ? source.accessToken.trim() : "",
			refreshSeconds: Number.isFinite(refreshSeconds) ? Math.min(120, Math.max(5, Math.round(refreshSeconds))) : DEFAULTS.refreshSeconds,
			showAlbum: source.showAlbum !== false,
			showProgress: source.showProgress !== false,
		};
	}

	async function nativeFetch() {
		if (!window.mirror?.native?.webFetch) throw new Error("Spotify is available inside the mirror only.");
		const headers = { Accept: "application/json" };
		if (params.accessToken) headers.Authorization = `Bearer ${params.accessToken}`;
		const response = await window.mirror.native.webFetch(params.endpoint, { method: "GET", headers });
		if (response?.status === 204) return null;
		if (!response || response.status < 200 || response.status >= 300) {
			throw new Error(response?.status === 401 ? "Spotify access token expired or was rejected." : `Spotify request failed (${response?.status ?? "no status"}).`);
		}
		if (response.json) return response.json;
		return response.body ? JSON.parse(response.body) : null;
	}

	function normalizeTrack(data) {
		const item = data?.item || data?.track || data;
		if (!item || !item.name) return null;
		const artists = Array.isArray(item.artists) ? item.artists.map(artist => artist.name).filter(Boolean) : [];
		const images = item.album?.images || item.images || [];
		return {
			title: item.name,
			artist: artists.join(", ") || "Unknown artist",
			album: item.album?.name || item.album || "",
			cover: images[0]?.url || item.cover || "",
			duration: Number(data?.item?.duration_ms || data?.duration_ms || item.duration_ms) || 0,
			progress: Number(data?.progress_ms || data?.progress) || 0,
			playing: data?.is_playing !== false,
		};
	}

	function formatTime(milliseconds) {
		const seconds = Math.max(0, Math.floor(Number(milliseconds) / 1000));
		return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
	}

	function setCover(url) {
		els.cover.hidden = !url;
		els.placeholder.hidden = Boolean(url);
		if (url) {
			els.cover.src = url;
			els.cover.alt = trackState ? `Cover art for ${trackState.album || trackState.title}` : "";
		} else {
			els.cover.removeAttribute("src");
		}
	}

	function render() {
		const track = trackState;
		if (!track) {
			setCover("");
			els.title.textContent = "Nothing playing";
			els.artist.textContent = "Start a track on Spotify";
			els.album.textContent = "";
			els.progress.style.width = "0%";
			els.elapsed.textContent = "";
			els.duration.textContent = "";
			return;
		}
		setCover(track.cover);
		els.title.textContent = track.title;
		els.artist.textContent = track.artist;
		els.album.textContent = params.showAlbum ? track.album : "";
		els.album.hidden = !params.showAlbum || !track.album;
		const ratio = track.duration ? Math.min(1, Math.max(0, track.progress / track.duration)) : 0;
		els.progress.style.width = `${ratio * 100}%`;
		els.elapsed.textContent = params.showProgress ? formatTime(track.progress) : "";
		els.duration.textContent = params.showProgress ? formatTime(track.duration) : "";
		document.querySelector(".progress").hidden = !params.showProgress || !track.duration;
	}

	function showStatus(message) {
		els.status.textContent = message;
		els.status.hidden = false;
	}

	async function refresh() {
		try {
			trackState = normalizeTrack(await nativeFetch());
			els.status.hidden = true;
			render();
		} catch (error) {
			showStatus(error.message || "Unable to reach Spotify.");
			console.error("Spotify widget:", error);
		}
	}

	function startTimers() {
		clearInterval(refreshTimer);
		clearInterval(progressTimer);
		refreshTimer = setInterval(refresh, params.refreshSeconds * 1000);
		progressTimer = setInterval(() => {
			if (trackState?.playing && trackState.duration) {
				trackState.progress = Math.min(trackState.duration, trackState.progress + 1000);
				render();
			}
		}, 1000);
	}

	async function init() {
		const configured = window.mirror?.native?.getParams ? await window.mirror.native.getParams() : {};
		params = normalizeParams(configured);
		await refresh();
		startTimers();
	}

	els.cover.addEventListener("error", () => setCover(""));
	window.mirror?.host?.on("visibility", ({ visible }) => {
		if (visible) {
			refresh();
			startTimers();
		} else {
			clearInterval(refreshTimer);
			clearInterval(progressTimer);
		}
	});

	init().catch(error => showStatus(error.message || "Unable to start Spotify widget."));
})();
