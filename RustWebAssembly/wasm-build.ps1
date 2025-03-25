#!/usr/bin/env pwsh
# wasm-build.ps1 - WebAssembly 构建脚本

# 设置错误处理
$ErrorActionPreference = "Stop"

# 版本信息
$Version = "0.1.0"
$BuildDate = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# 颜色函数
function Write-ColorText {
    param (
        [Parameter(Mandatory=$true)]
        [string]$Text,
        [Parameter(Mandatory=$false)]
        [string]$ForegroundColor = "White"
    )
    Write-Host $Text -ForegroundColor $ForegroundColor
}

# 打印标题
function Print-Header {
    Write-ColorText "`n===========================================" "Cyan"
    Write-ColorText "  WebAssembly 构建工具 v$Version" "Cyan"
    Write-ColorText "  构建时间: $BuildDate" "Cyan"
    Write-ColorText "===========================================" "Cyan"
    Write-ColorText ""
}

# 检查命令是否存在
function Check-Command {
    param (
        [Parameter(Mandatory=$true)]
        [string]$Command,
        [Parameter(Mandatory=$true)]
        [string]$Name,
        [Parameter(Mandatory=$false)]
        [string]$InstallInstructions
    )
    
    $exists = $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
    
    if (-not $exists) {
        Write-ColorText "错误: 找不到 $Name" "Red"
        if ($InstallInstructions) {
            Write-ColorText "安装指南: $InstallInstructions" "Yellow"
        }
        exit 1
    }
    
    Write-ColorText "✓ 已找到 $Name" "Green"
    return $true
}

# 主函数
function Main {
    param (
        [Parameter(Mandatory=$false)]
        [string]$Target = "release",
        [Parameter(Mandatory=$false)]
        [switch]$Clean,
        [Parameter(Mandatory=$false)]
        [switch]$Help
    )
    
    Print-Header
    
    # 显示帮助
    if ($Help) {
        Show-Help
        exit 0
    }
    
    # 检查必要工具
    Write-ColorText "正在检查必要工具..." "White"
    Check-Command "cargo" "Rust 工具链" "安装 Rust: https://www.rust-lang.org/tools/install"
    Check-Command "wasm-pack" "wasm-pack" "安装 wasm-pack: cargo install wasm-pack"
    
    # 设置环境变量
    $env:RUSTFLAGS = "--cfg=web_sys_unstable_apis"
    
    # 设置路径
    $scriptDir = $PSScriptRoot
    $audioProcessorDir = Join-Path $scriptDir "audio_processor"
    $outputDir = Join-Path $scriptDir "dist"
    $targetDir = Join-Path $audioProcessorDir "pkg"
    $frontendDir = Join-Path $scriptDir ".." "web-client" "public" "wasm"
    
    # 显示构建信息
    Write-ColorText "`n构建信息:" "White"
    Write-ColorText "- 源码目录: $audioProcessorDir" "White"
    Write-ColorText "- 输出目录: $outputDir" "White"
    Write-ColorText "- 目标: $Target" "White"
    
    # 清理
    if ($Clean) {
        Write-ColorText "`n正在清理旧文件..." "Yellow"
        if (Test-Path $outputDir) {
            Remove-Item -Recurse -Force $outputDir
        }
        if (Test-Path $targetDir) {
            Remove-Item -Recurse -Force $targetDir
        }
    }
    
    # 创建输出目录
    if (-not (Test-Path $outputDir)) {
        New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
    }
    
    # 创建前端 wasm 目录
    if (-not (Test-Path $frontendDir)) {
        New-Item -ItemType Directory -Path $frontendDir -Force | Out-Null
    }
    
    try {
        # 编译 WebAssembly
        Push-Location $audioProcessorDir
        Write-ColorText "`n正在构建 WebAssembly 模块..." "White"
        
        # 选择目标
        $buildProfile = if ($Target -eq "release") { "--release" } else { "--dev" }
        
        # 构建命令
        $buildResult = wasm-pack build $buildProfile --target web
        
        # 检查构建结果
        if ($LASTEXITCODE -ne 0) {
            Write-ColorText "构建失败: $buildResult" "Red"
            exit 1
        }
        
        Write-ColorText "✓ WebAssembly 构建成功" "Green"
        
        # 复制文件到输出目录
        Write-ColorText "`n正在复制文件到输出目录..." "White"
        Copy-Item -Path "$targetDir/*" -Destination $outputDir -Recurse -Force
        
        # 复制文件到前端目录
        Write-ColorText "正在复制文件到前端目录..." "White"
        Copy-Item -Path "$targetDir/*" -Destination $frontendDir -Recurse -Force
        
        Write-ColorText "✓ 文件复制完成" "Green"
        
        # 输出文件列表
        Write-ColorText "`n已生成的文件:" "White"
        Get-ChildItem -Path $outputDir | ForEach-Object {
            Write-ColorText "- $($_.Name)" "White"
        }
    }
    catch {
        Write-ColorText "错误: $_" "Red"
        exit 1
    }
    finally {
        Pop-Location
    }
    
    Write-ColorText "`n✓ 构建流程完成" "Green"
    Write-ColorText "===========================================" "Cyan"
}

# 显示帮助
function Show-Help {
    Write-ColorText "用法: ./wasm-build.ps1 [选项]" "White"
    Write-ColorText "`n选项:" "White"
    Write-ColorText "  -Target <release|debug>  构建目标 (默认: release)" "White"
    Write-ColorText "  -Clean                   清理旧文件" "White"
    Write-ColorText "  -Help                    显示帮助" "White"
    
    Write-ColorText "`n示例:" "White"
    Write-ColorText "  ./wasm-build.ps1 -Target release -Clean" "White"
    Write-ColorText "  ./wasm-build.ps1 -Target debug" "White"
}

# 调用主函数并传递参数
Main @args 