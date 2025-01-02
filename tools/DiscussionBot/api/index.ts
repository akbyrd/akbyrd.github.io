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

interface ISession
{
	appUrl?: string
	userAuth?: IUserAuth
}

interface IDiscussionContext
{
	owner:    string
	repo:     string
	category: string
	page:     string
	origin:   string
}

// TODO: This whole file needs to be rewritten. It's a mess.
export default async function handler(request: VercelRequest, response: VercelResponse)
{

	// NOTE: Unhandled failure modes:
	// * Large requests  - limited to 4.5 MB or 4 MB, depdending on runtime
	// * Time outs       - limited to 10s or 25s, depending on runtime
	// * Invalid session - TODO

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

				const userAuth    = await GetUserAuth(code)
				const session     = EncryptSession({ userAuth })
				const expires     = new Date(userAuth.refreshExp * 1000).toUTCString()
				const devRedirect = devOrigins.includes(new URL(state).origin)
				const sameSite    = devRequest || devRedirect ? "None" : "Strict"
				const cookie      = `session=${session}; Expires=${expires}; SameSite=${sameSite}; Secure; HttpOnly`
				response.setHeader("set-cookie", cookie)

				return response.redirect(302, state)
			}

			case "/logout":
			{
				const sameSite = devRequest ? "None" : "Strict"
				const cookie   = `session=; Max-Age=0; SameSite=${sameSite}; Secure; HttpOnly`
				response.setHeader("set-cookie", cookie)

				return response.status(204).send(null)
			}

			case "/discussion":
			{
				const ctx = {
					origin:   Validate(400, request.headers, "origin"),
					owner:    Validate(400, request.query,   "owner"),
					repo:     Validate(400, request.query,   "repo"),
					category: Validate(400, request.query,   "category"),
					page:     Validate(400, request.query,   "page"),
				}

				const session = DecryptSession(request.cookies.session)
				if (session.userAuth)
				{
					const result = await GetUserDiscussion(session, ctx)
					if (result && result.success)
						return response.status(200).json(result.json)
				}

				const token      = await CreateJWT()
				const appAuthUrl = await GetAppAuthUrl(token, ctx.owner, ctx.repo)
				const appAuth    = await GetAppAuth(token, appAuthUrl)
				const discussion = await GetAppDiscussion(appAuth, ctx)

				return response.status(200).json(discussion)
			}

			case "/react":
			{
				const session_enc = Validate(400, request.cookies, "session")
				const subjectId   = Validate(400, request.query,   "subjectId")
				const reaction    = Validate(400, request.query,   "reaction")
				const add         = Validate(400, request.query,   "add")

				// TODO: Refresh user auth
				const session  = DecryptSession(session_enc)
				const userAuth = Validate(400, session, "userAuth")
				await SetReaction(userAuth, subjectId, reaction, add)

				return response.status(204).send(null)
			}
		}
	}
	catch (error: unknown)
	{
		if (error instanceof Object && "body" in error && "statusCode" in error)
		{
			const status = error.statusCode as number
			return response.status(status).json(error.body)
		}
		else
		{
			console.dir(error, { depth: null })
			return response.status(500).json({ error: "Application error" })
		}
	}
	finally
	{
		console.timeEnd("Total")
	}
}

// -------------------------------------------------------------------------------------------------
// Session Management

function EncryptSession(session: ISession): string
{
	return btoa(JSON.stringify(session.userAuth))
}

function DecryptSession(str: string): ISession
{
	try
	{
		const userAuth = JSON.parse(atob(str))
		return { userAuth }
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

	const now = Math.floor(Date.now() / 1000 - 60)
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

function ParseUserAuth(json: any)
{
	const now = Math.floor(Date.now() / 1000 - 60)
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

async function GetUserAuth(code: string): Promise<IUserAuth>
{
	const url = new URL("https://github.com/login/oauth/access_token")
	url.searchParams.append("client_id", process.env.CLIENT_ID!)
	url.searchParams.append("client_secret", process.env.CLIENT_SECRET!)
	url.searchParams.append("code", code)

	const result = await RESTRequest(GetUserAuth.name, "", "POST", url.toString())
	if (!result.success) throw result.json

	const auth = ParseUserAuth(result.json)
	return auth
}

async function RefreshUserAuth(session: ISession, force: boolean = false): Promise<FetchResult>
{
	const padding     = 1 * 60 * 1000 // 1 minute
	const now         = Date.now() + padding
	const userAuth    = session.userAuth!
	const userExpired = now >= userAuth.tokenExp

	if (userExpired || force)
	{
		const url = new URL("https://github.com/login/oauth/access_token")
		url.searchParams.append("client_id", process.env.CLIENT_ID!)
		url.searchParams.append("client_secret", process.env.CLIENT_SECRET!)
		url.searchParams.append("grant_type", "refresh_token")
		url.searchParams.append("refresh_token", session.userAuth!.refresh)

		session.userAuth = undefined
		const result = await RESTRequest(RefreshUserAuth.name, "", "POST", url.toString())
		if (!result.success && result.json.error == "bad_refresh_token") return result
		if (!result.success) throw result.json

		const auth = ParseUserAuth(result.json)
		session.userAuth = auth
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

async function GetAppDiscussion(auth: IAuth, ctx: IDiscussionContext): Promise<IDiscussion>
{
	const result = await GetDiscussion(auth, ctx, false)
	if (!result.success) throw result.json

	const discussion = result.json
	return discussion
}

async function GetUserDiscussion(session: ISession, ctx: IDiscussionContext): Promise<FetchResult<IDiscussion>>
{
	let result

	result = await RefreshUserAuth(session, false)
	if (!result.success) return result as FetchResult<IDiscussion>

	result = await GetDiscussion(session.userAuth!, ctx, true)
	if (result.success) return result

	result = await RefreshUserAuth(session, true)
	if (!result.success) return result as FetchResult<IDiscussion>

	result = await GetDiscussion(session.userAuth!, ctx, true)
	return result
}

async function GetDiscussion(auth: IAuth, ctx: IDiscussionContext, loggedIn: boolean): Promise<FetchResult<IDiscussion>>
{
	const title = ctx.page.replace(/^\/?|\/?$/g, "")
	const searchQuery = `repo:${ctx.owner}/${ctx.repo} in:title ${title}`
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
			const [repoId, categoryId] = await GetRepoAndCategoryIds(auth, ctx.owner, ctx.repo, ctx.category)
			discussion = await CreateDiscussion(auth, repoId, categoryId, title, ctx.page, ctx.origin)
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

async function SetReaction(auth: IAuth, subjectId: string, reaction: string, add: string)
{
	const mutationId = crypto.randomUUID()
	const op = add == "true" ? "addReaction" : "removeReaction"
	const mutation =
		`mutation {
			${op}(input: {clientMutationId: "${mutationId}", content: ${reaction}, subjectId: "${subjectId}"}) {
				clientMutationId
			}
		}`

	const result = await GraphQLRequest(SetReaction.name, auth, mutation)
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
