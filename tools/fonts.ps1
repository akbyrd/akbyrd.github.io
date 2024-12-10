$codeIn  = "assets\res\InconsolataNerdFontMono-Regular.ttf"
$codeOut = "assets\res\code.woff", "assets\res\code.woff2"

foreach ($out in $codeOut)
{
	$ext = Split-Path -Extension $out
	$ext = $ext.substring(1)

	fonttools `
		subset `
		$codeIn `
		--output-file=$out `
		--flavor=$ext `
		--with-zopfli `
		--drop-tables="PfEd, BASE" `
		--layout-features="ss01" `
		--unicodes="u0000-00a0,ufeff,ufffd" `
		--unicodes="uf046b" <# nf-md-rss #> `
		--unicodes="uf033b" <# nf-md-linkedin #> `
		--unicodes="uf02a4" <# nf-md-github #> `
		--unicodes="uf0ad1" <# nf-md-mastodon #> `
		--unicodes="uf0544" <# nf-md-twitter #> `
		--unicodes="uf01ee" <# nf-md-email #> `
		--unicodes="uf4bb"  <# nf-oct-copy #> `
		--unicodes="uf118"  <# nf-fa-face_smile #>


	$name = Split-Path -Leaf $out
	$size = (Get-Item $out).Length / 1024
	Write-Host ("{0,-12} {1,5:0.0} kb" -f $name, $size)
}

$mathIn  = "assets\res\latinmodern-math.otf"
$mathOut = "assets\res\math.woff", "assets\res\math.woff2"

foreach ($out in $mathOut)
{
	$ext = Split-Path -Extension $out
	$ext = $ext.substring(1)

	fonttools `
		subset `
		$mathIn `
		--output-file=$out `
		--flavor=$ext `
		--layout-features='*' `
		--drop-tables+="FFTM, GlyphOrder" `
		--no-recalc-bounds `
		--no-recalc-timestamp `
		--unicodes="u0020-007f" <# 18kb Basic Latin #> `
		<#--unicodes="u00a0-00ff" <# 13kb Latin-1 Supplement #> `
		--unicodes="u0370-03ff" <# 16kb Greek and Coptic #> `
		<#--unicodes="u2070-209f" <#  0kb Superscripts and Subscripts #> `
		<#--unicodes="u2100-214f" <# 16kb Letterlike Symbols #> `
		<#--unicodes="u2190-21ff" <# 14kb Arrows #> `
		--unicodes="u2200-22ff" <# 18kb Mathematical Operators #> `
		<#--unicodes="u2600-26ff" <#  3kb Miscellaneous Symbols #> `
		<#--unicodes="u27c0-27ef" <#  4kb Miscellaneous Mathematical Symbols-A #> `
		--with-zopfli

	$name = Split-Path -Leaf $out
	$size = (Get-Item $out).Length / 1024
	Write-Host ("{0,-12} {1,5:0.0} kb" -f $name, $size)
}
