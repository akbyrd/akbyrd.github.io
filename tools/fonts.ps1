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
		--drop-tables="PfEd, BASE" `
		--layout-features="zero, size, case, salt" `
		--unicodes="u0000-00a0,ufeff,ufffd" `
		--unicodes="uf046b,uf033b,uf02a4,uf0ad1,uf0544,uf01ee"
}


$compareIn = @(
	@( "assets\res\compare\CaskaydiaCoveNerdFontMono-Light.ttf",    "Code1" ),
	@( "assets\res\compare\CousineNerdFontMono-Regular.ttf",        "Code2" ),
	@( "assets\res\compare\DejaVuSansMNerdFontMono-Regular.ttf",    "Code3" ),
	@( "assets\res\compare\FantasqueSansMNerdFontMono-Regular.ttf", "Code4" ),
	@( "assets\res\compare\FiraCodeNerdFontMono-Regular.ttf",       "Code5" ),
	@( "assets\res\compare\InconsolataNerdFontMono-Regular.ttf",    "Code6" ),
	@( "assets\res\compare\JetBrainsMonoNerdFontMono-Regular.ttf",  "Code7" ),
	@( "assets\res\compare\MesloLGLNerdFontMono-Regular.ttf",       "Code8" ),
	@( "assets\res\compare\RobotoMonoNerdFontMono-Regular.ttf",     "Code9" )
)

foreach ($compare in $compareIn)
{
	$compareIn = $compare[0]
	$compareOut = "assets\res\$($compare[1]).woff2"

	fonttools `
		subset `
		$compareIn `
		--output-file=$compareOut `
		--flavor="woff2" `
		--with-zopfli `
		--drop-tables="PfEd, BASE" `
		--layout-features="zero, size, case, salt" `
		--unicodes="u0000-00a0,ufeff,ufffd" `
		--unicodes="uf046b,uf033b,uf02a4,uf0ad1,uf0544,uf01ee"
}
