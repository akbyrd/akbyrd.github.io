+++
title = 'Tests'
url = '/:slug/'

[[cascade]]
	# Remove the numeric prefix from page URLs
	url = '/:section/:slug/'

	# Exclude from sitemap (recursively)
	[cascade.sitemap]
		disable = true
+++
