import * as crypto from "crypto"

interface IEvent
{
	http: {
		headers: {
			"accept": string,
			"accept-encoding": string,
			"content-type": string,
			"user-agent": string,
			"x-forwarded-for": string,
			"x-forwarded-proto": string,
			"x-request-id": string
		},
		method: string,
		path: string,
	},
	owner?: string,
	repo?: string,
	page?: string,
}

interface IContext
{
	functionName: string,
	functionVersion: string,
	activationId: string,
	requestId: string,
	deadline: number,
	apiHost: string,
	apiKey: string,
	namespace: string,

	getRemainingTimeInMillis(): number,
}

interface IReturn
{
	body: {},
	statusCode: number,
	headers?: {},
}

export async function main(event: IEvent, context: IContext): Promise<IReturn>
{
	try
	{
		CheckParameters(event)
		const jwt = await CreateJWT(process.env.APP_ID, process.env.PRIVATE_KEY)
		const installation = await GetInstallation(jwt, event.owner, event.repo)
		const access = await GetAppToken(jwt, installation)
		const discussion = await GetDiscussion(access, event.owner, event.repo, event.page)
		return { body: discussion, statusCode: 200 }
	}
	catch (error: unknown)
	{
		if (error instanceof Object && 'msg' in error && 'statusCode' in error)
		{
			throw error
		}
		else
		{
			console.log(error)
			throw { body: { error: "Application error" }, statusCode: 500 }
		}
	}
}

function CheckParameters(event: IEvent): void
{
	if (!process.env.APP_ID)      throw { body: { error: "App Id not set"      }, statusCode: 500 }
	if (!process.env.PRIVATE_KEY) throw { body: { error: "Private Key not set" }, statusCode: 500 }
	if (!event.owner)             throw { body: { error: "Owner not specified" }, statusCode: 400 }
	if (!event.repo)              throw { body: { error: "Repo not specified"  }, statusCode: 400 }
	if (!event.page)              throw { body: { error: "Page not specified"  }, statusCode: 400 }
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
	const key_b64 = b64tobytes(privateKey)
	const alg = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256", }
	const cryptoKey = await crypto.subtle.importKey("pkcs8", key_b64, alg, false, ["sign"])

	const now = Math.floor(Date.now() / 1000 - 60)
	const header_b64 = objtob64({ alg: "RS256", typ: "JWT", })
	const payload_b64 = objtob64({ iat: now, exp: now + 300, iss: appId, })
	const message_bytes = strtobytes(`${header_b64}.${payload_b64}`)

	const signature_bytes = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, message_bytes)
	const signature_b64 = bytestob64(signature_bytes)

	const jwt = `${header_b64}.${payload_b64}.${signature_b64}`
	return jwt
}

async function GetInstallation(jwt: string, owner: string, repo: string): Promise<IInstallation>
{
	const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/installation`, {
		method: "GET",
		headers: {
			Authorization: `Bearer ${jwt}`,
		},
	})

	const json = await response.json()
	if (!response.ok) throw json

	const installation = json as IInstallation
	return installation
}

async function GetAppToken(jwt: string, installation: IInstallation): Promise<IAccess>
{
	const response = await fetch(installation.access_tokens_url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${jwt}`,
			"Content-Type": "application/json",
		}
	})

	const json = await response.json()
	if (!response.ok) throw json
	return json as IAccess
}

/*
// -------------------------------------------------------------------------------------------------
// User Authorization

async function GetUserToken()
{
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
}
*/

// -------------------------------------------------------------------------------------------------
// Discussion Query

interface IDiscussion {}
interface IDiscussionSearch
{
	data: {
		search: {
			discussionCount: number
			nodes: IDiscussion[]
		}
	}
}

async function GetDiscussion(access: IAccess, owner: string, repo: string, page: string): Promise<IDiscussion>
{
	const searchQuery = `repo:${owner}/${repo} in:title ${page}`
	const discussionQuery =
		`query($query: String!) {
			search(type: DISCUSSION, query: $query, first: 1) {
				discussionCount
				nodes {
					... on Discussion {
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
						}
					}
				}
			}
		}`

	const response = await fetch("https://api.github.com/graphql", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${access.token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			query: discussionQuery,
			variables: { query: searchQuery, },
		}),
	})

	const json = await response.json()
	if (!response.ok) throw json

	const search = json as IDiscussionSearch
	if (search.data.search.nodes.length != 1)
		throw { body: { error: "Failed to find discussion" }, statusCode: 500 }

	return search.data.search.nodes[0]
}

// -------------------------------------------------------------------------------------------------
// Utilities

declare const process:
{
	env:
	{
		APP_ID?: string
		PRIVATE_KEY?: string
	}
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
