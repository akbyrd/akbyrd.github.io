const theme = {
	current: 0,
	labels: null as HTMLCollection | null,

	// Stored. Do not change
	key: "theme",
	values: [
		{ class: "theme-system", label: "Auto" },
		{ class: "theme-light", label: "Light" },
		{ class: "theme-dark", label: "Dark" },
	],
}

function CycleTheme()
{
	const previous = theme.current
	theme.current = (theme.current + 1) % theme.values.length

	const prevClass = theme.values[previous].class
	const currClass = theme.values[theme.current].class

	const html = document.getElementsByTagName("html")[0]
	html.classList.remove(prevClass)
	html.classList.add(currClass)

	for (const label of theme.labels!)
		label.innerHTML = theme.values[theme.current].label

	localStorage.setItem(theme.key, theme.current.toString())
}

function CopyCode(button: Element)
{
	if ("clipboard" in navigator)
	{
		const table = button.previousElementSibling!
		const code = table.querySelector(".lntd:last-of-type code")!
		if (code.textContent)
			navigator.clipboard.writeText(code.textContent)
  }
}

function Initialize()
{
	// Hook up the theme button
	{
		theme.current = +(localStorage.getItem(theme.key) || 0)

		const buttons = document.getElementsByClassName("header-theme-button")
		for (const button of buttons)
			button.addEventListener("click", CycleTheme)

		theme.labels = document.getElementsByClassName("header-theme-label")
		for (const label of theme.labels)
			label.innerHTML = theme.values[theme.current].label
	}

	// Hook up code copy buttons
	{
		const buttons = document.getElementsByClassName("code-copy")
		for (const button of buttons)
			button.addEventListener("click", () => CopyCode(button));
	}

	// Fade images in
	{
		const images = document.getElementsByTagName("img")
		for (const image of images)
			{
				function OnLoad()
				{
			image.style.opacity = "100%"
			if (image.naturalWidth)
				image.classList.add("fade-in")
		}

		if (image.complete)
			{
				OnLoad()
			}
			else
			{
				image.style.opacity = "0%"
				image.onload = OnLoad
				image.onerror = OnLoad
			}
		}
	}
}

document.readyState === "loading"
	? document.addEventListener("DOMContentLoaded", Initialize)
	: Initialize()
