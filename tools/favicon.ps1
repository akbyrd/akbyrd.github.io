$assets = "themes\akbyrd\assets"

function Convert-ImageMagick
{
	$magick  = "tools\imagemagick\magick.exe"
	$input   = "$assets\icon.svg"
	$output1 = "$assets\favicon.ico"
	$output2 = "$assets\apple-touch-icon.png"

	Remove-Item -ErrorAction SilentlyContinue $output1
	Remove-Item -ErrorAction SilentlyContinue $output2

	& $magick -size 32x32 $input $output1
	& $magick -size 180x180 $input $output2
}

function Convert-Inkscape
{
	# NOTE: Verions 1.3.2
	$inkscape = "C:\Program Files\Inkscape\bin\inkscape.com"
	$magick   = "tools\imagemagick\magick.exe"
	$input    = "$assets\icons\arial.svg"
	$output1  = "$assets\favicon.svg"
	$output2  = "$assets\favicon.png"
	$output3  = "$assets\favicon.ico"
	$output4  = "$assets\apple-touch-icon.png"

	Remove-Item -ErrorAction SilentlyContinue $output1
	Remove-Item -ErrorAction SilentlyContinue $output2
	Remove-Item -ErrorAction SilentlyContinue $output3
	Remove-Item -ErrorAction SilentlyContinue $output4

	#& $inkscape $input -o $output1 --export-plain-svg --export-text-to-path

	Copy-Item $input $output1
	& $inkscape $input -o $output4 --export-width=180 --export-height=180 --export-area=-4:-4:36:36 --export-background=white
	& $inkscape $input -o $output2 --export-width=32 --export-height=32
	& $magick $output2 $output3

	Remove-Item -ErrorAction SilentlyContinue $output2
}

function Convert-RSVG
{
	$rsvg   = "tools\rsvg-convert.exe"
	$input  = "$assets\icon.svg"
	$output = "$assets\rsvg.png"

	& $rsvg $input -o $output -b white --page-height 48 --page-width 48 --top 17 --left 8
}

#Convert-ImageMagick
Convert-Inkscape
#Convert-RSVG
