$codeIn  = "assets\res\SauceCodeProNerdFontMono-Regular.ttf"
$codeOut = "assets\res\Code.woff", "assets\res\Code.woff2"

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
		--layout-features="zero" `
		--unicodes="u0000-00a0,ufeff,ufffd" `
		--unicodes="uf046b,uf033b,uf02a4,uf0ad1,uf0544,uf01ee"
}
