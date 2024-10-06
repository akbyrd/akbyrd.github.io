function assert(value: unknown): asserts value
{
	if (!value)
		throw "Condition failed"
}

function assertType<T>(value: unknown): asserts value is T {
}

function clamp01(x: number)
{
	return Math.max(0, Math.min(1, x))
}

// -------------------------------------------------------------------------------------------------
// Theme Toggle

const theme = {
	current: 0,
	labels: null as null | HTMLCollection,

	// Stored. Do not change
	key: "theme",
	values: [
		{ class: "theme-system", label: "Auto" },
		{ class: "theme-light", label: "Light" },
		{ class: "theme-dark", label: "Dark" },
	],
}

function InitTheme()
{
	// Hook up the theme button
	theme.current = +(localStorage.getItem(theme.key) || 0)

	const buttons = document.getElementsByClassName("header-theme-button")
	for (const button of buttons)
		button.addEventListener("click", CycleTheme, { passive: true })

	theme.labels = document.getElementsByClassName("header-theme-label")
	for (const label of theme.labels)
		label.innerHTML = theme.values[theme.current].label
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

// -------------------------------------------------------------------------------------------------
// Images

function InitImages()
{
	// Fade images in
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

// -------------------------------------------------------------------------------------------------
// Code Blocks

type CodeHighlight =
{
	intrinsic: number[],
	idParent:  HTMLElement,
	lnStart:   number,
	lines:     NodeListOf<HTMLElement>,
	start:     number,
	radius:    number,
}

type CodeHighlightState =
{
	idParent: HTMLElement,
	start:    number,
	radius:   number,
}

class CodeClick
{
	dist:        number  = 0
	clientY:     number  = 0
	lastT:       number  = 0
	scrollTimer: number  = 0
	scrollDest:  number  = 0
	cancel:      boolean = false
}

class CodeClick_Touch extends CodeClick
{
	lnParent: HTMLElement = HTMLElement.prototype
	id:       number      = 0
	startX:   number      = 0
	startY:   number      = 0
	timer:    number      = 0
	active:   boolean     = false
}

type Code =
{
	scrollTarget?: HTMLElement,
	lnParents:     HTMLElement[],
	lns:           HTMLElement[],
	hash:          string,
	click?:        CodeClick | CodeClick_Touch,
	hl?:           CodeHighlight,
	prevHl?:       CodeHighlightState,
}

const code: Code = {
	lnParents: [],
	lns: [],
	hash: "",
}

function InitCode()
{
	// Hook up code copy buttons
	const buttons = document.getElementsByClassName("code-copy")
	for (const button of buttons)
		button.addEventListener("click", CopyCode, { passive: true })

	// Hook up line number selection
	const idParents = document.querySelectorAll(".highlight")
	for (const idParent of idParents)
	{
		const lnParent = idParent.querySelector("code")
		code.lnParents.push(lnParent as HTMLElement)
	}

	if (code.lnParents)
	{
		const css = document.styleSheets[0]
		css.insertRule(".line { cursor: pointer; }", css.cssRules.length)

		for (const lnParent of code.lnParents)
		{
			lnParent.addEventListener("mousedown",  BeginSelection_Mouse, { passive: false })
			lnParent.addEventListener("touchstart", BeginSelection_Touch, { passive: false })
		}

		window.addEventListener("hashchange", SelectionFromHash,  { passive: true })
		window.addEventListener("resize",     SetScrollTargetPos, { passive: true })

		// Need an element because Ctrl+L Enter in Firefox will not invoke javascript
		code.scrollTarget = document.createElement("null")
		code.scrollTarget.style.setProperty("position", "absolute")
		document.body.insertAdjacentElement("beforeend", code.scrollTarget)

		SelectionFromHash()
	}
}

function CopyCode(e: Event)
{
	if ("clipboard" in navigator)
	{
		const button = e.currentTarget as HTMLElement
		const pre = button.previousElementSibling!
		const code = pre.querySelector("code")!
		if (code.textContent)
			navigator.clipboard.writeText(code.textContent)
	}
}

function CreateSelection(idParent: HTMLElement)
{
	if (code.hl && code.hl.idParent == idParent)
	{
		const hl: CodeHighlight = {
			intrinsic: code.hl.intrinsic,
			idParent:  code.hl.idParent,
			lnStart:   code.hl.lnStart,
			lines:     code.hl.lines,
			start:     0,
			radius:    0,
		}
		return hl
	}
	else
	{
		const hl: CodeHighlight = {
			intrinsic: new Array<number>,
			idParent:  idParent,
			lnStart:   parseInt(idParent.style.getPropertyValue("--ln-start")) || 1,
			lines:     idParent.querySelectorAll<HTMLElement>(".line"),
			start:     0,
			radius:    0,
		}
		return hl
	}
}

function SetSelection(hl?: CodeHighlight)
{
	const prevHl = code.hl
	const currHl = hl
	code.hl = hl

	// NOTE: Firefox does not reliably update styles if an element class is changed multiple times.
	const changes = new Map<HTMLElement, boolean>()

	// Remove intrinsic selection
	if (currHl && currHl.idParent != prevHl?.idParent)
	{
		for (const [i, line] of currHl.lines.entries())
		{
			if (line.classList.contains("hl"))
				currHl.intrinsic.push(i)
		}

		for (const i of currHl.intrinsic)
			changes.set(currHl.lines[i], false)
	}

	// Remove manual selection
	if (prevHl)
	{
		const dir = Math.sign(prevHl.radius) || 1
		for (let i = 0; i != prevHl.radius + dir; i += dir)
			changes.set(prevHl.lines[prevHl.start + i], false)
	}

	// Set manual selection
	if (currHl)
	{
		const dir = Math.sign(currHl.radius) || 1
		for (let i = 0; i != currHl.radius + dir; i += dir)
			changes.set(currHl.lines[currHl.start + i], true)
	}

	// Restore intrinsic selection
	if (prevHl && prevHl.idParent != currHl?.idParent)
	{
		for (const i of prevHl.intrinsic)
			changes.set(prevHl.lines[i], true)
	}

	for (const [e, v] of changes)
		e.classList.toggle("hl", v)
}

function BeginSelection_Mouse(e: MouseEvent)
{
	const target = e.target as HTMLElement
	const isLn = target.classList.contains("line")
	if (!isLn || code.click) return
	if (e.button != 0) return

	// Prevent click from sometimes selecting text
	if (e.cancelable)
		e.preventDefault()

	code.click = {
		dist:        0,
		clientY:     e.clientY,
		lastT:       performance.now(),
		scrollTimer: 0,
		scrollDest:  0,
		cancel:      false,
	}

	document.addEventListener("mousemove",   UpdateSelection_Mouse,  { passive: true })
	document.addEventListener("mouseup",     EndSelection_Mouse,     { passive: true })
	document.addEventListener("touchstart",  EndSelectionImpl_Mouse, { passive: true })
	document.addEventListener("contextmenu", EndSelectionImpl_Mouse, { passive: true })
	document.addEventListener("dragstart",   EndSelectionImpl_Mouse, { passive: true })
	window  .addEventListener("blur",        EndSelectionImpl_Mouse, { passive: true })
	window  .addEventListener("popstate",    CancelSelection_Mouse,  { passive: true })

	const lnParent = e.currentTarget as HTMLElement
	BeginSelection(target, lnParent)
}

function UpdateSelection_Mouse(e: MouseEvent)
{
	if (e.button != 0) return
	assert(code.click)

	// Workaround for browser issues where mouse up events are not sent
	if (!(e.buttons & 0x1))
	{
		EndSelection_Mouse(e)
		return
	}

	code.click.dist += Math.abs(e.movementX)
	code.click.dist += Math.abs(e.movementY)
	code.click.clientY = e.clientY

	UpdateSelection()
}

function EndSelection_Mouse(e: MouseEvent)
{
	if (!code.click) return
	if (e.button != 0) return

	EndSelectionImpl_Mouse()
}

function EndSelectionImpl_Mouse()
{
	if (!code.click) return

	document.removeEventListener("mousemove",   UpdateSelection_Mouse)
	document.removeEventListener("mouseup",     EndSelection_Mouse)
	document.removeEventListener("touchstart",  EndSelectionImpl_Mouse)
	document.removeEventListener("dragstart",   EndSelectionImpl_Mouse)
	document.removeEventListener("contextmenu", EndSelectionImpl_Mouse)
	window  .removeEventListener("blur",        EndSelectionImpl_Mouse)
	window  .removeEventListener("popstate",    CancelSelection_Mouse)

	EndSelection()
	code.click = undefined
}

function CancelSelection_Mouse()
{
	assert(code.click)

	code.click.cancel = true
	EndSelectionImpl_Mouse()
}

function GetCurrentTouch(e: TouchEvent) : Touch | undefined
{
	assertType<CodeClick_Touch>(code.click)

	for (const touch of e.changedTouches)
	{
		if (touch.identifier == code.click.id)
			return touch
	}
}

function BeginSelection_Touch(e: TouchEvent)
{
	const target = e.target as HTMLElement
	const isLn = target.classList.contains("line")
	if (!isLn || code.click) return

	const c : CodeClick_Touch = {
		dist:        0,
		clientY:     e.changedTouches[0].clientY,
		lastT:       performance.now(),
		scrollTimer: 0,
		scrollDest:  0,
		cancel:      false,

		lnParent:    e.currentTarget as HTMLElement,
		id:          e.changedTouches[0].identifier,
		startX:      e.changedTouches[0].clientX,
		startY:      e.changedTouches[0].clientY,
		timer:       0,
		active:      false,
	}
	code.click = c
	assertType<CodeClick_Touch>(code.click)

	document.addEventListener("touchmove",   UpdateSelection_Touch,  { passive: false })
	document.addEventListener("touchend",    EndSelection_Touch,     { passive: false })
	document.addEventListener("touchcancel", EndSelection_Touch,     { passive: false })
	window  .addEventListener("blur",        EndSelectionImpl_Touch, { passive: true })
	window  .addEventListener("popstate",    EndSelectionImpl_Touch, { passive: true })

	code.click.timer = setTimeout(() => {
		assertType<CodeClick_Touch>(code.click)

		code.click.timer = 0
		if (code.click.dist < 10)
		{
			code.click.active = true
			BeginSelection(target, code.click.lnParent)
		}
	}, 250)
}

function UpdateSelection_Touch(e: TouchEvent)
{
	assertType<CodeClick_Touch>(code.click)

	const touch = GetCurrentTouch(e)
	if (!touch) return

	if (!code.click.active)
	{
		EndSelectionImpl_Touch()
		return
	}

	code.click.dist += Math.abs(touch.clientX - code.click.startX)
	code.click.dist += Math.abs(touch.clientY - code.click.startY)
	code.click.clientY = touch.clientY

	// Prevent touchmove from scrolling
	if (e.cancelable)
		e.preventDefault()

	UpdateSelection()
}

function EndSelection_Touch(e: TouchEvent)
{
	if (!code.click) return
	assertType<CodeClick_Touch>(code.click)

	// Prevent mouseup after touchup
	// Not cancelable when touchmove scrolling
	if (e.cancelable)
		e.preventDefault()

	const touch = GetCurrentTouch(e)
	if (!touch) return

	EndSelectionImpl_Touch()
}

function EndSelectionImpl_Touch()
{
	assertType<CodeClick_Touch>(code.click)

	clearTimeout(code.click.timer)

	document.removeEventListener("touchmove",   UpdateSelection_Touch)
	document.removeEventListener("touchend",    EndSelection_Touch)
	document.removeEventListener("touchcancel", EndSelection_Touch)
	document.removeEventListener("contextmenu", EndSelectionImpl_Touch)
	window  .removeEventListener("blur",        EndSelectionImpl_Touch)
	window  .removeEventListener("popstate",    EndSelectionImpl_Touch)

	EndSelection()
	code.click = undefined
}

function BeginSelection(line: HTMLElement, lnParent: HTMLElement)
{
	assert(code.click)

	let idParent = lnParent
	while (!idParent.id)
		idParent = idParent.parentElement!

	if (code.hl)
	{
		code.prevHl = {
			idParent: code.hl.idParent,
			start:    code.hl.start,
			radius:   code.hl.radius,
		}
	}

	const hl = CreateSelection(idParent)
	hl.start = Array.from(hl.lines).indexOf(line)
	SetSelection(hl)
	CalculateHash()
	SetScrollTargetId()

	code.click.scrollDest = window.scrollY
	code.click.scrollTimer = setInterval(() => {
		assert(code.click)

		UpdateSelection()

		const height = document.documentElement.clientHeight
		const y = code.click.clientY / height

		const threshold = 0.15
		const speed = 4.0 * threshold * height

		let amount = 0
		amount -= clamp01((0 - y) / threshold + 1)
		amount += clamp01((y - 1) / threshold + 1)
		amount = Math.pow(amount, 3) // must be odd

		const now = performance.now()
		const dt = (now - code.click.lastT) / 1000
		code.click.lastT = now

		code.click.scrollDest += speed * amount * dt
		window.scrollTo({
			top: code.click.scrollDest,
			behavior: "smooth",
		})
	}, 1)
}

// TODO: Optimize this
function UpdateSelection()
{
	assert(code.hl)
	assert(code.click)

	let nr = 0
	let no = 0
	for (const [i, line] of code.hl.lines.entries())
	{
		const r = i - code.hl.start
		const o = Math.abs(r)
		if (o >= no)
		{
			const y = code.click.clientY
			const rect = line.getBoundingClientRect()
			if (i < code.hl.start && y <  rect.bottom) { nr = r; no = o; }
			if (i > code.hl.start && y >= rect.top)    { nr = r; no = o; }
		}
	}

	const oo = Math.abs(code.hl.radius)
	const os = Math.sign(code.hl.radius) || 1
	const ns = Math.sign(nr) || 1

	if (no < oo || ns != os)
	{
		const nr2 = ns == os ? nr : 0
		for (let i = code.hl.radius; i != nr2; i -= os)
			code.hl.lines[code.hl.start + i].classList.remove("hl")
		code.hl.radius = nr2
	}

	for (let i = code.hl.radius; i != nr; i += ns)
		code.hl.lines[code.hl.start + i + ns].classList.add("hl")
	code.hl.radius = nr
}

function EndSelection()
{
	assert(code.click)

	if (!code.hl) return

	clearInterval(code.click.scrollTimer)

	if (!code.click.cancel)
	{
		let isSame = true
		isSame &&= code.click.dist! < 10
		isSame &&= code.prevHl?.idParent == code.hl.idParent
		isSame &&= code.prevHl?.start == code.hl.start
		isSame &&= code.prevHl?.radius == code.hl.radius
		if (isSame)
			SetSelection(undefined)

		CalculateHash()
		SetScrollTargetPos()
		SetScrollTargetId()

		if (location.hash != code.hash)
		{
			const currLocation = new URL(location.toString())
			currLocation.hash = code.hash
			history.pushState({ previouslyVisited: true }, "", currLocation)
		}
	}

	code.prevHl = undefined
}

function SetScrollTargetPos()
{
	if (!code.hl) return
	assert(code.scrollTarget)

	const a   = code.hl.start + 1
	const b   = code.hl.start + code.hl.radius + 1
	const min = Math.min(a, b)
	const max = Math.max(a, b)

	const minLn   = code.hl.lines[min - 1]
	const maxLn   = code.hl.lines[max - 1]
	const minY    = minLn.getBoundingClientRect().top
	const maxY    = maxLn.getBoundingClientRect().bottom
	const middleY = (minY + maxY - window.innerHeight) / 2
	const scrollY = window.scrollY + Math.min(minY, middleY)
	code.scrollTarget.style.setProperty("top", `${scrollY}px`)
}

function SetScrollTargetId()
{
	assert(code.scrollTarget)

	if (history.state?.previouslyVisited)
	{
		// Don't auto-scroll when pressing F5
		setTimeout(() => code.scrollTarget!.id = code.hash.substring(1), 1)
	}
	else
	{
		code.scrollTarget.id = code.hash.substring(1)
	}
}

function CalculateHash()
{
	if (code.hl)
	{
		const a   = code.hl.start + 1
		const b   = code.hl.start + code.hl.radius + 1
		const min = Math.min(a, b) + code.hl.lnStart - 1
		const max = Math.max(a, b) + code.hl.lnStart - 1

		const lines = code.hl.radius ? `L${min}-${max}` : `L${min}`
		code.hash = `#${code.hl.idParent.id}${lines}`
	}
	else
	{
		code.hash = ""
	}
}

function SelectionFromHash()
{
	// TODO: Reduce js version and replace matchAll
	const regex = /^#(.+?)(?:L(\d+)(?:-(\d+))?)?$/g
	const [match] = location.hash.matchAll(regex)
	if (match)
	{
		const [hash, id, sa, sb] = match
		const idParent = document.getElementById(id)
		if (idParent && sa)
		{
			const hl = CreateSelection(idParent)
			if (hl.lines.length)
			{
				const a = Math.min(parseInt(sa) - hl.lnStart + 1 || 1, hl.lines.length)
				const b = Math.min(parseInt(sb) - hl.lnStart + 1 || a, hl.lines.length)
				hl.start  = a - 1
				hl.radius = b - a

				SetSelection(hl)
				CalculateHash()
				SetScrollTargetPos()
				SetScrollTargetId()
				if (!history.state?.previouslyVisited)
				{
					history.replaceState({ previouslyVisited: true }, "")
					setTimeout(() => code.scrollTarget!.scrollIntoView(), 1)
				}
				return
			}
		}
	}

	if (code.hl)
	{
		SetSelection(undefined)
		CalculateHash()
		SetScrollTargetId()
	}
}

// -------------------------------------------------------------------------------------------------
// Initialization

function Initialize()
{
	InitTheme()
	InitImages()
	InitCode()
}

document.readyState !== "complete"
	? window.addEventListener("load", (e) => Initialize(), { passive: true })
	: Initialize()
