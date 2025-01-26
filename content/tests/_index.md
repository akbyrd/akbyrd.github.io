+++
title = 'Tests'
url = '/:slug/'
comments = false

[[cascade]]
	# Remove the numeric prefix from page URLs
	url = '/:section/:slug/'

	[cascade.params]
		comments = true

	# Exclude from sitemap (recursively)
	[cascade.sitemap]
		disable = true
+++
