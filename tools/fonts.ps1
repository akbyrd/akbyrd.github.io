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
		--unicodes="uf046b,uf033b,uf02a4,uf0ad1,uf0544,uf01ee,uf4bb"

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
		--unicodes='*' `
		--drop-tables+="FFTM, GlyphOrder" `
		--no-recalc-bounds `
		--no-recalc-timestamp `
		--with-zopfli

	$name = Split-Path -Leaf $out
	$size = (Get-Item $out).Length / 1024
	Write-Host ("{0,-12} {1,5:0.0} kb" -f $name, $size)
}
