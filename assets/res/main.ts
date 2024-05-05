function assert(value: unknown): asserts value
{
	console.assert(value != false, "Condition failed")
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
		button.addEventListener("click", CycleTheme)

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
	lns:       NodeListOf<HTMLElement>,
	cls:       NodeListOf<HTMLElement>,
	start:     number,
	radius:    number,
}

type CodeHighlightPrev =
{
	idParent: HTMLElement,
	start:    number,
	radius:   number,
}

type Code =
{
	scrollTarget?: HTMLElement,
	lnParents:     HTMLElement[],
	hl?:           CodeHighlight,
	prevHl?:       CodeHighlightPrev,
}

const code: Code = {
	lnParents: [],
}

function InitCode()
{
	// Hook up code copy buttons
	const buttons = document.getElementsByClassName("code-copy")
	for (const button of buttons)
		button.addEventListener("click", () => CopyCode(button))

	// Hook up line number selection
	const lnRoots = document.querySelectorAll(".chroma:has(.lntable)")
	for (const lnRoot of lnRoots)
	{
		const lnParent = lnRoot.querySelector(".lntd:first-of-type")
		if (lnParent && lnRoot.id)
			code.lnParents.push(lnParent as HTMLElement)
	}

	if (code.lnParents)
	{
		for (const lnParent of code.lnParents)
		{
			lnParent.addEventListener("mousedown", BeginSelection, { passive: true })
			lnParent.style.pointerEvents = "auto"
			lnParent.style.cursor = "pointer"
		}

		document.addEventListener("mousedown", DisableSelection, { passive: true })
		document.addEventListener("mouseup", EnableSelection, { passive: true })
		window.addEventListener("hashchange", SelectionFromHash, { passive: true })
		window.addEventListener("resize", SetScrollTargetPos, { passive: true })

		// Need an element because Ctrl+L Enter in Firefox will not invoke javascript
		code.scrollTarget = document.createElement("null")
		code.scrollTarget.style.setProperty("position", "absolute")
		document.body.insertAdjacentElement("beforeend", code.scrollTarget)

		SelectionFromHash()
		EnableSelection()
	}
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

function EnableSelection()
{
	assert(code.lnParents)

	for (const lnParent of code.lnParents)
		lnParent.style.pointerEvents = "auto"
}

function DisableSelection()
{
	assert(code.lnParents)

	for (const lnParent of code.lnParents)
		lnParent.style.pointerEvents = "none"
}

function CreateSelection(idParent: HTMLElement)
{
	const hl: CodeHighlight = {
		intrinsic: new Array<number>,
		idParent:  idParent,
		lns:       idParent.querySelectorAll<HTMLElement>(".lnt"),
		cls:       idParent.querySelectorAll<HTMLElement>(".line"),
		start:     0,
		radius:    0,
	}
	assert(hl.lns.length == hl.cls.length)

	return hl
}

function SetSelection(hl?: CodeHighlight)
{
	console.log("SetSelection")

	const prevHl = code.hl
	const currHl = hl
	code.hl = hl

	// NOTE: Firefox does not reliably update styles if an element class is changed multiple times.
	const changes = new Map<HTMLElement, boolean>()

	// Remove intrinsic selection
	if (currHl && currHl.idParent != prevHl?.idParent)
	{
		for (const [i, ln] of currHl.lns.entries())
		{
			if (ln.classList.contains("hl"))
				currHl.intrinsic.push(i)
		}

		for (const i of currHl.intrinsic)
		{
			changes.set(currHl.lns[i], false)
			changes.set(currHl.cls[i], false)
		}
	}

	// Remove manual selection
	if (prevHl)
	{
		const dir = Math.sign(prevHl.radius) || 1
		for (let i = 0; i != prevHl.radius + dir; i += dir)
		{
			changes.set(prevHl.lns[prevHl.start + i], false)
			changes.set(prevHl.cls[prevHl.start + i], false)
		}
		// TODO: This should pobably be somewhere else
		code.scrollTarget!.removeAttribute("id")
	}

	// Set manual selection
	if (currHl)
	{
		const dir = Math.sign(currHl.radius) || 1
		for (let i = 0; i != currHl.radius + dir; i += dir)
		{
			changes.set(currHl.lns[currHl.start + i], true)
			changes.set(currHl.cls[currHl.start + i], true)
		}
	}

	// Restore intrinsic selection
	if (prevHl && prevHl.idParent != currHl?.idParent)
	{
		for (const i of prevHl.intrinsic)
		{
			changes.set(prevHl.lns[i], true)
			changes.set(prevHl.cls[i], true)
		}
	}

	for (const [e, v] of changes)
		e.classList.toggle("hl", v)
}

function BeginSelection(e: MouseEvent)
{
	if (e.button != 0) return
	console.log("BeginSelection")

	const ln       = e.target as HTMLElement
	const lnParent = e.currentTarget as HTMLElement

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
	hl.start = Array.from(hl.lns).indexOf(ln)
	SetSelection(hl)

	document.addEventListener("mousemove", UpdateSelection, { passive: true })
	document.addEventListener("mouseup",   EndSelection, { passive: true })
}

function UpdateSelection(e: MouseEvent)
{
	assert(code.hl)

	let nr = 0
	let no = 0
	for (const [i, ln] of code.hl.lns.entries())
	{
		const r = i - code.hl.start
		const o = Math.abs(r)
		if (o >= no)
		{
			const rect = ln.getBoundingClientRect()
			if (i < code.hl.start && e.y <  rect.bottom) { nr = r; no = o; }
			if (i > code.hl.start && e.y >= rect.top)    { nr = r; no = o; }
		}
	}

	const oo = Math.abs(code.hl.radius)
	const os = Math.sign(code.hl.radius) || 1
	const ns = Math.sign(nr) || 1
	const nr2 = ns == os ? nr : 0

	if (no < oo)
	{
		for (let i = code.hl.radius; i != nr2; i -= os)
		{
			code.hl.lns[code.hl.start + i].classList.remove("hl")
			code.hl.cls[code.hl.start + i].classList.remove("hl")
		}
		code.hl.radius = nr2
	}

	for (let i = code.hl.radius; i != nr; i += ns)
	{
		code.hl.lns[code.hl.start + i + ns].classList.add("hl")
		code.hl.cls[code.hl.start + i + ns].classList.add("hl")
	}
	code.hl.radius = nr

	SetScrollTargetPos()
	SetScrollTargetId(false, false)
}

function EndSelection(e: MouseEvent)
{
	assert(code.hl)
	if (e.button != 0) return
	console.log("EndSelection")

	document.removeEventListener("mousemove", UpdateSelection)
	document.removeEventListener("mouseup",   EndSelection)

	let isSame = true
	isSame &&= code.prevHl?.idParent == code.hl.idParent
	isSame &&= code.prevHl?.start == code.hl.start
	isSame &&= code.prevHl?.radius == code.hl.radius

	if (isSame)
	{
		SetSelection(undefined)
	}
	else
	{
		SetScrollTargetPos()
		SetScrollTargetId(true, false)
	}
	code.prevHl = undefined
}

function SetScrollTargetPos()
{
	assert(code.scrollTarget)
	if (!code.hl) return
	console.log("SetScrollTargetPos")

	const a   = code.hl.start + 1
	const b   = code.hl.start + code.hl.radius + 1
	const min = Math.min(a, b)
	const max = Math.max(a, b)

	const minLn   = code.hl.lns[min - 1]
	const maxLn   = code.hl.lns[max - 1]
	const minY    = minLn.getBoundingClientRect().top
	const maxY    = maxLn.getBoundingClientRect().bottom
	const middleY = (minY + maxY - window.innerHeight) / 2
	const scrollY = window.scrollY + Math.min(minY, middleY)
	code.scrollTarget.style.setProperty("top", `${scrollY}px`)
}

function SetScrollTargetId(push: boolean, scroll: boolean)
{
	assert(code.scrollTarget)
	assert(code.hl)

	const a   = code.hl.start + 1
	const b   = code.hl.start + code.hl.radius + 1
	const min = Math.min(a, b)
	const max = Math.max(a, b)

	const lines = code.hl.radius ? `L${min}-${max}` : `L${min}`
	const id    = `${code.hl.idParent.id}${lines}`

	if (location.hash.substring(1) != id)
	{
		const newLocation = new URL(location.toString())
		newLocation.hash = id

		// TODO: Might want to throttle this. The browser will complain if you spam
		push
			? history.pushState(null, "", newLocation)
			: history.replaceState(null, "", newLocation)
	}

	if (history.state?.previouslyVisited)
	{
		// Don't auto-scroll when pressing F5
		setTimeout(() => code.scrollTarget!.id = id, 1)
	}
	else
	{
		history.replaceState({ previouslyVisited: true }, "")
		code.scrollTarget.id = id

		if (scroll)
			setTimeout(() => code.scrollTarget!.scrollIntoView(), 1)
	}
}

function SelectionFromHash()
{
	console.log("SelectionFromHash")

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
			if (hl.lns.length)
			{
				const a = Math.min(parseInt(sa) || 1, hl.lns.length)
				const b = Math.min(parseInt(sb) || a, hl.lns.length)
				hl.start  = a - 1
				hl.radius = b - a

				SetSelection(hl)
				SetScrollTargetPos()
				SetScrollTargetId(false, true)
				return
			}
		}
	}

	if (code.hl)
		SetSelection(undefined)
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
	? window.addEventListener("load", (e) => Initialize())
	: Initialize()
