+++
title = 'Hello World'
aliases = [ '0' ]
date = 2025-02-12
hidden = true
+++

Hi. Over the last couple of years I've been getting the urge to write. I've been making games for the last decade so it'll mostly be about programming in the context of video games, with a particular interest in general purpose game engines. But, seeing as this is my first post, it'll be about building the blog itself. Trite, maybe, but hopefully at least a little interesting.

Before this, I had precisely zero experience with anything web related (other than dabbling with WASM, which doesn't count). There's just over a year between my first commit and this post, with the work happening in fits and starts. I take my time when learning and I'm a perfectionist, which can be a lethal combination at times. I also got caught in up the game industry apocalypse and spent 5 months goofing off and building a game engine with a couple of friends in between jobs. Severance is a lovely thing.

## How do you make a website?

The first step was deciding how to even make a website. What do you need? Hosting, I guess. Maybe a domain. HTML and CSS files. That's the extent of my knowledge at this point. With a bit of searching I found the concept of static site generators - you write plain text in a markup language and a tool parses it to generate HTML and CSS. I'm a minimalist and I like having access to the fundamental interface I'm working with, so this seemed like a great fit. I had also just read a [great post about markup languages](https://matklad.github.io/2022/10/28/elements-of-a-great-markup-language.html) by Alex Kladov, whose lovely blog served as an inspiration. And [this one](https://www.devever.net/~hl/stringtemplates) by Hugo Landau about generating HTML (which foreshadows some of my complaints with the solution I landed on) so I had some idea about the process of transforming markup into HTML.

There are [many options](https://jamstack.org/generators/) for static site generators. [Jekyll](https://jekyllrb.com/) seemed to be one of the more popular options so I started with that. I got two paragraphs into the Quickstart. Prerequisites: Ruby, RubyGems, GCC, and Make. A big part of the appeal of a static site generator is the simplicity and I know nothing about Ruby. I don't want to learn a programming language or environment on top of learning how to make a website, I want a single command line tool. I also recall some complaints about Jekyll being slow.

I briefly considered making my own, but that seemed like a bad idea when I don't know much about the thing I'm generating. Hugo and Sphinx also stood out. Sphinx is written in Python, which I'm passingly familiar with. I've used it to slap together reporting for automated tests at work. For a markup language it uses reStructured Text (RST) and at the time I thought using a more common format like Markdown made more sense so I decided against it fairly quickly. I didn't look at the installation process, but I imagine it's analogous to the situation with Jekyll.

Hugo was up next. The first bullet on the [landing page](https://gohugo.io/) is about speed and that's a good sign. It's written in Go, a language I've dabbled in and have a passing interest in. Naively, the language a tool is built in shouldn't matter, but in practice it often does as we'll see later. Hugo is distributed as prebuilt binaries available via `winget` and this is a big pro. Poking through the themes there are a few that stand out to me. At this point I'm itching to get started.

## Hosting

This ends up being an easy choice. [Github Pages](https://pages.github.com/) offers free hosting. I remember looking at a couple of other options, but I was pretty well set on Pages from the start. I can push changes from the command line and use Github Actions to build and deploy the site. The Hugo documentation provides a [template](https://gohugo.io/hosting-and-deployment/hosting-on-github/) for a basic Actions workflow and the [final product](https://github.com/akbyrd/akbyrd.github.io/blob/main/.github/workflows/hugo.yaml) is reasonable. It takes about 30 seconds from pushing until I can see the result deployed live. Most of that time is overhead from Actions spinning up machines.

## Domain

Also an easy choice. I picked a name I liked and bought it from the first provider I found with a reasonable price. About $20 a year from Namecheap. I don't think I need any of the extra features like DDoS protection or email service.

One mistake I made here was getting a `.dev` domain. It's cool, but it's also on a special, preloaded HTTP Strict Transport Security list that browsers use to force all traffic to use HTTPS instead of HTTP. Not a problem for this blog, since Github Pages will handle the SSL certificate automatically. But I have an older domain that has a couple of useful DNS redirects. For example, `dotfiles.old.domain` redirects to a PowerShell script that I can download and run on a new machine to quickly set up my typical development environment. Namecheap doesn't handle HTTPS redirects so I can't move this to my new domain. I think other registrars might support this though.

## Hugo

I spent a couple of weeks reading the Hugo docs top to bottom. With so much of the vocabulary being new I found it hard to follow and most of it didn't stick until I started building things. It was an experiment to compare the effectiveness of reading everything at once against reading only the high level aspects and filling in the details as found a concrete need for them. It was fine, but it was definitely less effective.

## Picking a Theme

I want a fairly minimal blog. As I mentioned, [Alex Kladov's](https://matklad.github.io/) blog was a source of inspiration. [Jonathan Blow's](http://number-none.com/blow/blog/) to a certain extent as well. I think it's a relatively common style - a straight list of articles and not much else. There are plenty of themes for Hugo and [PaperMod](https://themes.gohugo.io/themes/hugo-papermod/) stood out as a good starting point. But that didn't last long.

Look, sometimes I obsess over small things. One of the entirely arbitrary things I wanted was switching between light mode and dark mode to be a smooth transition. Not for any other reason than I was curious how to do it. I started looking through the theme to figure out how the theme button worked so I could modify it. At this point I'm still not well acquainted with Go templates and it all looks like Greek. I get frustrated, and deleted the theme so I could make my own. With blackjack and hookers. It's a bit hard to estimate, but maybe 40% of the time making the blog when into the theme. While it looks minimal, there's are some nifty features scattered about.

### Things I like about Hugo

* It's a single executable with no dependencies.

* It's somewhat fast. It's currently taking 300ms to build ~20 pages. I haven't profiled it yet, but I don't think I'm playing nicely with Hugo's caching system so it's probably doing more work than it needs to. I think it was at 80ms recently.

* It uses layered config similar to Git. Both sites and themes can have config, with the site config taking precedence. You have a default configuration in `config/_default`, then environment-specific settings in `config/{development, staging, production}`. The environment config is merged on top of the base config and can override values. So the layer precedence is: site environment > site default > theme environment > theme default. This layered approach is the correct default for tools.

* The core workflow loop is great with hot reloading. You run a local server and you can see changes in your browser in real time as you work on the site. This works for both the theme and content.

* The documentation is pretty good. It's fairly complete and I've found myself using it frequently. Sometimes it feels a bit out of order and frequently the terminology isn't intuitive but overall I'm quite happy it exists.

### Things I don't like about Hugo

* The [layout template lookup order](https://gohugo.io/templates/lookup-order/) is obscene. It's documented only via example as a list of about 600 entries. There is no system or rule and it's rife with inconsistencies. Twice I've analyzed the list to come up with a reasonable pattern to remember how to create a template with a valid name and location. The best I can do is
	```txt {#TemplateLookupOrder}
	home    - layouts[/{<type>|_default}]/{<layout>|index|<kind>|list}.<format>
	section - layouts/{<type>|<section>|<kind>|/_default}/{<layout>|<section>|<kind>|list}.<format>
	single  - layouts/{<section>|_default}/{<layout>|single}.<format>
	```
	And this still leaves out the "baseof" layout templates and doesn't address the order Hugo searches for them.

* Go templates are a really bad programming language. I mean, duh, they aren't a programming language. But you're stuck using them like they are. For non-trivial HTML and CSS generation you need to perform logic. You're going to be writing a lot of branches, and occasionally functions and loops would be nice to have. Text templating is not the right solution to this. I think an AST based approach with a real programming language would be far easier to work with.

* The error messages are awful. They don't provide a clear context and are run together on a single line. It's not practical to parse the output using something like VS Code's problem matchers. They used to have Go template internal details about "unmarshaling", but I don't recall if I've run into that lately so maybe it's fixed.
	```txt {#ErrorMessages .wrap}
	ERROR render of "D:/Dev/akbyrd.dev/content/tests/6-test-emoji.md" failed: "D:\Dev\akbyrd.dev\layouts\_default\baseof.html:30:9": execute of template failed: template: _default/single.html:30:9: executing "_default/single.html" at <partial "resource" (dict "Name" "favicon.ico" "Rename" false)>: error calling partial: "D:\Dev\akbyrd.dev\layouts\partials\resource.html:67:24": execute of template failed: template: partials/resource.html:67:24: executing "partials/resource.html" at <$resource.Width>: error calling Width: this method is only available for image resources
	```

* Render hooks are a great feature, but they're only available for a few types of content. Render hooks allow you to customize how things get rendered into HTML. Hooks exist for code blocks, images, block quotes, and a few other things. There is no hook for inline code, list items, or any other inline elements. This made it harder to deal with Markdown "task lists" and to add syntax highlighting to inline code. Again, what I really want is an AST based model where I can rewrite the rendering for any node type.

* The security model is pointlessly restrictive for my use case. You're not able to shell out to another tool from a template. Any feature Hugo doesn't implement natively is impossible to achieve using an existing tool. Want more control over image processing? A more accurate tool for syntax highlighting? Nope and nope. The devs [have](https://github.com/gohugoio/hugo/pull/7529#issuecomment-1111384963) [mentioned](https://github.com/gohugoio/hugo/issues/9460#issuecomment-1029051191) that they don't want running someone elses site on their machine to execute arbitrary code. While that's reasonable, idk, run it in Windows Sandbox or something, don't hamstring the tool. I don't need my tools to protect me from myself.

* Hot reloading isn't reliable. It works 90% of the time, but it's common to get into situations where changing a file doesn't cause it to rebuild. It's also common to remain stuck in a broken state after fixing a compilation error until you turn it off and back on again.

* Lots of bugs and inconsistent behavior. For a while building your site would fail with an obscure error if you didn't have a `static` folder at the top level, even if it's empty and you don't need to use it.

* There are 3 versions of Hugo: regular, Extended Edition and Extended/Deploy Edition. I guess this is about binary size? But we're talking about ~25 MiB so the separation seems largely useless to users.

* It generally takes a "good enough" development approach. Between that and the backwards compatibility goal it has a tendency to end up with unsatisfying solutions. Backwards compatibility in particular is interesting because while I haven't been bitten by it yet, I've seen multiple [complaints](https://commaok.xyz/post/on_hugo/) about how often breaking changes are made. Yet it's also the reason for not improving things like the template lookup order. It seems to be in a middle ground that ends up unsatisfying to both sides.

* Concepts in the docs are sometimes used before they are introduced. Getting Started is currently in the 3rd row of topics on the main page.

* There are weird subtleties like `index.md` being different than `_index.md`.

* At times terminology for different concepts uses synonyms or is ambiguous. Pages have a kind, a type, a format, and a layout and each plays a slightly different role when selecting the layout template that gets used. `Page.IsPage` can return false because while everything is a `Page`, `Page.Kind` may or may not be `page`.

### Overall

I'm happy I chose to use Hugo. It was useful to have guardrails while learning a lot of new stuff all at once. Without it there's a good chance I would have gotten bogged down and shelved the project for a while. That said, by halfway through the site I hit an inflection point where it became more of an obstacle. Not enough that it made sense to switch tools immediately, but enough that I want to make my own static site generator at some point.

As long as you play to its strengths it's a pleasant tool to use. If you want a site that's easy to get up and running, easy to build and modify, has a good workflow for writing, and want an off-the-shelf theme it's hard to complain. If you want precise control over the generated HTML and CSS or over the theme you'll want to consider your options. Theming and customizing the generated output in Hugo is clumsy and unpleasant.

I think there's a simpler, more elegant tool trying to get out.

## TOML

Hugo allows 3 different configuration formats: JSON, TOML, and YAML. I was excited to try TOML on account of how simple and similar to INI it is. I read through [the spec](https://toml.io/en/), which is delightfully small. There are some quirks with the order in which tables can be defined, but overall I like it. Unfortunately, the tooling in VS Code isn't good. There's basically one abandoned TOML extension that's littered with bugs. For that reason alone I would prefer to have used a different language.

One cool thing I noticed is that the TOML extension has built-in support for Hugo's config files. Or at least I _thought_ it did, but it turns out it's automatically pulling the schema from [JSON Schema Store](https://www.schemastore.org/json/). JSON schemas are pretty neat and despite the name can be used for other languages as well. Unfortunately, the schema there for Hugo is out of date. Go has reflection so I figured it would be possible to generate the schema automatically from the structs used for config options. I briefly toyed around with implementing this, but the maintainers don't [seem particularly interested](https://github.com/gohugoio/hugo/issues/9725) in the idea so I figured it wasn't a good use of time.

## Code
## Math
## Images
## Comments
## RSS
## CSS and HTML
## Markdown
## Design Help
