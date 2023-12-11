+++
title = 'Hugo Setup'
draft = true
+++

# Things Hugo gets right
- Single executable with no dependencies
- Layered config
- Fast
- Hot reload
- Documentation

# Things Hugo gets wrong
- Documentation
	- Doesn't explain that attributes are parameters to shortcodes. Doesn't explain what they do and leads to confusion until you make that connection yourself.
	- Doesn't teach you about hte relationship between markup and shortcodes. Does not explain shortcodes early enough.
	- 5 years old "The bundle documentation is a work in progress. We will publish more comprehensive docs about this soon." [ref](https://gohugo.io/content-management/organization/)
	- Inaccurate
	- Strange order. More nuanced features are introduced before the fundamentals
- Config files with the same name
- Hot reload
	- Get stuck with errors after fixing them
	- Moving posts breaks things
- Error messages
	```toml
	markup.goldmark.renderer.hardWraps = true
	[markup]
		[markup.highlight]
			anchorLineNos = true
	```
	https://gohugo.io/getting-started/glossary/#unmarshal

# Misc
- Even Better TOML supports Hugo out of the box (but doesn't say it does)
- vscode tasks

#  Why Hugo?
- Jekyll
	- Instructions - Install all prerequisites - Ruby, RubyGems, gcc, make
