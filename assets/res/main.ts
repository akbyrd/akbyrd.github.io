// [x] TODO: default to system preference
// [x] TODO: save changes if button clicked
// [x] TODO: apply colors
// [x] TODO: transition colors
// [x] TODO: Handle changes when using auto
// [x] TODO: Do the right thing if no javascript
// [x] TODO: Hide button if no javascript
// [x] TODO: javascript isn't loading in multiple browsers (chrome)
// [x] TODO: transition-duration is wrong in { chrome, edge, brave }
// [x] TODO: Don't add transition when loading
// [x] TODO: Consider cycling an integer instead of classes
// [x] TODO: show button (3 states)
// [-] TODO: Disable text selection
// [x] TODO: Consider accessibility
// [x] TODO: button icons (inline svg?)
// [-] TODO: Fix pop when clicking quickly
// [x] TODO: Fix firefox animation
// [x] TODO: Use typescript
// [x] TODO: Make text unselectable
// [x] TODO: Add hover text
// [x] TODO: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_transitions/Using_CSS_transitions
// [x] TODO: https://m2.material.io/design/color/dark-theme.html
//
// [ ] TODO: Move svg to file
// [ ] TODO: Ensure file is loaded before javascript runs

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

function Initialize()
{
	theme.current = +(localStorage.getItem(theme.key) || 0)

	const buttons = document.getElementsByClassName("header-theme-button")
	for (const button of buttons)
		button.addEventListener("click", CycleTheme)

	theme.labels = document.getElementsByClassName("header-theme-label")
	for (const label of theme.labels)
		label.innerHTML = theme.values[theme.current].label
}

document.readyState === 'loading'
	? document.addEventListener("DOMContentLoaded", Initialize)
	: Initialize()
