+++
title = 'Hugo Setup'
aliases = [ '1' ]
draft = true
+++

[foo](http://bar.com)

## Things Hugo gets right
- Single executable with no dependencies
- Layered config
- Fast
- Hot reload
- Documentation

## Things Hugo gets wrong
- Documentation
	- Doesn't explain that attributes are parameters to shortcodes. Doesn't explain what they do and leads to confusion until you make that connection yourself.
	- Doesn't teach you about hte relationship between markup and shortcodes. Does not explain shortcodes early enough.
	- 5 years old "The bundle documentation is a work in progress. We will publish more comprehensive docs about this soon." [ref](https://gohugo.io/content-management/organization/)
	- Ditto https://gohugo.io/hugo-modules/theme-components/
	- Inaccurate
	- Strange order. More nuanced features are introduced before the fundamentals
- Config files with the same name
- Hot reload
	- Get stuck with errors after fixing them
	- Moving posts breaks things
- Error messages
	- ```toml
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
- Confusing naming
	_index.md vs index.md
	OrderedTaxonomy/WeightedPages .Page vs .Pages https://gohugo.io/templates/taxonomy-templates/#orderedtaxonomy

## Misc
- Even Better TOML supports Hugo out of the box (but doesn't say it does)
- vscode tasks

## Why Hugo?
- Jekyll
	- Instructions - Install all prerequisites - Ruby, RubyGems, gcc, make

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
```bash
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
