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
//
// [ ] TODO: Make text unselectable
// [ ] TODO: Add hover text
// [ ] TODO: Add hover transition
// [ ] TODO: Move svg to file
// [ ] TODO: Ensure file is loaded before javascript runs
// [ ] TODO: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_transitions/Using_CSS_transitions
// [ ] TODO: https://m2.material.io/design/color/dark-theme.html

const theme = {
	current: 0,

	// Stored. Do not change
	key: "theme",
	classes: [
		"theme-system",
		"theme-light",
		"theme-dark",
	],
}

function CycleTheme()
{
	const previous = theme.current
	theme.current = (theme.current + 1) % theme.classes.length

	const prevClass = theme.classes[previous]
	const currClass = theme.classes[theme.current]

	const html = document.getElementsByTagName("html")[0]
	html.classList.remove(prevClass)
	html.classList.add(currClass)

	localStorage.setItem(theme.key, theme.current.toString())
}

function Initialize()
{
	theme.current = +(localStorage.getItem(theme.key) || 0)

	const buttons = document.getElementsByClassName("header-theme-button");
	for (const button of buttons)
		button.addEventListener("click", CycleTheme)
}

document.readyState === 'loading'
	? document.addEventListener("DOMContentLoaded", Initialize)
	: Initialize()
