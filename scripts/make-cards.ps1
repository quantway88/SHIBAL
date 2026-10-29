$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$out=Join-Path $PSScriptRoot '../assets/cards'
[System.IO.Directory]::CreateDirectory($out) | Out-Null
$variants=@(@('18','#FF866D','A LITTLE NUDGE.'),@('180','#B9AFE9','TEN TIMES THE CHEEK.'),@('1800','#F5CD58','BIG REACTION ENERGY.'),@('28','#A6D6C1','A DIFFERENT KIND OF HELLO.'))
foreach($v in $variants){
 $bmp=New-Object System.Drawing.Bitmap 1200,630
 $g=[System.Drawing.Graphics]::FromImage($bmp)
 $g.SmoothingMode='AntiAlias'
 $g.TextRenderingHint='AntiAliasGridFit'
 $g.Clear([System.Drawing.ColorTranslator]::FromHtml($v[1]))
 $ink=New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#3C2926'))
 $cream=New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#FFF8E9'))
 $pen=New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#3C2926')),10
 $small=New-Object System.Drawing.Font 'Arial',22,([System.Drawing.FontStyle]::Bold)
 $label=New-Object System.Drawing.Font 'Arial',28,([System.Drawing.FontStyle]::Bold)
 $g.DrawString('SHIBAL  /  A TOKEN OF REACTION',$small,$ink,55,35)
 $g.FillEllipse($cream,1020,25,105,105)
 $g.DrawString(':-P',$label,$ink,1035,53)
 $gp=New-Object System.Drawing.Drawing2D.GraphicsPath
 $sf=New-Object System.Drawing.StringFormat
 $sf.Alignment='Center';$sf.LineAlignment='Center'
 $rect=New-Object System.Drawing.RectangleF 45,100,1110,360
 $size=if($v[0].Length -gt 3){280}else{330}
 $gp.AddString($v[0],(New-Object System.Drawing.FontFamily 'Arial Black'),0,$size,$rect,$sf)
 $g.DrawPath($pen,$gp);$g.FillPath($cream,$gp)
 # A small face changes expression with each amount; original vector geometry.
 $g.FillEllipse($ink,560,388,15,21);$g.FillEllipse($ink,616,388,15,21)
 if($v[0] -eq '28'){$g.DrawArc($pen,580,414,35,18,180,160)}else{$g.DrawArc($pen,580,409,35,24,0,180)}
 $g.DrawString($v[2],$label,$ink,55,490)
 $g.DrawLine($pen,55,553,1145,553)
 $g.DrawString('DEVNET GIFT  /  NO MONETARY VALUE',$small,$ink,55,578)
 $bmp.Save((Join-Path $out ($v[0]+'-v1.png')),[System.Drawing.Imaging.ImageFormat]::Png)
 $gp.Dispose();$sf.Dispose();$small.Dispose();$label.Dispose();$pen.Dispose();$cream.Dispose();$ink.Dispose();$g.Dispose();$bmp.Dispose()
}
