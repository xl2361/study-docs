---
title: "Claude Code本地安装与配置国产智谱模型"
published: 2026-08-01
description: "Claude Code本地安装与配置国产智谱模型"
category: "AI工具"
draft: false
---

**准备工作**

在开始之前，请确保你的电脑上已经安装了 Node.js（建议 18.0 或更高版本）和 Git 。

确认安装node

![1](/uploads/images/2026-05-23/e83edb37-8322-4054-be20-81d7bd03668e.png)

确认安装git

![10](/uploads/images/2026-05-23/df4ee0c4-6196-4c40-a179-e2ccdd070586.png)

### 一、安装

打开你的终端（Terminal）或命令行工具，输入以下命令。我们使用 npm 进行全局安装，这样你就可以在任何目录下呼出 Claude 了。

```
# 全局安装 Claude Code 核心组件
npm install -g @anthropic-ai/claude-code
```

注意：如果安装速度较慢，可以考虑切换 npm 的国内镜像源（如淘宝镜像）来加速下载。

### 二、验证安装完整性

安装完成后，我们需要确认工具是否已成功装入你的系统。在终端中输入以下指令来查看当前版本：

```bash
# 查看版本号，验证是否安装成功
claude --version
```

如果终端成功返回了一串版本号（如下图所示），那么恭喜你，核心组件已经安装就绪！

![1](/uploads/images/2026-05-23/cddc1194-09b6-41cf-9dc4-6d945d5e0168.png)

### 三、绕过区域限制协议

由于一些网络或区域的限制，部分小伙伴直接使用时可能会遇到连接超时或报错的问题。这个时候可以通过配置一个专属脚本来启动 Claude Code，完美且优雅地绕过区域限制。

![1](/uploads/images/2026-05-23/2c700af9-066f-424b-b285-3d0e29db5cae.png)

#### 1、创建专属启动脚本

在你的电脑里找一个安全的文件夹（比如 C:\\scripts），新建一个文本文件，命名为 cld.bat，然后将以下代码复制进去并保存：

```bash
@echo off
:: 1. 切换控制台编码为 UTF-8，确保中文显示正常
chcp 65001 >nul
 
:: 2. 设置局部环境变量 (仅对当前进程及其子进程有效)
:: 请确保 1080 与你的 Shadowrocket 本地代理端口一致
set ALL_PROXY=socks5://127.0.0.1:1080
 
echo [Claude CLI] 代理隧道已建立 (Port:1080)...
 
:: 3. 动态寻找并执行原始的 claude 程序
:: %* 允许你传递所有参数，如 cl /doctor 或 cl "explain this code"
for /f "delims=" %%i in ('where claude') do (
    "%%i" %*
    goto :finish
)
:finish
:: 脚本结束，变量自动销毁，不影响系统其他程序
```

#### 2、配置系统环境变量

将存放 cld.bat 的文件夹路径（比如 C:\\scripts），添加到你的 Windows 系统环境变量 Path 中。 这样做的目的是，让你可以在系统的任意目录下直接执行该脚本。

#### 3、通过脚本启动

以后在任何项目文件夹下打开终端，不要再输入 claude，而是直接输入 cld！ 这样启动的 Claude Code 就自带代理，完美绕过区域限制。

首次启动时，会出现以下几个初始化界面：

主题设置：询问你终端的主题颜色和文本样式，直接按回车选择默认即可。

![4](/uploads/images/2026-05-23/b8ac20f2-71f5-4b91-abc1-bbbee64e5c73.jpg)

安全指南：系统安全提示，直接按回车

![5](/uploads/images/2026-05-23/d51a07e1-f7fb-4955-8448-cf8267dd5b4c.png)

工作区信任确认：询问你是否信任当前代码文件夹，选择第一项 Yes, I trust this folder，回车即可。

![6](/uploads/images/2026-05-23/e8e9250e-b520-40b4-91cf-c36b8f0aef0f.jpg)

四、配置国产智普模型 如果你不想一直挂着代理，或者觉得官方 API 成本太高，我们可以直接修改底层配置，将其无缝切换 为国内的智谱大模型 (GLM)。使用国产模型，也不会出现区域限制问题，也就不需要通过脚本启动来绕过区域限制。

打开以下路径的配置文件（如果没有 settings.json 文件则手动新建一个）：

Windows 路径：C:\\Users\\你的用户名\\.claude\\settings.json

用代码编辑器打开它，编写如下参数（请将 your\_zhipu\_api\_key 替换为你自己在智谱开放平台申请的真实 API Key）：

```bash
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://open.bigmodel.cn/api/anthropic",
    "ANTHROPIC_AUTH_TOKEN": "your_zhipu_api_key",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-4.5-air",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "glm-5-turbo",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "glm-5.1"
  }
}
```

配置保存后，再次在终端唤醒 Claude Code，就可以使用智谱了！

### 四、卸载

```bash
# 卸载命令，cmd窗口执行
npm uninstall -g @anthropic-ai/claude-code
```

![7](/uploads/images/2026-05-23/e1ed24fa-578e-4c0b-bdd3-8f3895ebaad4.png)

这个卸载完成之后还要 将 Windows 路径：C:\\Users\\你的用户名\\.claude\\ 的该目录删除
