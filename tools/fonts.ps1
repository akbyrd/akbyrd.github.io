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
		--unicodes="ue22e"  <# nf-fae-planet #> `
		--unicodes="uf400"  <# nf-oct-light_bulb #> `
		--unicodes="uf421"  <# nf-oct-alert #> `
		--unicodes="uf426"  <# nf-oct-sign_out #> `
		--unicodes="uf449"  <# nf-oct-info #> `
		--unicodes="uf46e"  <# nf-oct-stop #> `
		--unicodes="uf4a2"  <# nf-oct-smiley #> `
		--unicodes="uf4bb"  <# nf-oct-copy #> `
		--unicodes="uf50a"  <# nf-oct-report #> `
		--unicodes="uf0131" <# nf-md-checkbox_blank_outline #> `
		--unicodes="uf0132" <# nf-md-checkbox_marked #> `
		--unicodes="uf01ee" <# nf-md-email #> `
		--unicodes="uf02a4" <# nf-md-github #> `
		--unicodes="uf033b" <# nf-md-linkedin #> `
		--unicodes="uf0450" <# nf-md-refresh #> `
		--unicodes="uf046b" <# nf-md-rss #> `
		--unicodes="uf0544" <# nf-md-twitter #> `
		--unicodes="uf05d6" <# nf-md-alert_circle_outline #> `
		--unicodes="uf0ad1" <# nf-md-mastodon #> `
<# info #> `
--unicodes="uf0028" <# nf-md-alert_circle #> `
--unicodes="uf05d6" <# nf-md-alert_circle_outline #> `
<# tip #> `
--unicodes="uea61"  <# nf-cod-lightbulb #> `
--unicodes="uf0eb"  <# nf-fa-lightbulb #> `
--unicodes="uf0335" <# nf-md-lightbulb #> `
--unicodes="uf0eb"  <# nf-fa-lightbulb_o #> `
--unicodes="uf19e1" <# nf-md-lightbulb_alert #> `
--unicodes="uf06e8" <# nf-md-lightbulb_on #> `
--unicodes="uf0336" <# nf-md-lightbulb_outline #> `
--unicodes="uf1802" <# nf-md-lightbulb_variant #> `
--unicodes="uf19e2" <# nf-md-lightbulb_alert_outline #> `
--unicodes="uf06e9" <# nf-md-lightbulb_on_outline #> `
--unicodes="uf1803" <# nf-md-lightbulb_variant_outline #> `
<# important #> `
--unicodes="uf017d" <# nf-md-comment_alert #> `
--unicodes="uf0362" <# nf-md-message_alert #> `
--unicodes="uf0a04" <# nf-md-message_alert_outline #> `
--unicodes="uf0ce4" <# nf-md-alert_box_outline #> `
--unicodes="uf11ce" <# nf-md-alert_rhombus #> `
--unicodes="uf11cf" <# nf-md-alert_rhombus_outline #> `
<# warning #> `
--unicodes="uf40c"  <# nf-oct-alert_fill #> `
--unicodes="uea6c"  <# nf-cod-warning #> `
--unicodes="uf071"  <# nf-fa-warning #> `
--unicodes="ue654"  <# nf-seti-error #> `
--unicodes="uf0026" <# nf-md-alert #> `
--unicodes="uf002a" <# nf-md-alert_outline #> `
<# caution #> `
--unicodes="uea87"  <# nf-cod-error #> `
--unicodes="uebfb"  <# nf-cod-error_small #> `
--unicodes="uf0029" <# nf-md-alert_octagon #> `
<# #>

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
		--unicodes="u0020-007f"     <#  18kb Basic Latin #> `
		<#--unicodes="u00a0-00ff"   <#  13kb Latin-1 Supplement #> `
		--unicodes="u0370-03ff"     <#  16kb Greek and Coptic #> `
		<#--unicodes="u2070-209f"   <#   0kb Superscripts and Subscripts #> `
		<#--unicodes="u2100-214f"   <#  16kb Letterlike Symbols #> `
		<#--unicodes="u2190-21ff"   <#  14kb Arrows #> `
		--unicodes="u2200-22ff"     <#  18kb Mathematical Operators #> `
		<#--unicodes="u2600-26ff"   <#   3kb Miscellaneous Symbols #> `
		<#--unicodes="u27c0-27ef"   <#   4kb Miscellaneous Mathematical Symbols-A #> `
		<#--unicodes="u1d400-1d7ff" <# 214kb Mathematical Alphanumeric Symbols #> `
		--unicodes="u1d434-1d467"   <#  21kb Mathematical Alphanumeric Symbols (just italics) #> `
		--with-zopfli

	$name = Split-Path -Leaf $out
	$size = (Get-Item $out).Length / 1024
	Write-Host ("{0,-12} {1,5:0.0} kb" -f $name, $size)
}
