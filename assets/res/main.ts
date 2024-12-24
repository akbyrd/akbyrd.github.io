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
// Feature Detection

function InitFeatures()
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
	const pre = button.previousElementSibling!
	const code = pre.querySelector("code")!
	if (code.textContent)
		navigator.clipboard.writeText(code.textContent)
}

function CopyMath(e: Event)
{
	const button = e.currentTarget as HTMLElement
	const pre = button.previousElementSibling!
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
			const currLocation = new URL(location.href)
			currLocation.hash = code.hash
			history.pushState({ previouslyVisited: true }, "", currLocation)
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
// Comments

let commentState: {
	commentsParent: HTMLElement
	errorMessage: HTMLElement
	newComment: HTMLElement
	commentInput: HTMLElement
	syntheticClick?: HTMLButtonElement
}

interface CommentTemplates
{
	header: HTMLTemplateElement
	codeBlock: HTMLTemplateElement
	mathInline: HTMLTemplateElement
	mathBlock: HTMLTemplateElement
	footer: HTMLTemplateElement
}

interface IDiscussion
{
	bodyHTML: string
	comments: { nodes: IComment[] }
	reactionGroups: IReactionGroup[]
}

interface ICommentBase
{
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

async function InitComments()
{
	const commentsParent = document.getElementById("comments")
	if (!commentsParent)
		return

	commentState = {
		commentsParent,
		newComment: commentsParent.querySelector("#comment-new") as HTMLElement,
		commentInput: commentsParent.querySelector("#comment-input") as HTMLElement,
		errorMessage: commentsParent.querySelector("#comment-error") as HTMLElement,
	}

	const reloadButton = commentsParent.querySelector("#comment-error button")!
	reloadButton.addEventListener("click", ReloadComments, { passive: true })

	await LoadComments()
}

export async function GetCategories()
{
	const owner = "akbyrd"
	const repo = "akbyrd.github.io"

	const url = new URL("https://faas-nyc1-2ef2e6cc.doserverless.co/api/v1/web/fn-a8e52261-669e-47a2-88db-6280c8b77099/default/api/categories")
	url.searchParams.append("owner", owner)
	url.searchParams.append("repo", repo)

	const response = await fetch(url, {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
		},
	})

	const json = await response.json()
	return json
}

async function ReloadComments()
{
	const comments = commentState.commentsParent.querySelectorAll(".comment")
	for (const comment of comments)
		comment.remove()

	await LoadComments()
}

async function LoadComments()
{
	const url = new URL("https://faas-nyc1-2ef2e6cc.doserverless.co/api/v1/web/fn-a8e52261-669e-47a2-88db-6280c8b77099/default/api")
	url.searchParams.append("owner", "akbyrd")
	url.searchParams.append("repo", "akbyrd.github.io")
	url.searchParams.append("category", "Blog Post Comments")
	url.searchParams.append("page", location.pathname)

	const response = await fetch(url, {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
		},
	})

	const json = await response.json()
	if (!response.ok)
	{
		commentState.errorMessage.style.display = ""
		return
	}

	const discussion = json as IDiscussion
	const commentTemplate = document.getElementById("comment-template") as HTMLTemplateElement
	const replyTemplate = document.getElementById("reply-template") as HTMLTemplateElement

	const templates = {
		header: document.getElementById("comment-header-template") as HTMLTemplateElement,
		codeBlock: document.getElementById("comment-code-block-template") as HTMLTemplateElement,
		mathInline: document.getElementById("comment-math-inline-template") as HTMLTemplateElement,
		mathBlock: document.getElementById("comment-math-block-template") as HTMLTemplateElement,
		footer: document.getElementById("comment-footer-template") as HTMLTemplateElement,
	}

	for (const comment of discussion.comments.nodes)
	{
		const commentElems = CreateComment(templates, commentTemplate, comment)
		commentState.commentsParent.insertBefore(commentElems.fragment, commentState.newComment)

		// Input
		{
			const commentTextArea = commentElems.input.querySelector("textarea")!
			commentTextArea.addEventListener("input", UpdateInputHeight, { passive: true })

			// TODO: Put text in HTML and swap visibility
			const commentSubmit = commentElems.input.querySelector(".comment-submit") as HTMLElement
			//commentSubmit.innerText = "Reply"

			const commentLogout = commentElems.input.querySelector(".comment-logout") as HTMLElement
			//commentLogout.style.display = "none"
		}

		// Replies
		if (comment.replies.nodes.length)
		{
			const repliesParent = document.createElement("section")
			repliesParent.classList.add("comment-replies")
			commentElems.root.insertBefore(repliesParent, commentElems.input)

			const repliesLine = document.createElement("div")
			repliesLine.classList.add("reply-line")
			repliesParent.prepend(repliesLine)

			for (const reply of comment.replies.nodes)
			{
				const replyElems = CreateComment(templates, replyTemplate, reply)
				repliesParent.append(replyElems.fragment)
			}
		}
	}

	const commentTextArea = commentState.commentsParent.querySelector(".comment-input textarea")!
	commentTextArea.addEventListener("input", UpdateInputHeight, { passive: true })

	//const submitButtons = commentState.commentsParent.querySelectorAll(".comment-submit")
	//for (const submitButton of submitButtons)
		//submitButton.addEventListener("click", SubmitComment, { passive: true })
}

interface ICommentElements
{
	fragment: DocumentFragment
	root: HTMLElement
	input: HTMLElement
}

function CreateComment(templates: CommentTemplates, commentTemplate: HTMLTemplateElement, comment: ICommentBase): ICommentElements
{
	const commentFragment = commentTemplate.content.cloneNode(true) as DocumentFragment
	const commentRoot = commentFragment.querySelector("section")!
	const replyInput = commentFragment.querySelector(".reply-input") as HTMLElement
	const commentContent = commentFragment.querySelector(".comment-content") as HTMLElement
	commentContent.innerHTML = comment.bodyHTML

	// Header
	{
		const headerFragment = templates.header.content.cloneNode(true) as DocumentFragment

		const aAvatar = headerFragment.querySelector(".comment-avatar") as HTMLAnchorElement
		aAvatar.href = comment.author.url
		aAvatar.append(comment.author.login)

		const img = aAvatar.querySelector("img")!
		const url = new URL(comment.author.avatarUrl)
		url.searchParams.append("size", (2 * img.width).toString())
		img.src = url.toString()
		img.style.display = "inline"

		const aTime = headerFragment.querySelector(".comment-time") as HTMLAnchorElement
		aTime.href = comment.url

		const time = aTime.querySelector("time")!
		time.dateTime = comment.createdAt
		const date = new Date(comment.createdAt)
		const formatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" })
		time.innerText = formatter.format(date)

		commentRoot.prepend(headerFragment)
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

		const blockCodes = commentContent.querySelectorAll("div.highlight")
		for (const codeDiv of blockCodes)
			ConstructCodeBlock(codeDiv, codeDiv)

		const blockCodesNoLang = commentContent.querySelectorAll("div.snippet-clipboard-content")
		for (const codeDiv of blockCodesNoLang)
		{
			const code = codeDiv.querySelector("pre > code")
			if (code)
				ConstructCodeBlock(codeDiv, code)
		}
	}

	// Math
	{
		const inlineMaths = commentContent.querySelectorAll(".js-inline-math") as NodeListOf<HTMLElement>
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

		const displayMaths = commentContent.querySelectorAll(".js-display-math") as NodeListOf<HTMLElement>
		for (const ghMath of displayMaths)
		{
			const mathFragment = templates.mathBlock.content.cloneNode(true) as DocumentFragment

			const annotation = mathFragment.querySelector("annotation")!
			let latex = ghMath.textContent!
			latex = latex.replace(/^\$\$\s*|\s*\$\$$/gm, "")
			annotation.textContent = latex

			const button = mathFragment.querySelector("button")!
			AttachCopyFunction(button, CopyMath)

			ghMath.parentElement!.replaceChild(mathFragment, ghMath)
		}
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
			const data = comment.reactionGroups.find(r => r.content == key)!
			if (data.viewerHasReacted)
				reaction.toggleAttribute("data-pressed")
			UpdateReactionVisibility(reaction, false, data.users.totalCount)

			reaction.addEventListener("click", ToggleReaction, { passive: true })
		}

		commentRoot.insertBefore(footerFragment, replyInput)
	}

	return {
		fragment: commentFragment,
		root: commentRoot,
		input: replyInput,
	}
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

function ToggleReaction(e: Event)
{
	const reaction = e.currentTarget as HTMLButtonElement
	const reactionsDiv = reaction.parentElement!.parentElement!
	const reactionsButton = reactionsDiv.querySelector(".comment-toggle-reactions") as HTMLButtonElement
	const showReactions = reactionsButton.hasAttribute("data-pressed")
	const countOffset = reaction.toggleAttribute("data-pressed") ? 1 : -1
	UpdateReactionVisibility(reaction, showReactions, countOffset)
}

function UpdateReactionVisibility(reaction: HTMLButtonElement, showReactions: boolean, countOffset: number)
{
	const countSpan = reaction.querySelector(".comment-reaction-count") as HTMLSpanElement
	const count = parseInt(countSpan.innerText) + countOffset
	countSpan.innerText = count.toString()

	const visible = showReactions || count != 0
	if (reaction.hasAttribute("data-visible") != visible)
	{
		reaction.disabled = !visible
		reaction.toggleAttribute("data-visible")
	}
}

function UpdateInputHeight(e: Event)
{
	const commentTextArea = e.currentTarget as HTMLTextAreaElement

	const oldHeight = commentTextArea.clientHeight
	commentTextArea.style.height = "auto"

	const newHeightRect = commentTextArea.getClientRects()[0].height
	const newHeightScroll = commentTextArea.scrollHeight
	const newHeight = Math.abs(newHeightRect - newHeightScroll) < 1 ? newHeightRect : newHeightScroll
	commentTextArea.style.height = `${oldHeight}px`

	const reflow = commentTextArea.scrollHeight
	commentTextArea.style.height = `${newHeight}px`

	requestAnimationFrame(() => commentTextArea.scrollTop = 0)

	if (commentTextArea.selectionEnd
		&& commentTextArea.selectionEnd == commentTextArea.selectionStart
		&& commentTextArea.selectionEnd == commentTextArea.textLength)
	{
		const threshold = 0.15
		const height    = document.documentElement.clientHeight
		const y         = commentTextArea.getBoundingClientRect().bottom
		const target    = (1 - threshold) * height
		if (y > target)
			window.scrollBy({ top: y - target, behavior: "instant" })
	}
}

async function SubmitComment()
{
}

// -------------------------------------------------------------------------------------------------
// Initialization

async function Initialize()
{
	InitFeatures()
	InitTheme()
	InitImages()
	InitCode()
	await InitComments()
}

document.readyState !== "complete"
	? window.addEventListener("load", Initialize, { passive: true })
	: Initialize()
