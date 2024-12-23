import * as crypto from "crypto"

declare const process:
{
	env:
	{
		APP_ID?: string
		PRIVATE_KEY?: string
	}
}

interface IEvent
{
	http?: {
		headers: {
			origin: string
		}
		method: string
		path: string
	}
	owner?: string
	repo?: string
	repoId?: string
	categoryId?: string
	page?: string
}

interface IReturn
{
	body: {}
	statusCode: number
	headers?: {}
}

export async function main(event: IEvent): Promise<IReturn>
{
	try
	{
		if (!process.env.APP_ID)      throw "App Id not set"
		if (!process.env.PRIVATE_KEY) throw "Private Key not set"

		const token   = await CreateJWT(process.env.APP_ID, process.env.PRIVATE_KEY)
		const install = await GetInstallation(token, event.owner, event.repo)
		const access  = await GetAppToken(token, install)

		if (event.http && event.http.path === "/categories")
		{
			if (!event.owner) throw { body: { error: "Owner not specified" }, statusCode: 400 }
			if (!event.repo)  throw { body: { error: "Repo not specified"  }, statusCode: 400 }

			const categories = await GetCategories(access, event.owner, event.repo)
			return { body: categories, statusCode: 200 }
		}
		else
		{
			if (!event.owner)      throw { body: { error: "Owner not specified"       }, statusCode: 400 }
			if (!event.repo)       throw { body: { error: "Repo not specified"        }, statusCode: 400 }
			if (!event.repoId)     throw { body: { error: "Repo Id not specified"     }, statusCode: 400 }
			if (!event.categoryId) throw { body: { error: "Category Id not specified" }, statusCode: 400 }
			if (!event.page)       throw { body: { error: "Page not specified"        }, statusCode: 400 }

			const originUrl = event.http ? event.http.headers.origin : "https://example.com"
			const discussion = await GetDiscussion(access, event.owner, event.repo, event.repoId, event.categoryId, event.page, originUrl)
			return { body: discussion, statusCode: 200 }
		}
	}
	catch (error: unknown)
	{
		if (error instanceof Object && 'body' in error && 'statusCode' in error)
		{
			throw error
		}
		else
		{
			console.error(error)
			throw { body: { error: "Application error" }, statusCode: 500 }
		}
	}
}

// -------------------------------------------------------------------------------------------------
// Category Search

async function GetCategories(access: IAccess, owner: string, repo: string): Promise<{}>
{
	const cateogryQuery =
	`query {
		repository(owner: "${owner}", name: "${repo}") {
			id
			name
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
			Authorization: `Bearer ${access.token}`,
			"Accept": "application/vnd.github+json",
			"Content-Type": "application/json",
			"X-GitHub-Api-Version": "2022-11-28",
			"X-Github-Next-Global-ID": "1",
		},
		body: JSON.stringify({
			query: cateogryQuery,
		}),
	})

	const json = await response.json()
	if (!response.ok) throw json

	return json
}

// -------------------------------------------------------------------------------------------------
// App Authorization

interface IInstallation
{
	access_tokens_url: string
}

interface IAccess
{
	expires_at: string
	token: string
}

async function CreateJWT(appId: string, privateKey: string): Promise<string>
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
	const payload_b64 = objtob64({ iat: now, exp: now + 300, iss: appId, })
	const message_bytes = strtobytes(`${header_b64}.${payload_b64}`)

	const signature_bytes = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, message_bytes)
	const signature_b64 = bytestob64(signature_bytes)

	const token = `${header_b64}.${payload_b64}.${signature_b64}`
	console.timeEnd(CreateJWT.name)
	return token
}

async function GetInstallation(token: string, owner: string, repo: string): Promise<IInstallation>
{
	console.time(GetInstallation.name)
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

	console.timeEnd(GetInstallation.name)
	return json as IInstallation
}

async function GetAppToken(token: string, install: IInstallation): Promise<IAccess>
{
	console.time(GetAppToken.name)
	const response = await fetch(install.access_tokens_url, {
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

	console.timeEnd(GetAppToken.name)
	return json as IAccess
}

// -------------------------------------------------------------------------------------------------
// User Authorization

/*
async function GetUserToken()
{
	console.time(GetUserToken.name)
	const code = sessionStorage.getItem("code")
	sessionStorage.removeItem("code")

	if (!code)
	{
		const bytes = crypto.getRandomValues(new Uint8Array(16))
		const state = bytestob64(bytes)
		sessionStorage.setItem("state", state)
		sessionStorage.setItem("url", location.href)

		const url = new URL("https://github.com/login/oauth/authorize")
		url.searchParams.append("client_id", clientId)
		url.searchParams.append("state", state)
		url.searchParams.append("redirect_uri", `${location.origin}/github`)
		location.href = url.toString()
	}
	else
	{
		if (false)
		{
			const url = new URL("https://github.com/login/oauth/access_token")
			url.searchParams.append("client_id", clientId)
			url.searchParams.append("client_secret", clientSecret)
			url.searchParams.append("code", code)
			//url.searchParams.append("redirect_uri", )
			//url.searchParams.append("repository_id", )

			const response = await fetch(url.toString(), {
				method: "POST",
			})

			const accessToken = params.get("access_token")
			const expiresIn = params.get("expires_in")
			const refreshToken = params.get("refresh_token")
			const refreshTokenExpiresIn = params.get("refresh_token_expires_in")
			const scope = params.get("scope")
			const tokenType = params.get("token_type")
			console.log(accessToken, expiresIn, refreshToken, refreshTokenExpiresIn, scope, tokenType)
		}
		else
		{
			const url = new URL("http://localhost:3000/login")
			url.searchParams.append("code", code)

			const response = await fetch(url.toString(), {
				method: "GET",
			})
			console.log(response)
		}
	}
	console.timeEnd(GetUserToken.name)
}
*/

// -------------------------------------------------------------------------------------------------
// Discussion Query

interface IDiscussion {}

async function GetDiscussion(access: IAccess, owner: string, repo: string, repoId: string, categoryId: string, page: string, originUrl: string): Promise<IDiscussion>
{
	console.time(GetDiscussion.name)
	const discussionData =
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


	const title = page.replace(/^\/?|\/?$/g, "")
	const searchQuery = `repo:${owner}/${repo} in:title ${title}`
	const discussionQuery =
		`query($query: String!) {
			search(type: DISCUSSION, query: $query, first: 1) {
				discussionCount
				nodes {
					... on Discussion {
						${discussionData}
					}
				}
			}
		}`

	const response = await fetch("https://api.github.com/graphql", {
		method: "POST",
		headers: {
			"Accept": "application/vnd.github+json",
			"Authorization": `Bearer ${access.token}`,
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
			console.time("CreateDiscussion")
			if (originUrl.includes("localhost"))
				throw { body: { error: "Creating discussions from localhost is disabled" }, statusCode: 400 }

			const body = originUrl ? new URL(page, originUrl).toString() : ""
			const mutation =
				`mutation {
					createDiscussion(input: {repositoryId: "${repoId}", categoryId: "${categoryId}", body: "${body}", title: "${title}"}) {
						discussion {
							${discussionData}
						}
					}
				}`

			const response = await fetch("https://api.github.com/graphql", {
				method: "POST",
				headers: {
					"Accept": "application/vnd.github+json",
					"Authorization": `Bearer ${access.token}`,
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

			discussion = json.data.createDiscussion.discussion as IDiscussion
			console.timeEnd("CreateDiscussion")
			break
		}

		case 1:
			discussion = discussions[0]
			break

		default:
			throw { body: { error: "Failed to find discussion" }, statusCode: 500 }
	}

	return discussion
}

// -------------------------------------------------------------------------------------------------
// Utilities

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
