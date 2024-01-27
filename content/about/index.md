+++
title = 'About'
date = 2023-12-10T22:41:28-08:00
draft = true
+++

{{< me.inline >}}
	{{ with $.Get 0 }}
		{{ with $.Page.Resources.Get . }}
		<figure>
			<img src="{{ .RelPermalink }}" width="256" height="256">
		</figure>
		<figcaption>Me</figcaption>
		{{ end }}
	{{ end }}
{{< /me.inline >}}

{{< me.inline "me.png" />}}

- [ ] TODO: LinkedIn
- [ ] TODO: Mastodon
- [ ] TODO: Twitter
- [ ] TODO: Github
- [ ] TODO: Email
