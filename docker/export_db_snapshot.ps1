param(
    [string]$SnapshotPath = "../Data/db_snapshots/exam_e_snapshot.sql"
)

$ErrorActionPreference = "Stop"

$dir = Split-Path -Parent $SnapshotPath
if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
}

Write-Output "Exporting database snapshot to $SnapshotPath ..."
docker compose exec -T db pg_dump -U postgres -d exam_e --clean --if-exists | Out-File -FilePath $SnapshotPath -Encoding utf8
Write-Output "Snapshot export complete."
