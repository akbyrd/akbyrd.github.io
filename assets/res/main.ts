function assert(value: unknown): asserts value
{
	if (!value)
		throw "Condition failed"
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

type CodeClick =
{
	id:     number,
	startX: number,
	startY: number,
	dist:   number,
	timer:  number,
}

type Code =
{
	scrollTarget?: HTMLElement,
	lnParents:     HTMLElement[],
	lns:           HTMLElement[],
	hash:          string,
	click?:        CodeClick,
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
			lnParent.addEventListener("mousedown",  BeginSelection, { passive: false })
			lnParent.addEventListener("touchstart", BeginSelection, { passive: false })
		}

		document.addEventListener("mousedown",   DisableSelection, { passive: true })
		document.addEventListener("touchstart",  DisableSelection, { passive: true })
		document.addEventListener("mouseup",     EnableSelection,  { passive: true })
		document.addEventListener("dragend",     EnableSelection,  { passive: true })
		document.addEventListener("touchend",    EnableSelection,  { passive: true })
		document.addEventListener("touchcancel", EnableSelection,  { passive: true })

		window.addEventListener("hashchange", SelectionFromHash,  { passive: true })
		window.addEventListener("resize",     SetScrollTargetPos, { passive: true })

		// Need an element because Ctrl+L Enter in Firefox will not invoke javascript
		code.scrollTarget = document.createElement("null")
		code.scrollTarget.style.setProperty("position", "absolute")
		document.body.insertAdjacentElement("beforeend", code.scrollTarget)

		SelectionFromHash()
		EnableSelection()
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

function EnableSelection()
{
	assert(code.lnParents)

	for (const lnParent of code.lnParents)
		lnParent.style.pointerEvents = "auto"
}

function DisableSelection()
{
	if (code.click) return
	assert(code.lnParents)

	for (const lnParent of code.lnParents)
		lnParent.style.pointerEvents = "none"
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

function BeginSelection(e: MouseEvent | TouchEvent)
{
	const target = e.target as HTMLElement
	const isLn = target.classList.contains("line")
	if (!isLn && !code.click) return

	const click: CodeClick = {
		id:     0,
		startX: 0,
		startY: 0,
		dist:   0,
		timer:  0,
	}

	if (e instanceof MouseEvent)
	{
		e.preventDefault()

		const id = -1 - e.button
		if (code.click) { code.click.id = id; EndSelection(e); return }
		if (!isLn) return
		if (e.button != 0) return

		click.id = id
		code.click = click
	}
	else
	{
		if (!code.click)
		{
			if (!isLn) return

			const touch = e.changedTouches[0]
			click.id     = touch.identifier
			click.startX = touch.clientX
			click.startY = touch.clientY

			code.click = click

			document.addEventListener("touchend",    EndSelection,    { passive: false })
			document.addEventListener("touchcancel", EndSelection,    { passive: false })
			document.addEventListener("touchmove",   UpdateSelection, { passive: false })

			code.click.timer = setTimeout(() => {
				if (code.click && code.click.dist < 10)
				{
					console.log("BeginSelection")
					code.click.timer = 0
					e.preventDefault()
					BeginSelection(e)
				}
			}, 250)
			return
		}
		else
		{
			let touch: Touch | undefined
			for (const ct of e.changedTouches)
				touch = ct.identifier == code.click.id ? ct : touch
			if (!touch) return
		}
	}

	const lnParent = e.target as HTMLElement
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
	hl.start = Array.from(hl.lines).indexOf(target)
	SetSelection(hl)
	CalculateHash()
	SetScrollTargetId()

	document.addEventListener("mousemove", UpdateSelection, { passive: false })
	document.addEventListener("mouseup",   EndSelection,    { passive: false })
}

function UpdateSelection(e: MouseEvent | TouchEvent)
{
	assert(code.click)
	assert(code.hl)

	let y = 0
	if (e instanceof MouseEvent)
	{
		e.preventDefault()

		const id = -1 - e.button
		if (code.click.id < 0)
		{
			// Browsers are ass and can send mousedown without mouseup
			const button = -1 - code.click.id
			const down = e.button == button || e.buttons & (1 << button)
			if (!down) { code.click.id = id; EndSelection(e); return }
		}

		if (id != code.click.id) return
		y = e.clientY
		code.click.dist += Math.abs(e.movementX)
		code.click.dist += Math.abs(e.movementY)

	}
	else
	{
		let touch: Touch | undefined
		for (const ct of e.changedTouches)
			touch = ct.identifier == code.click.id ? ct : touch
		if (!touch) return

		y = touch.clientY
		code.click.dist += Math.abs(touch.clientX - code.click.startX)
		code.click.dist += Math.abs(touch.clientY - code.click.startY)
		console.log("UpdateSelection")
		if (code.click.timer) return
		e.preventDefault()
	}

	let nr = 0
	let no = 0
	for (const [i, line] of code.hl.lines.entries())
	{
		const r = i - code.hl.start
		const o = Math.abs(r)
		if (o >= no)
		{
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

	CalculateHash()
	SetScrollTargetPos()
	SetScrollTargetId()
}

function EndSelection(e: MouseEvent | TouchEvent)
{
	if (!code.click) return

	// Prevent mouseup after touchup
	// Not cancelable when touchmove scrolling
	if (e.cancelable)
		e.preventDefault()

	console.log("EndSelection", e.cancelable)

	if (e instanceof MouseEvent)
	{
		const id = -1 - e.button
		if (id != code.click.id) return
	}
	else
	{
		let touch: Touch | undefined
		for (const ct of e.changedTouches)
			touch = ct.identifier == code.click.id ? ct : touch
		if (!touch) return

		clearTimeout(code.click.timer)
		code.click.timer = 0
	}

	if (code.hl)
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

		code.prevHl = undefined
	}

	code.click = undefined

	document.removeEventListener("mousemove",   UpdateSelection)
	document.removeEventListener("touchmove",   UpdateSelection)
	document.removeEventListener("mouseup",     EndSelection)
	document.removeEventListener("touchend",    EndSelection)
	document.removeEventListener("touchcancel", EndSelection)
}

function SetScrollTargetPos()
{
	assert(code.scrollTarget)
	if (!code.hl) return

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
