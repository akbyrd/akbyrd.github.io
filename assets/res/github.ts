function Initialize()
{
	const requestState = sessionStorage.getItem("state")
	sessionStorage.removeItem("status")

	const requestUrl = sessionStorage.getItem("url") || location.origin
	sessionStorage.removeItem("url")

	const params = new URLSearchParams(location.search)
	const code = params.get("code")
	const state = params.get("state")
	if (code && state && state == requestState)
		sessionStorage.setItem("code", code)

	location.replace(requestUrl)
}

document.readyState !== "complete"
	? window.addEventListener("load", Initialize, { passive: true })
	: Initialize()
