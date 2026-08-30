# 部署 uni-app H5 产物到服务器 v.joho.cn 站点（C端，joho 主机）
param(
  [string]$Local = "E:\code\shao\dist\build\h5",
  [string]$HostName = "joho",
  [string]$RemoteSite = "/opt/1panel/apps/openresty/openresty/www/sites/v.joho.cn"
)
$ErrorActionPreference = "Stop"

$RemoteIndex = "$RemoteSite/index"
$Tmp = "/tmp/shao_client_upload"

if (-not (Test-Path "$Local\index.html")) {
  throw "本地产物缺失: $Local\index.html"
}
Write-Host "[1/5] 本地产物 OK: $Local"

Write-Host "[2/5] 备份远程站点..."
ssh $HostName "sudo rm -rf $RemoteSite/index_backup && sudo cp -a $RemoteIndex $RemoteSite/index_backup"

Write-Host "[3/5] 上传产物到 $Tmp ..."
ssh $HostName "rm -rf $Tmp && mkdir -p $Tmp"
scp -r -- "${Local}\assets" "${HostName}:${Tmp}/"
if (Test-Path "$Local\static") { scp -r -- "${Local}\static" "${HostName}:${Tmp}/" }
scp -- "${Local}\index.html" "${HostName}:${Tmp}/"
if (Test-Path "$Local\ssr-manifest.json") { scp -- "${Local}\ssr-manifest.json" "${HostName}:${Tmp}/" }

Write-Host "[4/5] 替换站点内容..."
ssh $HostName "cd $RemoteIndex && sudo rm -f index.html ssr-manifest.json && sudo rm -rf assets static && sudo cp -a $Tmp/. ."

Write-Host "[5/5] 校验并清理临时文件..."
$check = ssh $HostName "ls $RemoteIndex/index.html $RemoteIndex/assets >/dev/null && echo SYNC_OK || echo SYNC_FAIL; rm -rf $Tmp"
Write-Host $check
if ($check -notmatch "SYNC_OK") { throw "部署校验失败" }
Write-Host "部署完成: v.joho.cn"
