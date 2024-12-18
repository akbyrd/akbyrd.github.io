$in = Resolve-Path $args[0]

$out1 = [System.IO.Path]::ChangeExtension($in, "der")
openssl pkcs8 -nocrypt -topk8 `
	-inform PEM -in $in `
	-outform DER -out $out1

$out2 = [System.IO.Path]::ChangeExtension($in, "pkcs1.b64")
$bytes = [System.IO.File]::ReadAllBytes($out1)
$b64 = [Convert]::ToBase64String($bytes)
Set-Content $out2 $b64
