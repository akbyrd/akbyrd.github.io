+++
title = 'Hugo Setup'
aliases = [ '1' ]
draft = true
+++



## Things Hugo gets right
- Single executable with no dependencies
- Layered config
- Fast
- Hot reload
- Documentation

## Things Hugo gets wrong
- Documentation
	- Doesn't explain that attributes are parameters to shortcodes. Doesn't explain what they do and leads to confusion until you make that connection yourself.
	- Doesn't teach you about the relationship between markup and shortcodes. Does not explain shortcodes early enough.
	- 5 years old "The bundle documentation is a work in progress. We will publish more comprehensive docs about this soon." [ref](https://gohugo.io/content-management/organization/)
	- Ditto https://gohugo.io/hugo-modules/theme-components/
	- Inaccurate
	- Strange order. More nuanced features are introduced before the fundamentals
- Config files with the same name
- Hot reload
	- Get stuck with errors after fixing them
	- Moving posts breaks things
- Error messages
	- ```toml {#TomlConfig}
		markup.goldmark.renderer.hardWraps = true
		[markup]
			[markup.highlight]
				anchorLineNos = true
		```
		https://gohugo.io/getting-started/glossary/#unmarshal
	- `{{</* ref "posts/hugo-setup" */>}}` sometimes works without quotes, but error message is obtuse when it finally breaks
	- Some errors don't occur in a rebuild but occur in (e.g. `REF_NOT_FOUND`)
- Unintuitive: ref from non-draft to draft
- Bugs & development philosophy. `summaryLength` doesn't work properly with headings and lists. No interest in fixing. Get a very "good enough" vibe from developers.
- Devs frequently terse to the point of being unhelpful, occasionally rude
	- https://discourse.gohugo.io/t/how-can-i-change-the-rss-url/118/11
	- https://github.com/gohugoio/hugo/issues/3356#issuecomment-294560139
- Confusing naming
	_index.md vs index.md
	OrderedTaxonomy/WeightedPages .Page vs .Pages https://gohugo.io/templates/taxonomy-templates/#orderedtaxonomy
- https://commaok.xyz/post/on_hugo/
- safeHTML and being defensive against yourself
	{{ printf `<?xml version="1.0" encoding="utf-8"?>` | safeHTML }}
	files entire purpose is to render HTML / XML
- Security model
	Focused on protecting users from themselves. Not actually useful to me.
	Never getting a way to shell out to other tools during build
	https://github.com/gohugoio/hugo/issues/9460#issuecomment-1029051191
	https://github.com/gohugoio/hugo/pull/7529#issuecomment-1111384963

## Misc
- Even Better TOML supports Hugo out of the box (but doesn't say it does)
- vscode tasks

## Why Hugo?
- Jekyll
	- Instructions - Install all prerequisites - Ruby, RubyGems, gcc, make
- Sphinx?
- Custom?

## The rabbit hole
Want to make a site
Remember posts about markup languages and generating html (matklad, templates always wrong)
Read about Jekyll and Hugo
Buy a domain
Setup github pages
Get a toml vscode extension
Track down various toml extension issues
Start updating hugo json schema
Add schema generation to hugo
Create new hugo theme

### Linux
```bash {#LinuxInstall}
# apt install gcc

# wget https://go.dev/dl/go1.21.5.linux-amd64.tar.gz
# rm -rf /usr/local/go
# tar -C /usr/local -xzf go1.21.5.linux-amd64.tar.gz

# git clone https://github.com/gohugoio/hugo.git
# cd hugo
# go install
# go install github.com/magefile/mage

# mage hugo
# mage install
# mage hugoRace
# mage -v check

export GOROOT=/usr/local/go
export GOPATH=$HOME/go
export PATH=$GOPATH/bin:$GOROOT/bin:$PATH
export CGO_ENABLED=1
```
