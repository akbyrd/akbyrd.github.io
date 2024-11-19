+++
[[cascade]]
	# Remove the numeric prefix from page URLs
	url = '/:section/:slug/'

	# TODO: Remove
	[cascade.params]
		comments = true # Include comments

	# Exclude from sitemap (recursively)
	[cascade.sitemap]
		disable = true
+++
