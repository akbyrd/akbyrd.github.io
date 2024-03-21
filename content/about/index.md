+++
title = 'About'
date = 2023-12-10T22:41:28-08:00
layout = 'about'
draft = true
+++

{{< me.inline >}}
	{{ $filename := $.Get 0 }}
	{{ with $.Page.Resources.Get $filename }}
		{{ with .Resize "256x jpeg q90 photo" }}
		<img class="about-pic" src="{{ .RelPermalink }}" alt="Me" width="{{ .Width }}" height="{{ .Height }}">
		{{ end }}
	{{ end }}
{{< /me.inline >}}

{{< me.inline "me.png" />}}

Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
