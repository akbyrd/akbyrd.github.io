$symbolsIn  = "assets\res\SauceCodeProNerdFontPropo-Regular.ttf"
$symbolsOut = "assets\res\Symbols.woff", "assets\res\Symbols.woff2"
$codeIn     = "assets\res\SauceCodeProNerdFont-Regular.ttf"
$codeOut    = "assets\res\Code.woff", "assets\res\Code.woff2"

foreach ($out in $symbolsOut)
{
	$ext = Split-Path -Extension $out
	$ext = $ext.substring(1)

	fonttools `
		subset `
		$symbolsIn `
		--output-file=$out `
		--flavor=$ext `
		--with-zopfli `
		--unicodes="uf046b,uf033b,uf02a4,uf0ad1,uf0544,uf01ee"
}

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
		--layout-features-="frac,numr,dnom" `
		--unicodes="u0000-00a0,ufeff,ufffd"
}
