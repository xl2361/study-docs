---
title: "Claude Code集成DeepSeek V4 pro"
published: 2026-08-01
description: "Claude Code集成DeepSeek V4 pro"
category: "AI工具"
draft: false
---

## 准备工作

前往 DeepSeek 官网 [https://platform.deepseek.com/usage](https://platform.deepseek.com/usage) 创建 API Key，并确保账户余额充足。

![1](/uploads/images/2026-05-24/c7ca71d7-1044-4123-b9e7-b3ace0c7a9fc.png)

## 一、直接修改配置文件

Claude Code 的核心配置存储在用户目录下的 `settings.json` 中：

**路径**：`C:\Users\你的用户名\.claude\settings.json`

如果文件不存在，请手动创建。用文本编辑器打开该文件，填入以下内容：

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "your_deepseek_api_key",
    "ANTHROPIC_BASE_URL": "https://api.deepseek.com/anthropic",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "deepseek-v4-flash",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "deepseek-v4-pro[1m]",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "deepseek-v4-pro[1m]",
    "ANTHROPIC_MODEL": "deepseek-v4-pro[1m]",
    "ANTHROPIC_REASONING_MODEL": "deepseek-v4-pro[1m]"
  }
}
```

## 二、使用 cc-switch（多模型切换工具）

如果你需要在 Claude Code 中集成多个模型并频繁切换，每次都手动修改配置文件会非常繁琐。cc-switch 正是为了解决这个问题而生的。当然，如果你只固定使用一个模型，可以跳过这一步。

### 1\. 安装 cc-switch

前往 [https://github.com/farion1231/cc-switch/releases](https://github.com/farion1231/cc-switch/releases) 下载 Windows 版（.msi 后缀），双击安装即可。

![2](/uploads/images/2026-05-24/769ffd8c-f8b5-428c-9b3d-2c494e5a3e90.png)

### 2\. 添加 DeepSeek 供应商

![3](/uploads/images/2026-05-24/ee50d3a8-2194-4aad-8fe2-2bb78c0c3968.png)

### 3\. 配置 DeepSeek V4 Pro

![4](/uploads/images/2026-05-24/f1b7e062-475e-437f-aad2-226c6a789661.png)

需要配置的信息如下：

| 配置项 | 内容/值 |
| --- | --- |
| 供应商名称 | DeepSeek V4 Pro(任意起，通过名字知道自己用的哪个模型即可) |
| 备注 | （空） |
| 官网链接 | （空） |
| API Key | 填写你的 API Key |
| 请求地址 | https://api.deepseek.com/anthropic |
| API 格式 | Anthropic Messages (原生) |
| 认证字段 | ANTHROPIC_AUTH_TOKEN（默认） |
| 主模型 | deepseek-v4-pro[1m] |
| 推理模型 (Thinking) | deepseek-v4-pro[1m] |
| Haiku 默认模型 | deepseek-v4-flash |
| Sonnet 默认模型 | deepseek-v4-pro[1m] |
| Opus 默认模型 | deepseek-v4-pro[1m] |
| 写入通用配置 | ✅ 勾选 |
| 高强度思考 | ✅ 勾选 |

### 4\. 验证配置

点击下图模型名称旁边的测试按钮：

![5](/uploads/images/2026-05-24/4f679b0f-182f-45bc-ba7f-18a62264b028.png)

出现如下结果即表示配置成功。此时点击供应商右侧的"启用"，即可使用 DeepSeek V4 Pro 模型。

![6](/uploads/images/2026-05-24/393988f3-87a9-4d01-8cb0-871cd24c69d5.png)

## 三、启动与使用

配置完成后，在项目目录下执行以下命令启动 Claude Code（底层已自动切换为 DeepSeek）：

```bash
claude
```

### 常见问题：模型不匹配报错

如果你在已打开的 Claude Code 会话中通过 cc-switch 切换了模型，继续使用当前会话可能会报如下错误：

![7](/uploads/images/2026-05-24/6a188516-dce6-4400-bde2-277b675b5ef7.png)

这是因为当前会话仍在使用旧的模型（如图中的 glm-5.1），而新配置的供应商只支持 `deepseek-v4-pro` 或 `deepseek-v4-flash`。此时使用 `/model` 命令重新选择模型即可：

![8](/uploads/images/2026-05-24/eeaa177b-f163-4f4f-8751-358d7f65cb90.png)

选择第二个模型，回车，再次提问"你是？"，即可得到正确响应。

![9](/uploads/images/2026-05-24/6f0d40c1-1e16-47f1-a33f-cb41d8b810f2.png)
