declare const process:
{
	env:
	{
		CLIENT_ID?: string
		CLIENT_SECRET?: string
		PRIVATE_KEY?: string
		ENCRYPTION_KEY?: string
	}
}

interface ISession
{
	userAuth?: IUserAuth
	appAuthUrl?: string
}

interface IContext
{
	updateCookie:  boolean
	devRequest:    boolean
	redirect?:     string
	session:       ISession
	encryptionKey: CryptoKey
}

type RequestEx = Request &
{
	urlEx:     URL
	cookies:   Record<string, string>
	headersEx: Record<string, string>
	params:    Record<string, string>
	bodyEx:    Record<string, string>
}

class ResponseEx
{
	headers = new Headers()

	async send(ctx: IContext, status: number, body?: {}): Promise<Response>
	{
		await this.updateCookie(ctx)
		this.headers.set("content-type", "application/json")
		return new Response(JSON.stringify(body), {
			status,
			headers: this.headers,
		})
	}

	async redirect(ctx: IContext, status: number, url: string | URL): Promise<Response>
	{
		await this.updateCookie(ctx)
		this.headers.set("location", url.toString())
		return new Response(null, {
			status,
			headers: this.headers,
		})
	}

	async updateCookie(ctx: IContext): Promise<void>
	{
		if (ctx.session.userAuth)
		{
			this.headers.set("access-control-expose-headers", "x-authenticated")
			this.headers.set("x-authenticated", "1")
		}

		if (ctx.updateCookie)
		{
			const sessionStr = await EncryptSession(ctx, ctx.session)
			const userExp    = ctx.session.userAuth ? ctx.session.userAuth.refreshExp * 1000 : 0
			const appExp     = Date.now() + 6 * 30 * 24 * 60 * 60 * 1000 // 6 months
			const expiresStr = new Date(Math.max(userExp, appExp)).toUTCString()
			const sameSite   = ctx.devRequest ? "None" : "Strict"
			const cookie     = `session=${sessionStr}; Expires=${expiresStr}; SameSite=${sameSite}; Secure; HttpOnly`
			this.headers.set("set-cookie", cookie)
		}
	}
}

export const config = {
	runtime: "edge",
}

// TODO: Atone for my sins and rewrite this entire file
export default async function handler(_request: Request): Promise<Response>
{
	// NOTE: Unhandled failure modes:
	// * Large requests - limited to 4.5 MB or 4 MB, depdending on runtime
	// * Time outs      - limited to 10s or 25s, depending on runtime

	const response = new ResponseEx()
	const ctx: IContext = {
		updateCookie:  false,
		devRequest:    false,
		session:       {},
		encryptionKey: CryptoKey.prototype,
	}

	try
	{
		const url = new URL(_request.url)
		const request: RequestEx = Object.assign(_request, {
			urlEx:     url,
			params:    Object.fromEntries(url.searchParams.entries()),
			cookies:   Object.fromEntries((_request.headers.get("cookie") || "").split(";").map(c => c.split("="))),
			headersEx: Object.fromEntries(_request.headers.entries()),
			bodyEx:   ["GET", "HEAD"].includes(_request.method) ? {} : await _request.json(),
		})

		console.time("Total")
		console.log(`\n${request.method}\n${request.url}`)
		console.dir(request.bodyEx)

		if (!process.env.CLIENT_ID)      throw "Client Id not set"
		if (!process.env.CLIENT_SECRET)  throw "Client Secret not set"
		if (!process.env.PRIVATE_KEY)    throw "Private Key not set"
		if (!process.env.ENCRYPTION_KEY) throw "Encryption Key not set"

		const prodOrigin  = "https://akbyrd.dev"
		const devOrigins  = ["https://localhost:1313", "https://192.168.0.106:1313"]
		const prodRequest = request.headersEx.origin == prodOrigin
		const devRequest  = devOrigins.includes(request.headersEx.origin || "")
		if (prodRequest || devRequest)
		{
			const devExtra = devRequest ? ", x-vercel-protection-bypass, x-vercel-set-bypass-cookie" : ""
			response.headers.set("access-control-allow-credentials", "true")
			response.headers.set("access-control-allow-headers",     `credentials${devExtra}`)
			response.headers.set("access-control-allow-origin",      request.headersEx.origin)
			response.headers.set("vary",                             "origin")
		}

		if (request.method == "OPTIONS")
			return response.send(ctx, 204)

		ctx.devRequest    = devRequest
		ctx.encryptionKey = await ImportEncryptionKey()
		ctx.session       = await DecryptSession(ctx, request.cookies.session)

		switch (request.urlEx.pathname)
		{
			default:
			{
				throw { statusCode: 404 }
			}

			case "/":
			{
				return response.send(ctx, 200, { message: "hello" })
			}

			case "/login":
			{
				ctx.redirect = Validate(400, request.params, "state")
				const code   = Validate(400, request.params, "code")

				ctx.devRequest ||= devOrigins.includes(new URL(ctx.redirect!).origin)
				await GetUserAuth(ctx, code)
				return response.redirect(ctx, 302, ctx.redirect!)
			}

			case "/logout":
			{
				ctx.updateCookie = true
				ctx.session.userAuth = undefined
				return response.send(ctx, 204)
			}

			case "/discussion":
			{
				const params = {
					owner:    Validate(400, request.bodyEx, "owner"),
					repo:     Validate(400, request.bodyEx, "repo"),
					category: Validate(400, request.bodyEx, "category"),
					page:     Validate(400, request.bodyEx, "page"),
				}

				if (ctx.session.userAuth)
				{
					const result = await GetUserDiscussion(ctx, params)
					if (result.success)
						return response.send(ctx, 200, result.json)
				}

				const appAuth    = await GetAppAuth(ctx, params.owner, params.repo)
				const discussion = await GetAppDiscussion(appAuth, params)
				return response.send(ctx, 200, discussion)
			}

			case "/comment":
			{
				const params = {
					_:            Validate(401, ctx.session,       "userAuth"),
					origin:       Validate(400, request.headersEx, "origin"),
					host:         Validate(400, request.headersEx, "host"),
					page:         Validate(400, request.bodyEx,    "page"),
					owner:        Validate(400, request.bodyEx,    "owner"),
					repo:         Validate(400, request.bodyEx,    "repo"),
					category:     Validate(400, request.bodyEx,    "category"),
					content:      Validate(400, request.bodyEx,    "content"),
					discussionId: request.bodyEx.discussionId,
					commentId:    request.bodyEx.commentId,
				} as ICommentParams

				if (!params.discussionId)
				{
					const result = await GetUserDiscussion(ctx, params)
					if (result.success && result.json.id)
					{
						const discussion = result.json as IDiscussion
						params.discussionId = discussion.id

						const comment = await AddComment(ctx, params)
						discussion.comments.nodes.push(comment)
						return response.send(ctx, 200, discussion)
					}
					else
					{
						const appAuth    = await GetAppAuth(ctx, params.owner, params.repo)
						const discussion = await CreateDiscussion(ctx, appAuth, params)
						params.discussionId = discussion.id

						const comment = await AddComment(ctx, params)
						discussion.comments.nodes.push(comment)
						return response.send(ctx, 200, discussion)
					}
				}
				else
				{
					const comment = await AddComment(ctx, params)
					return response.send(ctx, 200, comment)
				}
			}

			case "/react":
			{
				const params = {
					_:         Validate(401, ctx.session,    "userAuth"),
					subjectId: Validate(400, request.bodyEx, "subjectId"),
					reaction:  Validate(400, request.bodyEx, "reaction"),
					add:       Validate(400, request.bodyEx, "add"),
				}

				await SetReaction(ctx, params.subjectId, params.reaction, params.add)
				return response.send(ctx, 204)
			}
		}
	}
	catch (error: any)
	{
		if (error instanceof Object && error.statusCode)
		{
			const status = error.statusCode as number

			if (ctx.redirect)
				return response.redirect(ctx, 302, ctx.redirect)
			return response.send(ctx, status, error.body)
		}
		else
		{
			console.dir(error, { depth: null })

			if (ctx.redirect)
				return response.redirect(ctx, 302, ctx.redirect)
			return response.send(ctx, 500)
		}
	}
	finally
	{
		console.timeEnd("Total")
	}
}

// -------------------------------------------------------------------------------------------------
// Session Management

async function ImportEncryptionKey(): Promise<CryptoKey>
{
	const key_bytes = strtobytes(atob(process.env.ENCRYPTION_KEY!))
	const key       = await crypto.subtle.importKey("raw", key_bytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"])
	return key
}

async function EncryptSession(ctx: IContext, session: ISession): Promise<string>
{
	const payload = strtobytes(JSON.stringify(session))
	const iv      = crypto.getRandomValues(new Uint8Array(12))
	const bytes   = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, ctx.encryptionKey, payload)

	const iv_bytes = new Uint8Array(iv.length + bytes.byteLength)
	iv_bytes.set(iv, 0)
	iv_bytes.set(new Uint8Array(bytes), iv.length)

	const sessionStr = btoa(bytestostr(iv_bytes))
	return sessionStr
}

async function DecryptSession(ctx: IContext, sessionStr: string): Promise<ISession>
{
	try
	{
		const iv_bytes = strtobytes(atob(sessionStr))
		const iv       = iv_bytes.slice(0, 12)
		const bytes    = iv_bytes.slice(12)

		const payload = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, ctx.encryptionKey, bytes)
		const session = JSON.parse(bytestostr(payload))
		return session
	}
	catch
	{
		return {}
	}
}

// -------------------------------------------------------------------------------------------------
// App Authorization

interface IAuth
{
	token: string
	tokenExp: number
}

async function CreateJWT(): Promise<string>
{
	// NOTE: Should really cache this token, but since we run this as a serverless function we don't
	// have a good way to do so. We could include it in the encrypted session data we store on the
	// client, but
	// 1. It has a relatively short lifespan.
	// 2. Different clients will have different tokens.
	//
	// Thus, it would only help for a single client hammering comments. We can share a token for
	// multiple calls from the same user, but not between calls from multiple users. (Multiple JWTs
	// can be in use at once.) Since comments lazily load it's somewhat hard for users to hammer
	// them.

	const key_bytes = strtobytes(atob(process.env.PRIVATE_KEY!))
	const key_alg   = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256", }
	const key       = await crypto.subtle.importKey("pkcs8", key_bytes, key_alg, false, ["sign"])

	const now           = Math.floor(Date.now() / 1000) - 60
	const header_b64    = btoa(JSON.stringify(({ alg: "RS256", typ: "JWT" })))
	const payload_b64   = btoa(JSON.stringify(({ iat: now, exp: now + 300, iss: process.env.CLIENT_ID! })))
	const message_bytes = strtobytes(`${header_b64}.${payload_b64}`)

	const signature_bytes = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, message_bytes)
	const signature_b64   = btoa(bytestostr(signature_bytes))

	const token = `${header_b64}.${payload_b64}.${signature_b64}`
	return token
}

async function GetAppAuthUrl(token: string, owner: string, repo: string): Promise<string>
{
	const result = await RESTRequest("GetAppAuthUrl", token, "GET", `https://api.github.com/repos/${owner}/${repo}/installation`)
	if (!result.success) throw result.json

	return result.json.access_tokens_url
}

async function GetAppAuth(ctx: IContext, owner: string, repo: string): Promise<IAuth>
{
	const token = await CreateJWT()

	let result
	if (ctx.session.appAuthUrl)
		result = await RESTRequest("GetAppAuth", token, "POST", ctx.session.appAuthUrl)

	if (!result || !result.success)
	{
		ctx.updateCookie = true
		ctx.session.appAuthUrl = undefined
		ctx.session.appAuthUrl = await GetAppAuthUrl(token, owner, repo)

		result = await RESTRequest("GetAppAuth", token, "POST", ctx.session.appAuthUrl)
		if (!result.success) throw result.json
	}

	return {
		token:    result.json.token,
		tokenExp: result.json.expires_at,
	}
}

// -------------------------------------------------------------------------------------------------
// User Authorization

interface IUserAuth extends IAuth
{
	refresh:    string
	refreshExp: number
}

function ParseUserAuth(json: any): IUserAuth
{
	const now = Math.floor(Date.now() / 1000)
	const auth = {
		token:      json.access_token,
		tokenExp:   now + Number(json.expires_in),
		refresh:    json.refresh_token,
		refreshExp: now + Number(json.refresh_token_expires_in),
	}
	if (Number.isNaN(auth.tokenExp))   throw "Failed to parse user token expiration"
	if (Number.isNaN(auth.refreshExp)) throw "Failed to parse user token refresh expiration"
	return auth
}

async function GetUserAuth(ctx: IContext, code: string)
{
	const url = new URL("https://github.com/login/oauth/access_token")
	url.searchParams.append("client_id", process.env.CLIENT_ID!)
	url.searchParams.append("client_secret", process.env.CLIENT_SECRET!)
	url.searchParams.append("code", code)

	ctx.updateCookie = true
	ctx.session.userAuth = undefined

	const result = await RESTRequest("GetUserAuth", "", "POST", url.toString())
	if (!result.success) throw result.json

	ctx.session.userAuth = ParseUserAuth(result.json)
}

async function RefreshUserAuth(ctx: IContext, force: boolean = false): Promise<FetchResult>
{
	const now     = Math.floor(Date.now() / 1000) + 60
	const expired = now >= ctx.session.userAuth!.tokenExp

	if (expired || force)
	{
		const url = new URL("https://github.com/login/oauth/access_token")
		url.searchParams.append("client_id", process.env.CLIENT_ID!)
		url.searchParams.append("client_secret", process.env.CLIENT_SECRET!)
		url.searchParams.append("grant_type", "refresh_token")
		url.searchParams.append("refresh_token", ctx.session.userAuth!.refresh)

		ctx.updateCookie = true
		ctx.session.userAuth = undefined

		const result = await RESTRequest("RefreshUserAuth", "", "POST", url.toString())

		if (!result.success && result.json.error == "bad_refresh_token") return result
		if (!result.success) throw result.json

		ctx.session.userAuth = ParseUserAuth(result.json)
	}

	return {
		success: true,
		response: new Response(null, { status: 204 }),
		json: {},
	}
}

// -------------------------------------------------------------------------------------------------
// Discussion Query

const commentQueryData =
	`id
	bodyHTML
	createdAt
	url
	author {
		login
		avatarUrl
		url
	}
	reactionGroups {
		content
		viewerHasReacted
		users {
			totalCount
		}
	}
	replies(first: 100) {
		nodes {
			id
			bodyHTML
			createdAt
			url
			author {
				avatarUrl
				login
				url
			}
			reactionGroups {
				content
				viewerHasReacted
				users {
					totalCount
				}
			}
		}
	}`

interface IDiscussion
{
	id: string
	createdAt: string
	comments: { nodes: IComment[] }
}

interface IDiscussionParams
{
	owner:    string
	repo:     string
	category: string
	page:     string
}

async function GetAppDiscussion(auth: IAuth, ctx: IDiscussionParams): Promise<IDiscussion>
{
	const result = await GetDiscussion(auth, ctx)
	if (!result.success) throw result.json

	const discussion = result.json
	return discussion
}

async function GetUserDiscussion(ctx: IContext, params: IDiscussionParams): Promise<FetchResult<IDiscussion>>
{
	let result

	result = await RefreshUserAuth(ctx, false)
	if (!result.success) return result as FetchResult<IDiscussion>

	result = await GetDiscussion(ctx.session.userAuth!, params)
	if (!ValidateUserAuth(ctx, result.response, false)) return result
	if (result.success) return result

	// TODO: Should only return if the error is a token expiration error
	result = await RefreshUserAuth(ctx, true)
	if (!result.success) return result as FetchResult<IDiscussion>

	result = await GetDiscussion(ctx.session.userAuth!, params)
	if (!ValidateUserAuth(ctx, result.response, false)) return result
	return result
}

async function GetDiscussion(auth: IAuth, params: IDiscussionParams): Promise<FetchResult<IDiscussion>>
{
	const title = params.page.replace(/^\/?|\/?$/g, "")
	const result = await GraphQLRequest("GetDiscussion", auth,
		`query {
			search(type: DISCUSSION, query: "repo:${params.owner}/${params.repo} in:title ${title}", first: 2) {
				discussionCount
				nodes {
					... on Discussion {
						id
						createdAt
						comments(first: 100) {
							nodes {
								${commentQueryData}
							}
						}
					}
				}
			}
		}`)

	if (!result.success) return result as FetchResult<IDiscussion>

	let discussion = null as IDiscussion | null
	const discussions = result.json.data.search.nodes as IDiscussion[]
	if (discussions.length)
	{
		const created = discussions.map(d => new Date(d.createdAt))
		const iOldest = created.reduce<number>((p, c, i) => created[i] < created[p] ? i : p, 0)

		discussion = discussions[iOldest]
		result.json = discussion
	}
	else
	{
		result.json = {
			id: "",
			comments: { nodes: [] }
		}
	}

	return result as FetchResult<IDiscussion>
}

// -------------------------------------------------------------------------------------------------
// Mutations

// TODO: Should I hard-code these?
interface IDiscussionIds
{
	repo: string
	category: string
}

async function GetDiscussionIds(auth: IAuth, owner: string, repo: string, category: string): Promise<IDiscussionIds>
{
	const result = await GraphQLRequest("GetDiscussionIds", auth,
		`query {
			repository(owner: "${owner}", name: "${repo}") {
				id
				discussionCategories(first: 100) {
					nodes {
						id
						name
					}
				}
			}
		}`)
	if (!result.success) throw result.json

	const categories = result.json.data.repository.discussionCategories.nodes as { id: string, name: string }[]
	const categoryNode = categories.find(c => c.name === category)
	if (!categoryNode) throw { statusCode: 400, body: { error: "Category not found" } }

	return {
		repo: result.json.data.repository.id,
		category: categoryNode.id,
	}
}

interface ICommentParams
{
	origin:       string
	host:         string
	page:         string
	owner:        string
	repo:         string
	category:     string
	discussionId: string
	commentId:    string
	content:      string
}

async function CreateDiscussion(ctx: IContext, auth: IAuth, params: ICommentParams): Promise<IDiscussion>
{
	// NOTE: Creating discussions is a race condition. Two people can post a comment at the same
	// time. Both instances of this API will see that no discussion exists and create a new one.
	// Github does not have a way to prevent duplicates or perform an atomic get-or-create operation.
	// The workaround here is not to return the created discussion, but to perform a search afterward
	// and take the oldest dicussion. This ensures both people will still see the same discussion,
	// and the duplicate will be ignored. If it ends up happening in practice this can be updated to
	// delete the duplicate.
	//
	// It's likely that Vercel would serialize multiple requests to the same running instance and
	// mostly avoid this issue, but it's not guaranteed and probably less likely when using the Edge
	// runtime.
	//
	// Additionally, we use app auth to create the discussion but we want to use user auth when
	// reading the data. Technically it doesn't matter because there won't be any content in a
	// freshly created discussion that the current user has reacted to (which is the only thing
	// that's different about being logged in).

	if (params.host.startsWith("localhost"))
		throw { statusCode: 400, body: { error: "Creating discussions from localhost is disabled" } }

	const ids = await GetDiscussionIds(auth, params.owner, params.repo, params.category)
	const body = new URL(params.page, params.origin).toString()
	const title = params.page.replace(/^\/?|\/?$/g, "")
	let result = await GraphQLRequest("CreateDiscussion", auth,
		`mutation {
			createDiscussion(input: {repositoryId: "${ids.repo}", categoryId: "${ids.category}", body: "${body}", title: "${title}"}) {
				discussion {
					id
				}
			}
		}`)
	if (!result.success) throw result.json

	if (result.json.extensions && result.json.extensions.warnings)
		console.log(result.json.extensions.warnings)

	// NOTE: It takes a while for the new discussion to show up in a query
	for (let i = 0; i < 10; i++)
	{
		const throttle = new Promise(r => setTimeout(r, 500))

		result = await GetUserDiscussion(ctx, params)
		ValidateUserAuth(ctx, result.response, true)
		if (!result.success) throw result.json
		if (result.json.id) break

		await throttle
	}
	if (!result!.json.id) throw result!.json

	const discussion = result!.json as IDiscussion
	return discussion
}

interface IComment {}

async function AddComment(ctx: IContext, params: ICommentParams): Promise<IComment>
{
	const replyTo = params.commentId ? `, replyToId: "${params.commentId}"` : ""
	const mutationId = crypto.randomUUID()
	const mutation =
		`mutation($content: String!) {
			addDiscussionComment(input: {clientMutationId: "${mutationId}", body: $content, discussionId: "${params.discussionId}"${replyTo}}) {
				clientMutationId
				comment {
					${commentQueryData}
				}
			}
		}`
	const variables = {
		content: params.content,
	}

	let result

	result = await RefreshUserAuth(ctx, false)
	if (!result.success) throw result.json

	result = await GraphQLRequest("AddComment", ctx.session.userAuth!, mutation, variables)
	if (result.success && result.json.data.addDiscussionComment.clientMutationId != mutationId) throw result.json
	ValidateUserAuth(ctx, result.response, true)
	if (result.success) return result.json.data.addDiscussionComment.comment as IComment

	result = await RefreshUserAuth(ctx, true)
	if (!result.success) throw result.json

	result = await GraphQLRequest("AddComment", ctx.session.userAuth!, mutation, variables)
	if (result.success && result.json.data.addDiscussionComment.clientMutationId != mutationId) throw result.json
	ValidateUserAuth(ctx, result.response, true)
	if (!result.success) throw result.json
	return result.json.data.addDiscussionComment.comment as IComment
}

async function SetReaction(ctx: IContext, subjectId: string, reaction: string, add: string): Promise<void>
{
	const mutationId = crypto.randomUUID()
	const op = add == "true" ? "addReaction" : "removeReaction"
	const mutation =
		`mutation {
			${op}(input: {clientMutationId: "${mutationId}", content: ${reaction}, subjectId: "${subjectId}"}) {
				clientMutationId
			}
		}`

	let result

	result = await RefreshUserAuth(ctx, false)
	if (!result.success) throw result.json

	result = await GraphQLRequest("SetReaction", ctx.session.userAuth!, mutation)
	if (result.success && result.json.data[op].clientMutationId != mutationId) throw result.json
	ValidateUserAuth(ctx, result.response, true)
	if (result.success) return

	result = await RefreshUserAuth(ctx, true)
	if (!result.success) throw result.json

	result = await GraphQLRequest("SetReaction", ctx.session.userAuth!, mutation)
	if (result.success && result.json.data[op].clientMutationId != mutationId) throw result.json
	ValidateUserAuth(ctx, result.response, true)
	if (!result.success) throw result.json
}

// -------------------------------------------------------------------------------------------------
// Utilities

function ValidateUserAuth(ctx: IContext, response: Response, fatal: boolean)
{
	if (response.status == 401)
	{
		ctx.updateCookie = true
		ctx.session.userAuth = undefined
		if (fatal) throw { statusCode: 401 }
		return false
	}
	return true
}

type FetchResult<T = Record<string, any>> = {
	success:  boolean,
	response: Response,
	json:     T
}

async function RESTRequest(name: string, token: string, method: string, url: string): Promise<FetchResult>
{
	console.time(name)
	try
	{
		const response = await fetch(url, {
			method,
			headers: {
				"Accept": "application/vnd.github+json",
				"Authorization": `Bearer ${token}`,
				"Content-Type": "application/json",
				"X-GitHub-Api-Version": "2022-11-28",
			},
		})

		const json = await response.json()
		const success = response.ok && !json.errors && !json.error
		return { success, response, json }
	}
	finally
	{
		console.timeEnd(name)
	}
}

async function GraphQLRequest(name: string, auth: IAuth, query: string, variables?: {}): Promise<FetchResult>
{
	console.time(name)
	try
	{
		const response = await fetch("https://api.github.com/graphql", {
			method: "POST",
			headers: {
				"Accept": "application/vnd.github+json",
				"Authorization": `Bearer ${auth.token}`,
				"Content-Type": "application/json",
				"X-GitHub-Api-Version": "2022-11-28",
				"X-Github-Next-Global-ID": "1",
			},
			body: JSON.stringify({
				query,
				variables,
			}),
		})

		const json = await response.json()
		const success = response.ok && !json.errors && !json.error
		return { success, response, json }
	}
	finally
	{
		console.timeEnd(name)
	}
}

function Validate(statusCode: number, obj: any, key: string): string
{
	if (!obj[key])
		throw { statusCode, body: { error: `${key} not specified` } }
	return obj[key]
}

function strtobytes(str: string): Uint8Array
{
	const bytes = new Uint8Array(str.length)
	for (let i = 0; i < str.length; i++)
		bytes[i] = str.charCodeAt(i)
	return bytes
}

function bytestostr(bytes: ArrayBufferLike): string
{
	const str = new TextDecoder("latin1").decode(bytes)
	return str
}
