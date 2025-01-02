import { VercelRequest } from "@vercel/node"
import { VercelResponse } from "@vercel/node"

declare const process:
{
	env:
	{
		CLIENT_ID?: string
		CLIENT_SECRET?: string
		PRIVATE_KEY?: string
	}
}

// TODO: Add app url (saves >300 ms)
interface ISession
{
	userAuth?: IUserAuth
}

interface IContext
{
	response:     VercelResponse
	updateCookie: boolean
	devRequest:   boolean
	session:      ISession
}

interface IDiscussionParams
{
	owner:    string
	repo:     string
	category: string
	page:     string
	origin:   string
}

export default async function handler(request: VercelRequest, response: VercelResponse)
{
	// NOTE: Unhandled failure modes:
	// * Large requests  - limited to 4.5 MB or 4 MB, depdending on runtime
	// * Time outs       - limited to 10s or 25s, depending on runtime

	const ctx = {
		response,
		updateCookie: false,
		devRequest: false,
		session: {},
	} as IContext

	try
	{
		console.log(`\n${request.method}\n${request.url}`)
		console.time("Total")

		if (!process.env.CLIENT_ID)     throw "Client Id not set"
		if (!process.env.CLIENT_SECRET) throw "Client Secret not set"
		if (!process.env.PRIVATE_KEY)   throw "Private Key not set"

		const prodOrigin  = "https://akbyrd.dev"
		const devOrigins  = ["https://localhost:1313", "https://192.168.0.106:1313" ]
		const prodRequest = request.headers.origin == prodOrigin
		const devRequest  = devOrigins.includes(request.headers.origin || "")
		if (prodRequest || devRequest)
		{
			const devExtra = devRequest ? ", x-vercel-protection-bypass, x-vercel-set-bypass-cookie" : ""
			response.setHeader("access-control-allow-credentials", "true")
			response.setHeader("access-control-allow-headers",     `credentials${devExtra}`)
			response.setHeader("access-control-allow-origin",      request.headers.origin!)
			response.setHeader("vary",                             "origin")
		}

		if (request.method == "OPTIONS")
			return response.status(204).send(null)

		ctx.devRequest = devRequest
		ctx.session = DecryptSession(request.cookies.session)

		const url = new URL(request.url || "", `http://${request.headers.host}`);
		switch (url.pathname)
		{
			default:
			{
				throw { statusCode: 404, body: {} }
			}

			case "/":
			{
				return response.status(200).json({ message: "hello" })
			}

			case "/login":
			{
				const code  = Validate(400, request.query, "code")
				const state = Validate(400, request.query, "state")

				ctx.devRequest ||= devOrigins.includes(new URL(state).origin)
				await GetUserAuth(ctx, code)

				UpdateCookie(ctx)
				return response.status(302).redirect(state)
			}

			case "/logout":
			{
				ctx.updateCookie = true
				ctx.session.userAuth = undefined

				UpdateCookie(ctx)
				return response.status(204).send(null)
			}

			case "/discussion":
			{
				const params = {
					origin:   Validate(400, request.headers, "origin"),
					owner:    Validate(400, request.query,   "owner"),
					repo:     Validate(400, request.query,   "repo"),
					category: Validate(400, request.query,   "category"),
					page:     Validate(400, request.query,   "page"),
				}

				if (ctx.session.userAuth)
				{
					const result = await GetUserDiscussion(ctx, params)
					if (result.success)
					{
						UpdateCookie(ctx)
						return response.status(200).json(result.json)
					}

					console.log("Failed to get user discussion")
					console.dir(result.json, { depth: null })
				}

				const token      = await CreateJWT()
				const appAuthUrl = await GetAppAuthUrl(token, params.owner, params.repo)
				const appAuth    = await GetAppAuth(token, appAuthUrl)
				const discussion = await GetAppDiscussion(appAuth, params)

				//UpdateCookie(ctx)
				return response.status(200).json(discussion)
			}

			case "/react":
			{
				const subjectId = Validate(400, request.query,   "subjectId")
				const reaction  = Validate(400, request.query,   "reaction")
				const add       = Validate(400, request.query,   "add")

				if (!ctx.session.userAuth) throw { statusCode: 401, body: { error: "Invalid session" } }

				await SetReaction(ctx, subjectId, reaction, add)

				UpdateCookie(ctx)
				return response.status(204).send(null)
			}
		}
	}
	catch (error: any)
	{
		if (error instanceof Object && error.statusCode && error.body)
		{
			const status = error.statusCode as number

			UpdateCookie(ctx)
			return response.status(status).json(error.body)
		}
		else
		{
			console.dir(error, { depth: null })

			UpdateCookie(ctx)
			return response.status(500).json({ error: "Application error" })
		}
	}
	finally
	{
		console.timeEnd("Total")
	}
}

function UpdateCookie(ctx: IContext)
{
	if (ctx.updateCookie)
	{
		const sessionStr = EncryptSession(ctx.session)
		const expires    = ctx.session.userAuth ? ctx.session.userAuth.refreshExp * 1000 : 0
		const expiresStr = new Date(expires).toUTCString()
		const sameSite   = ctx.devRequest ? "None" : "Strict"
		const cookie     = `session=${sessionStr}; Expires=${expiresStr}; SameSite=${sameSite}; Secure; HttpOnly`
		ctx.response.setHeader("set-cookie", cookie)
	}
}

// -------------------------------------------------------------------------------------------------
// Session Management

function EncryptSession(session: ISession): string
{
	const sessionStr = btoa(JSON.stringify(session))
	return sessionStr
}

function DecryptSession(sessionStr: string): ISession
{
	try
	{
		const session = JSON.parse(atob(sessionStr))
		if (!session.userAuth) return {}
		if (!session.userAuth.token) return {}
		if (!session.userAuth.tokenExp) return {}
		if (!session.userAuth.refresh) return {}
		if (!session.userAuth.refreshExp) return {}
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

	const key_b64 = b64tobytes(process.env.PRIVATE_KEY!)
	const alg = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256", }
	const key = await crypto.subtle.importKey("pkcs8", key_b64, alg, false, ["sign"])

	const now = Math.floor(Date.now() / 1000) - 60
	const header_b64 = objtob64({ alg: "RS256", typ: "JWT", })
	const payload_b64 = objtob64({ iat: now, exp: now + 300, iss: process.env.CLIENT_ID!, })
	const message_bytes = strtobytes(`${header_b64}.${payload_b64}`)

	const signature_bytes = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, message_bytes)
	const signature_b64 = bytestob64(signature_bytes)

	const token = `${header_b64}.${payload_b64}.${signature_b64}`
	return token
}

async function GetAppAuthUrl(token: string, owner: string, repo: string): Promise<string>
{
	const result = await RESTRequest(GetAppAuthUrl.name, token, "GET", `https://api.github.com/repos/${owner}/${repo}/installation`)
	if (!result.success) throw result.json

	return result.json.access_tokens_url
}

async function GetAppAuth(token: string, appAuthUrl: string): Promise<IAuth>
{
	const result = await RESTRequest(GetAppAuth.name, token, "POST", appAuthUrl)
	if (!result.success) throw result.json

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

	const result = await RESTRequest(GetUserAuth.name, "", "POST", url.toString())
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

		const result = await RESTRequest(RefreshUserAuth.name, "", "POST", url.toString())
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

const discussionQueryData =
	`bodyHTML
	comments(first: 100) {
		nodes {
			id
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
			}
		}
	}
	reactionGroups {
		content
		viewerHasReacted
		users {
			totalCount
		}
	}`

interface IDiscussion
{
	loggedIn: boolean
}

async function GetAppDiscussion(auth: IAuth, ctx: IDiscussionParams): Promise<IDiscussion>
{
	const result = await GetDiscussion(auth, ctx, false)
	if (!result.success) throw result.json

	const discussion = result.json
	return discussion
}

async function GetUserDiscussion(ctx: IContext, params: IDiscussionParams): Promise<FetchResult<IDiscussion>>
{
	let result

	result = await RefreshUserAuth(ctx, false)
	if (!result.success) return result as FetchResult<IDiscussion>

	result = await GetDiscussion(ctx.session.userAuth!, params, true)
	if (result.success) return result

	// TODO: Should only return if the error is a token expiration error
	result = await RefreshUserAuth(ctx, true)
	if (!result.success) return result as FetchResult<IDiscussion>

	result = await GetDiscussion(ctx.session.userAuth!, params, true)
	return result
}

async function GetDiscussion(auth: IAuth, params: IDiscussionParams, loggedIn: boolean): Promise<FetchResult<IDiscussion>>
{
	const title = params.page.replace(/^\/?|\/?$/g, "")
	const searchQuery = `repo:${params.owner}/${params.repo} in:title ${title}`
	const result = await GraphQLRequest(GetDiscussion.name, auth,
		`query($query: String!) {
			search(type: DISCUSSION, query: $query, first: 2) {
				discussionCount
				nodes {
					... on Discussion {
						${discussionQueryData}
					}
				}
			}
		}`, { query: searchQuery })

	if (!result.success) return result as FetchResult<IDiscussion>

	let discussion = null as IDiscussion | null
	const discussions = result.json.data.search.nodes
	switch (discussions.length)
	{
		case 0:
		{
			const [repoId, categoryId] = await GetRepoAndCategoryIds(auth, params.owner, params.repo, params.category)
			discussion = await CreateDiscussion(auth, repoId, categoryId, title, params.page, params.origin)
			discussion.loggedIn = loggedIn
			result.json = discussion
			break
		}

		case 1:
			discussion = discussions[0] as IDiscussion
			discussion.loggedIn = loggedIn
			result.json = discussion
			break

		default:
			throw { statusCode: 500, body: { error: "Failed to find discussion" } }
	}

	return result as FetchResult<IDiscussion>
}

async function GetRepoAndCategoryIds(auth: IAuth, owner: string, repo: string, category: string)
{
	const result = await GraphQLRequest(GetRepoAndCategoryIds.name, auth,
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
	return [result.json.data.repository.id, categoryNode.id]
}

async function CreateDiscussion(auth: IAuth, repoId: string, categoryId: string, title: string, page: string, origin: string): Promise<IDiscussion>
{
	if (origin.includes("localhost"))
		throw { statusCode: 400, body: { error: "Creating discussions from localhost is disabled" } }

	const body = origin ? new URL(page, origin).toString() : ""
	const result = await GraphQLRequest(CreateDiscussion.name, auth,
		`mutation {
			createDiscussion(input: {repositoryId: "${repoId}", categoryId: "${categoryId}", body: "${body}", title: "${title}"}) {
				discussion {
					${discussionQueryData}
				}
			}
		}`)

	if (!result.success) throw result.json

	if (result.json.extensions && result.json.extensions.warnings)
		console.log(result.json.extensions.warnings)

	return result.json.data.createDiscussion.discussion as IDiscussion
}

// -------------------------------------------------------------------------------------------------
// Mutations

// TODO: Test this with an expired user token (i.e. test the refresh flow)
async function SetReaction(ctx: IContext, subjectId: string, reaction: string, add: string)
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

	result = await GraphQLRequest(SetReaction.name, ctx.session.userAuth!, mutation)
	if (result.success) return
	if (result.json.data[op].clientMutationId != mutationId) throw result.json

	// TODO: Should only return if the error is a token expiration error
	result = await RefreshUserAuth(ctx, true)
	if (!result.success) throw result.json

	result = await GraphQLRequest(SetReaction.name, ctx.session.userAuth!, mutation)
	if (!result.success) throw result.json
	if (result.json.data[op].clientMutationId != mutationId) throw result.json
}

// -------------------------------------------------------------------------------------------------
// Utilities

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

function Validate(statusCode: number, obj: any, key: string)
{
	if (!obj[key])
		throw { statusCode, body: { error: `${key} not specified` } }
	return obj[key]
}

function strtobytes(s: string): ArrayBuffer
{
	const buf = new ArrayBuffer(s.length)
	const view = new Uint8Array(buf)

	for (let i = 0; i < s.length; i++)
		view[i] = s.charCodeAt(i)

	return buf
}

function b64tobytes(str: string): ArrayBuffer
{
	const binary = atob(str)
	const buf = new ArrayBuffer(binary.length)
	const view = new Uint8Array(buf)

	for (let i = 0; i < binary.length; i++)
		view[i] = binary.charCodeAt(i)

	return buf
}

function bytestob64(buf: ArrayBuffer): string
{
	const view = new Uint8Array(buf)
	const str = String.fromCharCode(...view)
	const b64 = strtob64(str)
	return b64
}

function strtob64(str: string): string
{
	str = btoa(str)
	str = str.replace(/=/g, "")
	str = str.replace(/\+/g, "-")
	str = str.replace(/\//g, "_")
	return str
}

function objtob64(obj: any): string
{
	const json = JSON.stringify(obj)
	return strtob64(json)
}
