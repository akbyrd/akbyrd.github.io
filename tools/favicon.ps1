$input_svg = $args[0]

function Generate-Favicons
{
	$magick      = "tools\imagemagick\magick.exe"
	$inkscapeDir = "C:\Program Files\Inkscape"
	$inkscape    = "$inkscapeDir\bin\inkscape.com"
	$python      = "$inkscapeDir\bin\python.exe"
	$scour       = "$inkscapeDir\share\inkscape\extensions\output_scour.py"

	$assets       = "assets"
	$output_svg   = "$assets\res\favicon.svg"
	$output_png   = "$assets\res\favicon.png"
	$output_ico   = "$assets\favicon.ico"
	$output_apple = "$assets\res\apple-touch-icon.png"
	$output_og    = "$assets\res\favicon-og.png"

	Remove-Item -ErrorAction SilentlyContinue $output_svg
	Remove-Item -ErrorAction SilentlyContinue $output_ico
	Remove-Item -ErrorAction SilentlyContinue $output_apple
	Remove-Item -ErrorAction SilentlyContinue $output_og

	& $inkscape $input_svg -o $output_svg --export-plain-svg --export-text-to-path

	& $python $scour `
		--set-precision=3 `
		--enable-comment-stripping=true `
		--enable-id-stripping=true `
		--protect-ids-prefix=lb `
		--line-breaks=true `
		--indent=tab `
		--nindent=1 `
		--strip-xml-space=true `
		--output $output_svg `
		$output_svg

	& $magick -size 368x368 -background none $output_svg -gravity Center -extent 512x512 $output_png
	& $magick -size 1200x500 -background none $output_svg -gravity Center -extent 1200x630 $output_og
	& $magick -size 32x32 -background none $output_svg $output_ico

	& $magick `
		-size 400x400 "radial-gradient:white-#70809080" `
		-gravity Center -crop "180x180+0+0" `
		`
		-background none `
		-size 140x140 $output_svg `
		`
		-background white `
		-quality 91 `
		-depth 8 `
		-strip `
		-composite $output_apple

	# NOTE: Manually clean up the final svg
}

Generate-Favicons
