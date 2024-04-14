Add-Type -AssemblyName PresentationCore

$dir = "assets\res\compare"
$files = Get-ChildItem $dir
foreach ($file in $files)
{
	#Write-Host (Split-Path $file -Leaf)
	#$family = New-Object System.Windows.Media.FontFamily -ArgumentList $file
	#foreach ($typeface in $family.FamilyTypeFaces)
	#{
		#$xHeightRatio = $typeface.XHeight / $typeface.CapsHeight
		#Write-Host $typeface.XHeight $typeface.CapsHeight $xHeightRatio $typeface.AdjustedFaceNames
	#}
	#Write-Host

	$uri = New-Object System.Uri -ArgumentList "file://$file"
	$typeface = New-Object System.Windows.Media.GlyphTypeface -ArgumentList $uri
	$xHeightRatio = $typeface.XHeight / $typeface.CapsHeight
	#Write-Host $typeface | Format-Table -Property *
	#Write-Host $typeface.Height $typeface.GlyphCount
	#Write-Host $typeface.XHeight $typeface.CapsHeight $xHeightRatio
	Write-Host ("{0:0.000} {1:0.000} {2:0.000}" -f $typeface.XHeight, $typeface.CapsHeight, ($typeface.XHeight / $typeface.CapsHeight)) (Split-Path $file -Leaf)
	#Write-Host
}
