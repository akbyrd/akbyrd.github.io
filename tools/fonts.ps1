$symbolsIn  = "assets\res\SauceCodeProNerdFontPropo-Regular.ttf"
$symbolsOut = "assets\res\Symbols.woff", "assets\res\Symbols.woff2"

foreach ($out in $symbolsOut)
{
	fonttools `
		subset `
		$symbolsIn `
		--output-file=$out `
		--verbose `
		--unicodes="uf09e,uf033b,uf02a4,uf0ad1,uf0544,uf01ee"
}
