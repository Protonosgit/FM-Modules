const params = await window.mirror.native.getParams();
const url = params.embedUrl;

if (url && /^https:\/\//i.test(url)) {
  const iframe = document.createElement('iframe');
  iframe.src = url;
  iframe.style.cssText = 'width:100%; height:100%; border:0;';
  iframe.allow = 'autoplay; encrypted-media; fullscreen';
  document.body.appendChild(iframe);
} else {
  	window.mirror?.native?.dialog?.({
		title: "Invalid embed URL",
		message: `${url ? `Invalid embed URL: ${url}` : 'No embed URL configured.'}`,
        confirmText: "OK",
		timeoutMs: 8000,
	});
}