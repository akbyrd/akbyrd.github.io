function assert(value: unknown): asserts value
{
	if (!value)
		throw "Condition failed"
}

function assertType<T>(value: unknown): asserts value is T {
}

function clamp(x: number, min: number, max: number)
{
	return Math.max(min, Math.min(max, x))
}

function clamp01(x: number)
{
	return Math.max(0, Math.min(1, x))
}

function lerp(a: number, b: number, t: number)
{
	return (1 - t) * a + t * b
}

// -------------------------------------------------------------------------------------------------
// Theme

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

function OpenLightbox(lightbox: HTMLElement, image: HTMLImageElement, navigate: boolean)
{
	const loc = new URL(location.href)
	loc.hash = `#${image.id}`
	if (navigate)
	{
		const state = history.state || {}
		state.navigated = navigate
		history.pushState(state, "", loc)
	}
	else
	{
		history.replaceState(history.state, "", loc)
	}

	const src    = image.dataset.fullSizeSrc || image.src
	const width  = parseInt(image.dataset.fullSizeWidth  || "0") || image.width
	const height = parseInt(image.dataset.fullSizeHeight || "0") || image.height

	const lbImg = lightbox.querySelector("img") as HTMLImageElement
	lbImg.title = image.title
	if (src)    lbImg.src    = src
	if (width)  lbImg.width  = width
	if (height) lbImg.height = height

	function OnLoad(success: boolean)
	{
		lbImg.alt = image.alt
		lbImg.classList.toggle("error", !success)
	}

	if (image.complete)
	{
		OnLoad(true)
	}
	else
	{
		lbImg.onload =  () => OnLoad(true)
		lbImg.onerror = () => OnLoad(false)
	}

	document.body.classList.add("inactive")
	lightbox.dataset.prevFocusId = image.id
	lightbox.dataset.prevActiveId = document.activeElement?.id
	lightbox.classList.add("active")
	lightbox.classList.remove("inactive")
	lightbox.focus()
}

function CloseLightbox(lightbox: HTMLElement, navigate: boolean)
{
	if (navigate && history.state?.navigated)
	{
		// Let the OnHashChange handle it
		history.back()
		return
	}
	else
	{
		const state = history.state || {}
		const loc = new URL(location.href)
		loc.hash = ""
		history.replaceState(state, "", loc)

		const focusId  = lightbox.dataset.prevFocusId
		const activeId = lightbox.dataset.prevActiveId
		if (focusId)
		{
			const focus = document.getElementById(focusId)
			if (focus)
			{
				focus.focus()
				if (activeId != focusId)
					focus.blur()
			}
		}
		delete lightbox.dataset.prevFocusId
		delete lightbox.dataset.prevActiveId
	}

	const lbImg = lightbox.querySelector("img") as HTMLImageElement
	lbImg.removeAttribute("title")
	lbImg.removeAttribute("alt")
	lbImg.removeAttribute("src")
	lbImg.removeAttribute("width")
	lbImg.removeAttribute("height")
	lbImg.classList.toggle("error", false)

	document.body.classList.remove("inactive")
	lightbox.classList.remove("active")
	lightbox.classList.add("inactive")
}

function InitImages()
{
	const lightbox = document.getElementById("lightbox") as HTMLElement
	lightbox.addEventListener("keydown", () => CloseLightbox(lightbox, true), { passive: true })
	lightbox.addEventListener("click",   () => CloseLightbox(lightbox, true), { passive: true })

	const imageContainers = document.querySelectorAll(".container.image")
	for (const container of imageContainers)
	{
		const image = container.querySelector("img") as HTMLImageElement

		function OnLoad(success: boolean)
		{
			// Fade images in
			image.classList.add("fade-in")
			image.style.opacity = "100%"
			container.classList.toggle("error", !success)

			// Hook up lightbox
			const scaled = image.clientWidth != image.naturalWidth || image.clientHeight != image.naturalHeight
			const fullSizeSrc = new URL(image.dataset.fullSizeSrc || image.src, location.origin).toString()
			const original = fullSizeSrc == image.src
			if (scaled || !original)
			{
				function OnKeyDown_Open(e: KeyboardEvent)
				{
					if (e.key == "Enter")
					{
						const state = history.state || {}
						state.prevFocusId = document.activeElement?.id
						OpenLightbox(lightbox, image, true)
					}
				}

				image.addEventListener("keydown", OnKeyDown_Open, { passive: true })
				image.addEventListener("click", () => OpenLightbox(lightbox, image, true), { passive: true })
				image.tabIndex = 0
				image.classList.add("use-lightbox")
			}
		}

		if (image.complete)
		{
			OnLoad(true)
		}
		else
		{
			image.style.opacity = "0%"
			image.addEventListener("load",  () => OnLoad(true),  { passive: true })
			image.addEventListener("error", () => OnLoad(false), { passive: true })
		}
	}

	function OnHashChange()
	{
		const id = location.hash.substring(1)
		const element = id ? document.getElementById(id) : null
		const isImage = element instanceof HTMLImageElement

		isImage
			? OpenLightbox(lightbox, element, false)
			: CloseLightbox(lightbox, false)
	}
	if (location.hash) OnHashChange()
	window.addEventListener("hashchange", OnHashChange, { passive: true })
}

// -------------------------------------------------------------------------------------------------
// Code

type CodeHighlight =
{
	intrinsic: number[],
	idParent:  HTMLElement,
	lines:     NodeListOf<HTMLElement>,
	lnStart:   number,
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
	dt:          number  = 0
	scrollTimer: number  = 0
	scrollAccum: number  = 0
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
	isFirefox:     boolean,
	scrollTarget?: HTMLElement,
	lnParents:     HTMLElement[],
	lns:           HTMLElement[],
	hash:          string,
	click?:        CodeClick | CodeClick_Touch,
	hl?:           CodeHighlight,
	prevHl?:       CodeHighlightState,
}

const code: Code = {
	isFirefox: false,
	lnParents: [],
	lns:       [],
	hash:      "",
}

function InitCode()
{
	code.isFirefox = navigator.userAgent.includes("Firefox/")

	// Hook up code and math copy buttons
	const codeButtons = document.querySelectorAll(".container.code > .copy-block")
	const mathButtons = document.querySelectorAll(".container.math > .copy-block")
	AttachCopyFunction(codeButtons, CopyCode)
	AttachCopyFunction(mathButtons, CopyMath)

	// Hook up line number selection
	const idParents = document.querySelectorAll(".container.code")
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

function AttachCopyFunction(elements: NodeListOf<Element> | Element, func: (e: Event) => void)
{
	if ("clipboard" in navigator)
	{
		if (elements instanceof NodeList)
		{
			for (const element of elements)
				element.addEventListener("click", func, { passive: true })
		}
		else
			elements.addEventListener("click", func, { passive: true })
	}
	else
	{
		if (elements instanceof NodeList)
		{
			for (const element of elements)
				(element as HTMLElement).style.display = "none"
		}
		else
		{
			(elements as HTMLElement).style.display = "none"
		}
	}
}

function CopyCode(e: Event)
{
	const button = e.currentTarget as HTMLElement
	const pre = button.nextElementSibling!
	const code = pre.querySelector("code")!
	if (code.textContent)
		navigator.clipboard.writeText(code.textContent)
}

function CopyMath(e: Event)
{
	const button = e.currentTarget as HTMLElement
	const pre = button.nextElementSibling!
	const math = pre.querySelector("annotation")!
	if (math.textContent)
		navigator.clipboard.writeText(math.textContent.trim())
}

function CreateSelection(idParent: HTMLElement)
{
	if (code.hl && code.hl.idParent == idParent)
	{
		const hl: CodeHighlight = {
			intrinsic: code.hl.intrinsic,
			idParent:  code.hl.idParent,
			lines:     code.hl.lines,
			lnStart:   code.hl.lnStart,
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
			lines:     idParent.querySelectorAll<HTMLElement>(".line"),
			lnStart:   parseInt(idParent.style.getPropertyValue("--ln-start")) || 1,
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
		lastT:       0,
		dt:          0,
		scrollTimer: 0,
		scrollAccum: 0,
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
	BeginSelection(lnParent)
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
		lastT:       0,
		dt:          0,
		scrollTimer: 0,
		scrollAccum: 0,
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
			BeginSelection(code.click.lnParent)
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

function UpdateSelection_Scroll()
{
	assert(code.click)

	UpdateSelection()
}

function BeginSelection(lnParent: HTMLElement)
{
	assert(code.click)

	document.addEventListener("scroll", UpdateSelection_Scroll, { passive: true })

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
	hl.start = CalculateLine(hl, code.click.clientY)
	SetSelection(hl)

	function AutoScroll()
	{
		assert(code.click)

		const threshold = 0.15
		const height    = document.documentElement.clientHeight
		const y         = code.click.clientY / height

		let amount = 0
		amount -= clamp01((0 - y) / threshold + 1)
		amount += clamp01((y - 1) / threshold + 1)
		amount = Math.pow(amount, 3) // must be odd

		const now = performance.now()
		const ndt = (now - code.click.lastT) / 1000
		code.click.dt = lerp(code.click.dt, ndt, 0.01)
		code.click.lastT = now

		let behavior: ScrollBehavior
		if (code.isFirefox)
		{
			// NOTE: Instant scrolling looks extremely bad on Firefox Android. It's also blocked by
			// rendering. Using dt with smooth scrolling also looks bad. This approach will not have
			// consistent scroll speed, but seems like the lesser of 3 evils.
			code.click.scrollAccum += 80 * amount
			behavior = "smooth"
		}
		else
		{
			code.click.scrollAccum += 800 * amount * code.click.dt
			behavior = "instant"
		}

		let scroll = Math.trunc(code.click.scrollAccum)
		code.click.scrollAccum -= scroll

		const rect = code.hl!.idParent.getBoundingClientRect()
		const minUp = Math.min(0, rect.top    - (0 + threshold) * height)
		const maxDn = Math.max(0, rect.bottom - (1 - threshold) * height)
		scroll = clamp(scroll, minUp, maxDn)

		window.scrollBy({
			top: scroll,
			behavior: behavior,
		})
		code.click.scrollTimer = requestAnimationFrame(AutoScroll)
	}

	code.click.lastT = performance.now()
	code.click.scrollTimer = requestAnimationFrame(AutoScroll)
}

function UpdateSelection()
{
	assert(code.hl)
	assert(code.click)

	// n = new, o = old
	// r = radius, o = offset, s = sign

	const ln = CalculateLine(code.hl, code.click.clientY)
	const nr = ln - code.hl.start
	const no = Math.abs(nr)
	const ns = Math.sign(nr) || 1
	const oo = Math.abs(code.hl.radius)
	const os = Math.sign(code.hl.radius) || 1

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

	document.removeEventListener("scroll", UpdateSelection_Scroll)
	cancelAnimationFrame(code.click.scrollTimer)

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
			const loc = new URL(location.href)
			loc.hash = code.hash
			history.pushState({ previouslyVisited: true }, "", loc)
		}
	}

	code.prevHl = undefined
}

function CalculateLine(hl: CodeHighlight, clientY: number)
{
	// NOTE: Assume all lines are the same size, equally spaced, and potentially overlapping
	const rect0 = hl.lines[0].getBoundingClientRect()
	let lnHeight = rect0.height
	if (hl.lines.length > 1)
	{
		const rectN = hl.lines[1].getBoundingClientRect()
		lnHeight = rectN.top - rect0.top
	}

	let ln = Math.floor((clientY - Math.floor(rect0.top)) / lnHeight)
	ln = clamp(ln, 0, hl.lines.length - 1)
	return ln
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
	const regex = /^#(.+?)(?:L(\d+)(?:-(\d+))?)?$/
	const match = location.hash.match(regex)
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
					const state = history.state || {}
					state.previouslyVisited = true
					history.replaceState(state, "")
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
// Math

function InitMath()
{
	document.body.insertAdjacentHTML("afterbegin",
		"<div style=' \
			border: 0; \
			clip: rect(0 0 0 0); \
			height: 1px; \
			margin: -1px; \
			overflow: hidden; \
			padding: 0; \
			position: absolute; \
			width: 1px; \
		'> \
			<math xmlns='http://www.w3.org/1998/Math/MathML'> \
				<mspace height='23px' width='77px'></mspace> \
			</math> \
		</div>")

	const div = document.body.firstElementChild!
	const mspace = div.firstElementChild!.firstElementChild!
	const rect = mspace.getBoundingClientRect()
	document.body.removeChild(div)

	if (Math.abs(rect.height - 23) > 1 || Math.abs(rect.width - 77) > 1)
	{
		const html = document.getElementsByTagName("html")[0]
		html.classList.add("no-mathml")
	}
}

// -------------------------------------------------------------------------------------------------
// Comments

enum DeploymentEnv
{
	Development = "development",
	Staging     = "staging",
	Production  = "production",
}

declare const deploymentEnv: DeploymentEnv
declare const stagingKey: string

let commentState: {
	loggedIn:          boolean
	apiUrl:            string
	autoScroll?: {
		interval:       number
		lastPos:        v2
		lastChange:     number
	}
	lastSaveScrollPos: number
	parent:            HTMLElement
	templates: CommentTemplates & {
		comment:        HTMLTemplateElement
		reply:          HTMLTemplateElement
	}
	loadingContainer:  HTMLElement
	errorContainer:    HTMLElement
	successContainer:  HTMLElement
	currentError?:     HTMLElement
	commentElems:      ICommentElements[]
	syntheticClick?:   HTMLButtonElement
}

enum CommentsState
{
	Disabled,
	Loading,
	Error,
	Success,
}

interface ICommentElements
{
	discussionId:   string
	commentId:      string
	draftKey:       string
	root:           HTMLElement
	form:           HTMLFormElement
	repliesParent?: HTMLElement
	textArea:       HTMLTextAreaElement
	submitButton:   HTMLButtonElement
	submitError:    HTMLElement
	submitStatus:   HTMLElement
	logoutButton:   HTMLButtonElement
	logoutError:    HTMLElement
	logoutStatus:   HTMLElement
}

interface CommentTemplates
{
	header: HTMLTemplateElement
	codeBlock: HTMLTemplateElement
	mathInline: HTMLTemplateElement
	mathBlock: HTMLTemplateElement
	callout: HTMLTemplateElement
	footer: HTMLTemplateElement
}

interface IDiscussion
{
	id: string
	comments: { nodes: IComment[] }
}

interface ICommentBase
{
	id: string
	author: IAuthor
	bodyHTML: string
	createdAt: string
	reactionGroups: IReactionGroup[]
	url: string
}

interface IComment extends ICommentBase
{
	replies: { nodes: IReply[] }
}

interface IReply extends ICommentBase
{
}

interface IAuthor
{
	avatarUrl: string
	login: string
	url: string
}

interface IReactionGroup
{
	content: keyof Reaction
	viewerHasReacted: boolean
	users: {
		totalCount: number
	}
}

enum Reaction
{
	THUMBS_UP,
	THUMBS_DOWN,
	LAUGH,
	HOORAY,
	CONFUSED,
	HEART,
	ROCKET,
	EYES,
}

interface v2
{
	x: number
	y: number
}

function InitComments()
{
	const parent = document.getElementById("comments-section")
	if (!parent)
		return

	let apiUrl = ""
	switch (deploymentEnv)
	{
		case DeploymentEnv.Development: apiUrl = "http://localhost:3000";               break
		case DeploymentEnv.Staging:     apiUrl = "https://staging.comments.akbyrd.dev"; break
		case DeploymentEnv.Production:  apiUrl = "https://comments.akbyrd.dev";         break
	}

	const comment0Root = parent.querySelector(".comment") as HTMLElement
	commentState = {
		loggedIn: false,
		apiUrl,
		lastSaveScrollPos: 0,
		parent,
		templates: {
			comment:    document.getElementById("comment-template") as HTMLTemplateElement,
			reply:      document.getElementById("reply-template") as HTMLTemplateElement,
			header:     document.getElementById("comment-header-template") as HTMLTemplateElement,
			codeBlock:  document.getElementById("comment-code-block-template") as HTMLTemplateElement,
			mathInline: document.getElementById("comment-math-inline-template") as HTMLTemplateElement,
			mathBlock:  document.getElementById("comment-math-block-template") as HTMLTemplateElement,
			callout:    document.getElementById("comment-callout-template") as HTMLTemplateElement,
			footer:     document.getElementById("comment-footer-template") as HTMLTemplateElement,
		},
		loadingContainer: parent.querySelector(".comments-state-loading") as HTMLElement,
		errorContainer:   parent.querySelector(".comments-state-error") as HTMLElement,
		successContainer: parent.querySelector(".comments-state-success") as HTMLElement,
		commentElems: [{
			discussionId: "",
			commentId:    "",
			draftKey:     location.pathname,
			root:         comment0Root,
			form:         comment0Root.querySelector("form")!,
			textArea:     comment0Root.querySelector("textarea")!,
			submitButton: comment0Root.querySelector(".comment-submit button") as HTMLButtonElement,
			submitError:  comment0Root.querySelector(".comment-submit .comment-button-error") as HTMLElement,
			submitStatus: comment0Root.querySelector(".comment-submit .error-status") as HTMLElement,
			logoutButton: comment0Root.querySelector(".comment-logout button") as HTMLButtonElement,
			logoutError:  comment0Root.querySelector(".comment-logout .comment-button-error") as HTMLElement,
			logoutStatus: comment0Root.querySelector(".comment-logout .error-status") as HTMLElement,
		}],
	}

	const reloadButton = commentState.errorContainer.querySelector("button")!
	reloadButton.addEventListener("click", ReloadComments, { passive: true })

	// TODO: Dislike this duplication
	const elems0 = commentState.commentElems[0]
	SetCommentText(elems0, localStorage.getItem(elems0.draftKey) || "")
	elems0.textArea.addEventListener("keydown", (e) => SubmitForm(e, elems0), { passive: true })
	elems0.textArea.addEventListener("input", () => UpdateInputHeight(elems0), { passive: true })
	elems0.submitButton.addEventListener("click", (e) => LoginOrSubmit(e, elems0), { passive: false })
	elems0.logoutButton.addEventListener("click", (e) => Logout(e, elems0), { passive: false })

	SetCommentsState(CommentsState.Disabled)
	SetLoggedIn(false)
	SetDiscussion(undefined)

	window.addEventListener("scrollend", SaveScrollPos, { passive: true })
	window.addEventListener("resizeend", SaveScrollPos, { passive: true })

	if (RestoreScrollPos())
		return

	const observer = new IntersectionObserver((entries, observer) => {
		for (const entry of entries)
		{
			if (entry.isIntersecting)
			{
				LoadComments()
				observer.unobserve(entry.target)
			}
		}
	})
	observer.observe(commentState.parent)
}

function SetCommentsState(state: CommentsState)
{
	commentState.loadingContainer.toggleAttribute("data-disabled", state != CommentsState.Loading)
	commentState.errorContainer  .toggleAttribute("data-disabled", state != CommentsState.Error)
	commentState.successContainer.toggleAttribute("data-disabled", state != CommentsState.Success)
}

function SetLoggedIn(loggedIn: boolean)
{
	commentState.loggedIn = loggedIn
	if (loggedIn)
	{
		commentState.parent.classList.remove("comments-logged-out")
		commentState.parent.classList.add("comments-logged-in")

		for (const elems of commentState.commentElems)
		{
			elems.textArea.readOnly = false
			elems.submitButton.disabled = !elems.textArea.textLength
		}
	}
	else
	{
		commentState.parent.classList.remove("comments-logged-in")
		commentState.parent.classList.add("comments-logged-out")

		for (const elems of commentState.commentElems)
		{
			elems.textArea.readOnly = true
			elems.submitButton.disabled = false
		}

		const reactions = commentState.parent.querySelectorAll(".comment-reaction")
		for (const reaction of reactions)
			reaction.removeAttribute("data-pressed")
	}
}

function SetDiscussion(discussion?: IDiscussion)
{
	if (discussion)
	{
		commentState.commentElems[0].discussionId = discussion.id

		for (const comment of discussion.comments.nodes)
			AddComment(comment)
	}
	else
	{
		for (let i = commentState.commentElems.length - 1; i > 0; --i)
			commentState.commentElems[i].root.remove()

		commentState.commentElems.length = 1
		commentState.commentElems[0].discussionId = ""
	}
}

function SetCommentText(elems: ICommentElements, text: string)
{
	elems.textArea.value = text
	UpdateInputHeight(elems)
}

function AddComment(comment: IComment)
{
	const { fragment, root, form } = CreateComment(commentState.templates, commentState.templates.comment, comment)
	commentState.successContainer.insertBefore(fragment, commentState.commentElems[0].root)

	const elems = {
		discussionId: commentState.commentElems[0].discussionId,
		commentId:    comment.id,
		draftKey:     `${location.pathname}${comment.id}`,
		root:         root,
		form:         form,
		textArea:     form.querySelector("textarea")!,
		submitButton: form.querySelector(".comment-submit button") as HTMLButtonElement,
		submitError:  form.querySelector(".comment-submit .comment-button-error") as HTMLElement,
		submitStatus: form.querySelector(".comment-submit .error-status") as HTMLElement,
		logoutButton: form.querySelector(".comment-logout button") as HTMLButtonElement,
		logoutError:  form.querySelector(".comment-logout .comment-button-error") as HTMLElement,
		logoutStatus: form.querySelector(".comment-logout .error-status") as HTMLElement,
	}
	commentState.commentElems.push(elems)

	SetCommentText(elems, localStorage.getItem(elems.draftKey) || "")
	elems.textArea.addEventListener("keydown", (e) => SubmitForm(e, elems), { passive: true })
	elems.textArea.addEventListener("input", () => UpdateInputHeight(elems), { passive: true })
	elems.submitButton.addEventListener("click", (e) => LoginOrSubmit(e, elems), { passive: false })
	elems.logoutButton.addEventListener("click", (e) => Logout(e, elems), { passive: false })

	for (const reply of comment.replies.nodes)
		AddReply(reply, elems)
}

function AddReply(reply: IReply, elems: ICommentElements)
{
	if (!elems.repliesParent)
	{
		elems.repliesParent = document.createElement("section")
		elems.repliesParent.classList.add("comment-replies")
		elems.root.insertBefore(elems.repliesParent, elems.form)

		const repliesLine = document.createElement("div")
		repliesLine.classList.add("reply-line")
		elems.repliesParent.prepend(repliesLine)
	}

	const { fragment, root, form } = CreateComment(commentState.templates, commentState.templates.reply, reply)
	elems.repliesParent.append(fragment)

	SetCommentText(elems, localStorage.getItem(elems.draftKey) || "")
}

async function ReloadComments()
{
	SetLoggedIn(false)
	SetDiscussion(undefined)
	await LoadComments()
}

async function LoadComments()
{
	SetCommentsState(CommentsState.Loading)

	const url = `${commentState.apiUrl}/load`
	const body = {
		page:     location.pathname,
		owner:    "akbyrd",
		repo:     "akbyrd.github.io",
		category: "Blog Post Comments",
	}

	const result = await APIRequest("POST", url, body)
	if (!result.success)
	{
		SetCommentsState(CommentsState.Error)
		return
	}

	const discussion = result.json as IDiscussion
	SetCommentsState(CommentsState.Success)
	SetLoggedIn(commentState.loggedIn)
	SetDiscussion(discussion)
}

interface ICreateComment
{
	fragment: DocumentFragment
	root: HTMLElement
	form: HTMLFormElement
}

function CreateComment(templates: CommentTemplates, commentTemplate: HTMLTemplateElement, elems: ICommentBase): ICreateComment
{
	const fragment = commentTemplate.content.cloneNode(true) as DocumentFragment
	const root = fragment.querySelector("section")!
	const form = fragment.querySelector("form")!
	const content = fragment.querySelector(".comment-content") as HTMLElement
	content.innerHTML = elems.bodyHTML

	// Header
	{
		const headerFragment = templates.header.content.cloneNode(true) as DocumentFragment

		const aAvatar = headerFragment.querySelector(".comment-avatar") as HTMLAnchorElement
		aAvatar.href = elems.author.url
		aAvatar.append(elems.author.login)

		const img = aAvatar.querySelector("img")!
		const url = new URL(elems.author.avatarUrl)
		url.searchParams.append("size", (2 * img.width).toString())
		img.src = url.toString()
		img.style.display = "inline"

		const aTime = headerFragment.querySelector(".comment-time") as HTMLAnchorElement
		aTime.href = elems.url

		const time = aTime.querySelector("time")!
		time.dateTime = elems.createdAt
		const date = new Date(elems.createdAt)
		const formatter = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit" })
		time.textContent = formatter.format(date)

		root.prepend(headerFragment)
	}

	// Code
	{
		function ConstructCodeBlock(root: Element, codeNode: Element)
		{
			const codeBlockFragment = templates.codeBlock.content.cloneNode(true) as DocumentFragment

			const code = codeBlockFragment.querySelector("code")!
			code.append(...codeNode.childNodes)

			const button = codeBlockFragment.querySelector("button")!
			AttachCopyFunction(button, CopyCode)
			root.parentElement!.replaceChild(codeBlockFragment, root)
		}

		const blockCodes = content.querySelectorAll("div.highlight")
		for (const codeDiv of blockCodes)
		{
			const pre = codeDiv.querySelector("pre")
			if (pre)
				ConstructCodeBlock(codeDiv, pre)
		}

		const blockCodesNoLang = content.querySelectorAll("div.snippet-clipboard-content")
		for (const codeDiv of blockCodesNoLang)
		{
			const code = codeDiv.querySelector("pre > code")
			if (code)
				ConstructCodeBlock(codeDiv, code)
		}
	}

	// Math
	{
		const inlineMaths = content.querySelectorAll(".js-inline-math") as NodeListOf<HTMLElement>
		for (const ghMath of inlineMaths)
		{
			const mathFragment = templates.mathInline.content.cloneNode(true) as DocumentFragment

			const annotation = mathFragment.querySelector("annotation")!
			let latex = ghMath.textContent!
			latex = latex.replace(/^\$\`\s*|\s*\$\`$$/gm, "")
			latex = latex.replace(/^\$\s*|\s*\$$/gm, "")
			annotation.textContent = latex

			ghMath.parentElement!.replaceChild(mathFragment, ghMath)
		}

		const displayMaths = content.querySelectorAll(".js-display-math") as NodeListOf<HTMLElement>
		for (const ghMath of displayMaths)
		{
			const mathFragment = templates.mathBlock.content.cloneNode(true) as DocumentFragment

			const annotation = mathFragment.querySelector("annotation")!
			let latex = ghMath.textContent!
			latex = latex.replace(/^\$\$\s*|\s*\$\$$/gm, "")
			annotation.textContent = latex

			const button = mathFragment.querySelector("button")!
			AttachCopyFunction(button, CopyMath)

			if (ghMath.parentElement!.tagName == "P")
				ghMath.parentElement!.parentElement!.replaceChild(mathFragment, ghMath.parentElement!)
			else
				ghMath.parentElement!.replaceChild(mathFragment, ghMath)
		}
	}

	// Task lists
	{
		const taskListItems = content.querySelectorAll(".task-list-item")
		for (const taskListItem of taskListItems)
		{
			const input = taskListItem.children[0]
			if (input)
			{
				if (input.hasAttribute("checked"))
					taskListItem.classList.add("checked")
				input.remove()
			}
		}
	}

	// Callouts
	{
		const callouts = content.querySelectorAll(".markdown-alert")
		for (const callout of callouts)
		{
			const calloutFragment = templates.callout.content.cloneNode(true) as DocumentFragment

			const root  = calloutFragment.querySelector(".callout")!
			const icon  = calloutFragment.querySelector(".callout-icon")!
			const title = calloutFragment.querySelector(".callout-title")!

			const ghRoot    = callout
			const ghHeading = callout.querySelector(".markdown-alert-title")!
			const ghIcon    = callout.querySelector("svg")!

			ghIcon.remove()
			title.append(...ghHeading.childNodes)

			ghHeading.remove()
			for (const ghText of ghRoot.childNodes)
			{
				if (ghText instanceof HTMLElement)
					ghText.classList.add("callout-text")
			}
			root.append(...ghRoot.childNodes)

			const classRemaps = [
				[ "markdown-alert-note",      "callout-note",      "&#xf05a;"  ],
				[ "markdown-alert-tip",       "callout-tip",       "&#xf0335;" ],
				[ "markdown-alert-important", "callout-important", "&#xf11ce;" ],
				[ "markdown-alert-warning",   "callout-warning",   "&#xf40c;"  ],
				[ "markdown-alert-caution",   "callout-caution",   "&#xf0029;" ],
			]

			for (const remap of classRemaps)
			{
				if (ghRoot.classList.contains(remap[0]))
				{
					root.classList.add(remap[1])
					icon.innerHTML = remap[2]
				}
			}

			ghRoot.replaceWith(calloutFragment)
		}
	}

	// Emoji
	{
		const emojis = content.querySelectorAll(".emoji")
		for (const emoji of emojis)
			emoji.setAttribute("draggable", "false")
	}

	// Footer
	{
		const footerFragment = templates.footer.content.cloneNode(true) as DocumentFragment

		const button = footerFragment.querySelector(".comment-toggle-reactions")!
		button.addEventListener("click", ToggleReactions, { passive: true })

		const reactions = footerFragment.querySelectorAll(".comment-reaction") as NodeListOf<HTMLButtonElement>
		for (const reaction of reactions)
		{
			const key = reaction.name as keyof Reaction
			const data = elems.reactionGroups.find(r => r.content == key)!
			if (data.viewerHasReacted)
				reaction.toggleAttribute("data-pressed")
			UpdateReactionVisibility(reaction, false, data.users.totalCount)

			reaction.addEventListener("click", (e) => ToggleReaction(e, elems), { passive: true })
		}

		root.insertBefore(footerFragment, form)
	}

	return { fragment, root, form }
}

function ToggleReactions(e: Event)
{
	const target = e.currentTarget as HTMLButtonElement
	const reactions = target.parentElement!.querySelectorAll(".comment-reaction") as NodeListOf<HTMLButtonElement>

	if (target.toggleAttribute("data-pressed"))
	{
		for (const reaction of reactions)
			UpdateReactionVisibility(reaction, true, 0)

		setTimeout(() => {
			document.addEventListener("click", {
				handleEvent(e: Event)
				{
					if (commentState.syntheticClick && commentState.syntheticClick != target) return

					const clickedFooter = target.parentElement!.contains(e.target as Node)
					const clickedButton = target == e.target
					if (!clickedFooter || clickedButton)
					{
						document.removeEventListener("click", this)
						if (target.hasAttribute("data-pressed"))
						{
							commentState.syntheticClick = target
							target.click()
							commentState.syntheticClick = undefined
						}
					}
				}
			}, { passive: true })
		}, 1)
	}
	else
	{
		for (const reaction of reactions)
			UpdateReactionVisibility(reaction, false, 0)
	}
}

async function ToggleReaction(e: Event, comment: ICommentBase)
{
	const reactionButton = e.currentTarget as HTMLButtonElement
	reactionButton.disabled = true

	const reaction = reactionButton.name as keyof Reaction
	const add = !reactionButton.hasAttribute("data-pressed")

	const url = `${commentState.apiUrl}/react`
	const body = {
		subjectId: comment.id,
		reaction:  reaction,
		add:       add.toString(),
	}

	const result = await APIRequest("POST", url, body)
	if (!result.success)
	{
		reactionButton.disabled = false
		return
	}

	reactionButton.disabled = false
	reactionButton.toggleAttribute("data-pressed")

	const reactionsDiv = reactionButton.parentElement!.parentElement!.parentElement!
	const reactionsButton = reactionsDiv.querySelector(".comment-toggle-reactions") as HTMLButtonElement
	const showReactions = reactionsButton.hasAttribute("data-pressed")
	const countOffset = add ? 1 : -1
	UpdateReactionVisibility(reactionButton, showReactions, countOffset)
}

function UpdateReactionVisibility(reaction: HTMLButtonElement, showReactions: boolean, countOffset: number)
{
	const countSpan = reaction.querySelector(".comment-reaction-count") as HTMLSpanElement
	const count = parseInt(countSpan.textContent!) + countOffset
	countSpan.textContent = count.toString()

	const visible = showReactions || count != 0
	if (reaction.hasAttribute("data-visible") != visible)
	{
		reaction.disabled = !visible
		reaction.toggleAttribute("data-visible")
	}
}

function SubmitForm(e: KeyboardEvent, elems: ICommentElements)
{
	if (e.ctrlKey && e.key == "Enter")
		elems.submitButton.click()
}

function UpdateInputHeight(elems: ICommentElements)
{
	elems.textArea.value
		? localStorage.setItem(elems.draftKey, elems.textArea.value)
		: localStorage.removeItem(elems.draftKey)

	elems.submitButton.disabled = commentState.loggedIn && !elems.textArea.textLength

	const oldHeight = elems.textArea.getClientRects()[0].height
	elems.textArea.style.height = "auto"

	const newHeightRect = elems.textArea.getClientRects()[0].height
	const newHeightScroll = elems.textArea.scrollHeight
	const newHeight = Math.abs(newHeightRect - newHeightScroll) < 1 ? newHeightRect : newHeightScroll
	elems.textArea.style.height = `${oldHeight}px`

	const reflow = elems.textArea.scrollHeight
	elems.textArea.style.height = `${newHeight}px`

	requestAnimationFrame(() => elems.textArea.scrollTop = 0)

	if (elems.textArea.selectionEnd
		&& elems.textArea.selectionEnd == elems.textArea.selectionStart
		&& elems.textArea.selectionEnd == elems.textArea.textLength)
	{
		const threshold = 0.15
		const height    = document.documentElement.clientHeight
		const y         = elems.textArea.getBoundingClientRect().bottom
		const target    = (1 - threshold) * height
		if (y > target)
			window.scrollBy({ top: y - target, behavior: "instant" })
	}
}

interface IAutoScroll
{
	time: number
	commentId: string
	scrollPos: { x: number, y: number }
	clientPos: { x: number, y: number }
}

function SetCurrentError(errorElem: HTMLElement, statusElem: HTMLElement, status?: number)
{
	console.assert(!commentState.currentError)
	commentState.currentError = errorElem

	statusElem.textContent = status ? status.toString() : "Error"
	errorElem.style.display = ""
}

function ClearCurrentError(errorElem?: HTMLElement)
{
	if (!commentState.currentError) return
	commentState.currentError.style.display = "none"
}

async function LoginOrSubmit(e: Event, elems: ICommentElements)
{
	e.preventDefault()

	elems.submitButton.parentElement!.focus()
	elems.submitButton.disabled = true
	ClearCurrentError()

	if (!commentState.loggedIn)
	{
		const state = PrepareAutoScroll(elems.textArea, elems.commentId)
		sessionStorage.setItem("loginAutoScroll", JSON.stringify(state))

		const url = new URL("https://github.com/login/oauth/authorize")
		url.searchParams.append("client_id", "Iv23liF0BbZzzsm6OCu8")
		url.searchParams.append("redirect_uri", `${commentState.apiUrl}/login`)
		url.searchParams.append("state", location.href)
		location.href = url.toString()
	}
	else
	{
		const url = `${commentState.apiUrl}/comment`
		const body = {
			page:         location.pathname,
			owner:        "akbyrd",
			repo:         "akbyrd.github.io",
			category:     "Blog Post Comments",
			discussionId: elems.discussionId,
			commentId:    elems.commentId,
			content:      elems.textArea.value,
		}

		const result = await APIRequest("POST", url, body)
		if (!result.success)
		{
			elems.submitButton.disabled = false
			elems.submitButton.focus()
			SetCurrentError(elems.submitError, elems.submitStatus, result.response?.status)
			return
		}

		elems.submitButton.focus()
		SetCommentText(elems, "")

		if (result.json.comments)
		{
			const discussion = result.json as IDiscussion
			SetDiscussion(discussion)
		}
		else
		{
			if (elems.commentId)
			{
				const reply = result.json as IReply
				AddReply(reply, elems)
			}
			else
			{
				const elems = result.json as IComment
				AddComment(elems)
			}
		}
	}
}

async function Logout(e: Event, elems: ICommentElements)
{
	e.preventDefault()

	elems.logoutButton.parentElement!.focus()
	elems.logoutButton.disabled = true
	ClearCurrentError(elems.logoutError)

	const url = `${commentState.apiUrl}/logout`
	const result = await APIRequest("POST", url, {})
	if (!result.success)
	{
		elems.logoutButton.disabled = false
		elems.logoutButton.focus()
		SetCurrentError(elems.logoutError, elems.logoutStatus, result.response?.status)
		return
	}

	elems.logoutButton.disabled = false
	elems.logoutButton.style.border = ""
}

type FetchResult<T = Record<string, any>> = {
	success:   boolean,
	response?: Response,
	json:      T
}

async function APIRequest(method: string, url: URL | string, body?: {}, headers: { [key: string]: string } = {}): Promise<FetchResult>
{
	// NOTE: Including cookies is tricky
	// * Must use credentials: include
	// * Must use access-control-allow-credentials: true
	// * Must use access-control-allow-origin: <domain> (not *)
	// * Must use SameSite: None
	// * Must use Secure
	// * Must use HTTPS

	console.assert(method == "GET"  ? body == undefined : true)
	console.assert(method == "HEAD" ? body == undefined : true)

	let response
	let json
	try
	{
		if (deploymentEnv == DeploymentEnv.Staging)
			headers["x-vercel-protection-bypass"] = stagingKey

		response = await fetch(url, {
			method,
			body: JSON.stringify(body),
			credentials: "include",
			headers,
		})

		json = await response.json()
	}
	catch
	{
	}
	finally
	{
		if (response)
		{
			const loggedIn = response.headers.has("x-authenticated")
			SetLoggedIn(loggedIn)

			return { success: response.ok, response, json }
		}
		else
		{
			return { success: false, response: undefined, json }
		}
	}
}

function SaveScrollPos()
{
	const now = performance.now()
	const elapsed = now - commentState.lastSaveScrollPos
	const throttle = 200 - elapsed
	if (throttle > 0)
	{
		commentState.lastSaveScrollPos = now + throttle
		setTimeout(() => SaveScrollPos(), throttle)
		return
	}

	if (!commentState.successContainer.hasAttribute("data-disabled"))
	{
		for (const elems of commentState.commentElems)
		{
			const rect = elems.root.getClientRects()[0]
			if (rect.y < window.innerHeight)
			{
				const autoScroll = PrepareAutoScroll(elems.textArea, elems.commentId)
				const state = history.state || {}
				state.autoScroll = autoScroll
				history.replaceState(state, "")
				return
			}
		}
	}

	const state = history.state || {}
	state.autoScroll = null
	history.replaceState(state, "")
}

function RestoreScrollPos()
{
	let autoScroll = null

	const autoScrollStr = sessionStorage.getItem("loginAutoScroll")
	if (autoScrollStr)
	{
		sessionStorage.removeItem("loginAutoScroll")
		autoScroll = JSON.parse(autoScrollStr) as IAutoScroll
		if (Date.now() - autoScroll.time > 60 * 1000) // 1 minute
			autoScroll = null
	}
	else
	{
		if (history.state)
			autoScroll = history.state.autoScroll
	}

	if (autoScroll)
	{
		setTimeout(async () => {
			BeginAutoScroll(autoScroll.scrollPos)

			await LoadComments()
			if (!commentState.autoScroll) return

			let element = undefined
			for (const elems of commentState.commentElems)
			{
				if (elems.commentId == autoScroll.commentId)
				{
					element = elems.textArea
					break
				}
			}

			CancelAutoScroll()
			BeginAutoScroll(autoScroll.scrollPos, autoScroll.clientPos, element)
		}, 0)
		return true
	}

	return false
}

function PrepareAutoScroll(elem: HTMLElement, commentId: string): IAutoScroll
{
	const rect = elem.getClientRects()[0]
	const autoScroll: IAutoScroll = {
		time: Date.now(),
		commentId,
		scrollPos: {
			x: window.scrollX,
			y: window.scrollY,
		},
		clientPos: {
			x: rect.x,
			y: rect.y,
		}
	}
	return autoScroll
}

function BeginAutoScroll(scroll: v2, client: v2 = {x: 0, y: 0}, element?: HTMLElement)
{
	assert(!commentState.autoScroll)

	commentState.autoScroll = {
		interval: setInterval(() => UpdateAutoScroll(scroll, client, element), 200),
		lastPos: { x: window.scrollX, y: window.scrollY },
		lastChange: performance.now(),
	}

	document.addEventListener("wheel",       CancelAutoScroll, { passive: true })
	document.addEventListener("touchstart",  CancelAutoScroll, { passive: true })
	document.addEventListener("keydown",     CancelAutoScroll, { passive: true })
	document.addEventListener("pointerdown", CancelAutoScroll, { passive: true })
}

function UpdateAutoScroll(scroll: v2, client: v2 = {x: 0, y: 0}, element?: HTMLElement)
{
	assert(commentState.autoScroll)

	const dst = scroll
	if (element)
	{
		const newScroll = { x: window.scrollX, y: window.scrollY }
		const newClient = element.getClientRects()[0]
		dst.x += (newScroll.x + newClient.x) - (scroll.x + client.x)
		dst.y += (newScroll.y + newClient.y) - (scroll.y + client.y)
	}

	if (commentState.autoScroll.lastPos.x != dst.x ||
		commentState.autoScroll.lastPos.y != dst.y)
	{
		commentState.autoScroll.lastPos = dst
		commentState.autoScroll.lastChange = performance.now()
		window.scrollTo({ top: dst.y, left: dst.x, behavior: "smooth", })
	}
	else
	{
		if (performance.now() - commentState.autoScroll.lastChange >= 2000)
			CancelAutoScroll()
	}
}

function CancelAutoScroll()
{
	if (!commentState.autoScroll) return

	clearInterval(commentState.autoScroll.interval)
	commentState.autoScroll = undefined

	document.removeEventListener("wheel",       CancelAutoScroll)
	document.removeEventListener("touchstart",  CancelAutoScroll)
	document.removeEventListener("keydown",     CancelAutoScroll)
	document.removeEventListener("pointerdown", CancelAutoScroll)
}

// -------------------------------------------------------------------------------------------------
// Initialization

function Initialize()
{
	InitTheme()
	InitImages()
	InitCode()
	InitMath()
	InitComments()
}

document.readyState !== "complete"
	? window.addEventListener("load", Initialize, { passive: true })
	: Initialize()
