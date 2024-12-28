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

export const config = {
	//runtime: "nodejs",
}

export default async function handler(request: VercelRequest, response: VercelResponse)
{
	// NOTE: Unhandled failure modes:
	// * Large requests  - limited to 4.5 MB or 4 MB, depdending on runtime
	// * Time outs       - limited to 10s or 25s, depending on runtime
	// * Expired tokens  - TODO (auth and refresh)
	// * Invalid session - TODO

	try
	{
		console.log(`\n${request.method}\n${request.url}`)

		if (!process.env.CLIENT_ID)     throw "Client Id not set"
		if (!process.env.CLIENT_SECRET) throw "Client Secret not set"
		if (!process.env.PRIVATE_KEY)   throw "Private Key not set"

		const prodOrigin = "https://akbyrd.dev"
		const devOrigin  = "https://localhost:1313"
		switch (request.headers.origin)
		{
			case devOrigin:
				response.setHeader("access-control-allow-credentials", "true")
				response.setHeader("access-control-allow-headers",     "credentials, x-vercel-protection-bypass, x-vercel-set-bypass-cookie")
				response.setHeader("access-control-allow-origin",      devOrigin)
				break

			case prodOrigin:
				response.setHeader("access-control-allow-origin",      prodOrigin)
				break
		}

		const url = new URL(request.url || "", `http://${request.headers.host}`);
		if (request.method == "OPTIONS")
		{
			return response.status(204).send(null)
		}
		else if (url.pathname == "/login")
		{
			const code  = request.query.code  as string
			const state = request.query.state as string

			if (!code)  throw { statusCode: 400, body: { error: "Code not specified"  } }
			if (!state) throw { statusCode: 400, body: { error: "State not specified" } }

			const userAuth    = await GetUserAuth(process.env.CLIENT_ID, process.env.CLIENT_SECRET, code)
			const session     = Encrypt(userAuth)
			const expires     = new Date(userAuth.refreshExp * 1000).toUTCString()
			const devRequest  = request.headers.origin == devOrigin
			const devRedirect = new URL(state).origin == devOrigin
			const sameSite    = devRequest || devRedirect ? "None" : "Strict"
			// TODO: Understand why partition doesn't work
			//const partitioned = devRequest || devRedirect ? "; Partitioned" : ""
			const cookie      = `session=${session}; Expires=${expires}; SameSite=${sameSite}; Secure; HttpOnly`
			response.setHeader("set-cookie", cookie)

			return response.redirect(302, state)
		}
		else if (url.pathname == "/logout")
		{
			const session = request.cookies.session as string

			if (!session) throw { statusCode: 400, body: { error: "Session not specified" } }

			const devRequest = request.headers.origin == devOrigin
			const sameSite   = devRequest ? "None" : "Strict"
			const cookie     = `session=goaway; Max-Age=0; SameSite=${sameSite}; Secure; HttpOnly`
			response.setHeader("set-cookie", cookie)

			return response.status(204).send(null)
		}
		else
		{
			const session  = request.cookies.session as string
			const origin   = request.headers.origin  as string
			const owner    = request.query.owner     as string
			const repo     = request.query.repo      as string
			const category = request.query.category  as string
			const page     = request.query.page      as string

			if (!origin)   throw { statusCode: 400, body: { error: "Origin not specified"   } }
			if (!owner)    throw { statusCode: 400, body: { error: "Owner not specified"    } }
			if (!repo)     throw { statusCode: 400, body: { error: "Repo not specified"     } }
			if (!category) throw { statusCode: 400, body: { error: "Category not specified" } }
			if (!page)     throw { statusCode: 400, body: { error: "Page not specified"     } }

			if (session)
			{
				const userAuth   = Decrypt(session) as IUserAuth
				const discussion = await GetDiscussion(userAuth, owner, repo, category, page, origin)

				discussion.loggedIn = true
				return response.status(200).json(discussion)
			}
			else
			{
				const token      = await CreateJWT(process.env.CLIENT_ID, process.env.PRIVATE_KEY)
				const appAuthUrl = await GetAppAuthUrl(token, owner, repo)
				const appAuth    = await GetAppAuth(token, appAuthUrl)
				const discussion = await GetDiscussion(appAuth, owner, repo, category, page, origin)

				discussion.loggedIn = false
				return response.status(200).json(discussion)
			}
		}

		throw "Failed to return a value"
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
			console.error(error)
			return response.status(500).json({ error: "Application error" })
		}
	}
}

// -------------------------------------------------------------------------------------------------
// App Authorization

interface IAuth
{
	token: string
	tokenExp: number
}

async function CreateJWT(clientId: string, privateKey: string): Promise<string>
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

	console.time(CreateJWT.name)
	const key_b64 = b64tobytes(privateKey)
	const alg = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256", }
	const key = await crypto.subtle.importKey("pkcs8", key_b64, alg, false, ["sign"])

	const now = Math.floor(Date.now() / 1000 - 60)
	const header_b64 = objtob64({ alg: "RS256", typ: "JWT", })
	const payload_b64 = objtob64({ iat: now, exp: now + 300, iss: clientId, })
	const message_bytes = strtobytes(`${header_b64}.${payload_b64}`)

	const signature_bytes = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, message_bytes)
	const signature_b64 = bytestob64(signature_bytes)

	const token = `${header_b64}.${payload_b64}.${signature_b64}`
	console.timeEnd(CreateJWT.name)
	return token
}

async function GetAppAuthUrl(token: string, owner: string, repo: string): Promise<string>
{
	console.time(GetAppAuthUrl.name)
	const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/installation`, {
		method: "GET",
		headers: {
			"Accept": "application/vnd.github+json",
			"Authorization": `Bearer ${token}`,
			"Content-Type": "application/json",
			"X-GitHub-Api-Version": "2022-11-28",
		},
	})

	const json = await response.json()
	if (!response.ok) throw json

	console.timeEnd(GetAppAuthUrl.name)
	return json.access_tokens_url
}

async function GetAppAuth(token: string, appAuthUrl: string): Promise<IAuth>
{
	console.time(GetAppAuth.name)
	const response = await fetch(appAuthUrl, {
		method: "POST",
		headers: {
			"Accept": "application/vnd.github+json",
			"Authorization": `Bearer ${token}`,
			"Content-Type": "application/json",
			"X-GitHub-Api-Version": "2022-11-28",
		}
	})

	const json = await response.json()
	if (!response.ok) throw json

	const auth = {
		token:    json.token,
		tokenExp: json.expires_at,
	}

	console.timeEnd(GetAppAuth.name)
	return auth
}

// -------------------------------------------------------------------------------------------------
// User Authorization

interface IUserAuth extends IAuth
{
	refresh:    string
	refreshExp: number
}

// TODO: Handle errors
async function GetUserAuth(clientId: string, clientSecret: string, code: string): Promise<IUserAuth>
{
	console.time(GetUserAuth.name)
	const url = new URL("https://github.com/login/oauth/access_token")
	url.searchParams.append("client_id", clientId)
	url.searchParams.append("client_secret", clientSecret)
	url.searchParams.append("code", code)

	const response = await fetch(url.toString(), {
		method: "POST",
		headers: {
			"Accept": "application/vnd.github+json",
			"Content-Type": "application/json",
			"X-GitHub-Api-Version": "2022-11-28",
		},
	})

	const json = await response.json()
	if (!response.ok) throw json

	const now = Math.floor(Date.now() / 1000 - 60)
	const auth = {
		token:      json.access_token,
		tokenExp:   now + Number(json.expires_in),
		refresh:    json.refresh_token,
		refreshExp: now + Number(json.refresh_token_expires_in),
	}
	if (Number.isNaN(auth.tokenExp))   throw "Failed to parse user token expiration"
	if (Number.isNaN(auth.refreshExp)) throw "Failed to parse user token refresh expiration"

	console.timeEnd(GetUserAuth.name)
	return auth
}

// -------------------------------------------------------------------------------------------------
// Discussion Query

const discussionQueryData =
	`
	bodyHTML
	comments(first: 100) {
		nodes {
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

async function GetDiscussion(auth: IAuth, owner: string, repo: string, category: string, page: string, originUrl: string): Promise<IDiscussion>
{
	console.time(GetDiscussion.name)
	const title = page.replace(/^\/?|\/?$/g, "")
	const searchQuery = `repo:${owner}/${repo} in:title ${title}`
	const discussionQuery =
		`query($query: String!) {
			search(type: DISCUSSION, query: $query, first: 2) {
				discussionCount
				nodes {
					... on Discussion {
						${discussionQueryData}
					}
				}
			}
		}`

	const response = await fetch("https://api.github.com/graphql", {
		method: "POST",
		headers: {
			"Accept": "application/vnd.github+json",
			"Authorization": `Bearer ${auth.token}`,
			"Content-Type": "application/json",
			"X-GitHub-Api-Version": "2022-11-28",
		},
		body: JSON.stringify({
			query: discussionQuery,
			variables: { query: searchQuery, },
		}),
	})

	const json = await response.json()
	if (!response.ok) throw json

	console.timeEnd(GetDiscussion.name)

	let discussion = null
	const discussions = json.data.search.nodes
	switch (discussions.length)
	{
		case 0:
		{
			const [repoId, categoryId] = await GetRepoAndCategoryIds(auth, owner, repo, category)
			discussion = await CreateDiscussion(auth, repoId, categoryId, title, page, originUrl)
			break
		}

		case 1:
			discussion = discussions[0]
			break

		default:
			throw { statusCode: 500, body: { error: "Failed to find discussion" } }
	}

	discussion.loggedIn = false
	return discussion
}

async function GetRepoAndCategoryIds(auth: IAuth, owner: string, repo: string, category: string)
{
	console.time(GetRepoAndCategoryIds.name)
	const query =
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
		}`

	const response = await fetch("https://api.github.com/graphql", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${auth.token}`,
			"Accept": "application/vnd.github+json",
			"Content-Type": "application/json",
			"X-GitHub-Api-Version": "2022-11-28",
			"X-Github-Next-Global-ID": "1",
		},
		body: JSON.stringify({
			query: query,
		}),
	})

	const json = await response.json()
	if (!response.ok) throw json

	const categories = json.data.repository.discussionCategories.nodes as { id: string, name: string }[]
	const categoryNode = categories.find(c => c.name === category)
	if (!categoryNode) throw { statusCode: 400, body: { error: "Category not found" } }

	console.timeEnd(GetRepoAndCategoryIds.name)
	return [json.data.repository.id, categoryNode.id]
}

async function CreateDiscussion(auth: IAuth, repoId: string, categoryId: string, title: string, page: string, originUrl: string)
{
	console.time("CreateDiscussion")
	if (originUrl.includes("localhost"))
		throw { statusCode: 400, body: { error: "Creating discussions from localhost is disabled" } }

	const body = originUrl ? new URL(page, originUrl).toString() : ""
	const mutation =
		`mutation {
			createDiscussion(input: {repositoryId: "${repoId}", categoryId: "${categoryId}", body: "${body}", title: "${title}"}) {
				discussion {
					${discussionQueryData}
				}
			}
		}`

	const response = await fetch("https://api.github.com/graphql", {
		method: "POST",
		headers: {
			"Accept": "application/vnd.github+json",
			"Authorization": `Bearer ${auth.token}`,
			"Content-Type": "application/json",
			"X-GitHub-Api-Version": "2022-11-28",
		},
		body: JSON.stringify({
			query: mutation,
		}),
	})

	const json = await response.json()
	if (!response.ok) throw json
	if ("errors" in json) throw json
	if (json.extensions && json.extensions.warnings)
		console.log(json.extensions.warnings)

	console.timeEnd("CreateDiscussion")
	return json.data.createDiscussion.discussion as IDiscussion
}

// -------------------------------------------------------------------------------------------------
// Utilities

function Encrypt(obj: {}): string
{
	return btoa(JSON.stringify(obj))
}

function Decrypt(s: string): {}
{
	return JSON.parse(atob(s))
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
