$assets = "themes\akbyrd\assets"
$filename = $args[0]

function Convert-ImageMagick
{
	$magick  = "tools\imagemagick\magick.exe"
	$input   = $filename
	$output1 = "$assets\favicon.svg"
	$output2 = "$assets\favicon.ico"
	$output3 = "$assets\apple-touch-icon.png"

	Remove-Item -ErrorAction SilentlyContinue $output1
	Remove-Item -ErrorAction SilentlyContinue $output2
	Remove-Item -ErrorAction SilentlyContinue $output3

	Copy-Item $input $output1
	& $magick -size 32x32 -background none $input $output2
	& $magick -background none `
		-size 400x400 "radial-gradient:white-#70809080" `
		-gravity center -crop "180x180+0+0" `
		-size 140x140 -gravity center $input `
		-composite $output3
}

function Convert-Inkscape
{
	# NOTE: Verions 1.3.2
	$inkscape = "C:\Program Files\Inkscape\bin\inkscape.com"
	$magick   = "tools\imagemagick\magick.exe"
	$input    = $filename
	$output1  = "$assets\favicon.svg"
	$output2  = "$assets\favicon.png"
	$output3  = "$assets\favicon.ico"
	$output4  = "$assets\apple-touch-icon.png"

	Remove-Item -ErrorAction SilentlyContinue $output1
	Remove-Item -ErrorAction SilentlyContinue $output2
	Remove-Item -ErrorAction SilentlyContinue $output3
	Remove-Item -ErrorAction SilentlyContinue $output4

	Copy-Item $input $output1
	& $inkscape $input -o $output4 --export-width=180 --export-height=180 --export-area=-4:-4:36:36 --export-background=white
	& $inkscape $input -o $output2 --export-width=32 --export-height=32
	& $magick $output2 $output3

	Remove-Item -ErrorAction SilentlyContinue $output2
}

function Generate-Inkscape
{
	$inkscapeDir = "C:\Program Files\Inkscape"
	$inkscape    = "$inkscapeDir\bin\inkscape.com"
	$python      = "$inkscapeDir\bin\python.exe"
	$scour       = "$inkscapeDir\share\inkscape\extensions\output_scour.py"
	$input       = "$assets\icons\source.svg"
	$output      = $filename

	Remove-Item -ErrorAction SilentlyContinue $output

	& $inkscape $input -o $output --export-plain-svg --export-text-to-path

	& $python $scour `
		--set-precision=3 `
		--enable-comment-stripping=true `
		--enable-id-stripping=true `
		--protect-ids-prefix=lb `
		--line-breaks=true `
		--indent=tab `
		--nindent=1 `
		--strip-xml-space=true `
		--output $output `
		$output
}

Convert-ImageMagick
#Convert-Inkscape
#Generate-Inkscape
