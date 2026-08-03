---
title: "Postman的使用"
published: 2026-08-01
description: "Postman的使用"
category: "开发工具"
draft: false
---

## 一、Postman是什么？

Postman是一款强大的**API开发与测试工具**，在Java后端开发中主要用于模拟HTTP客户端，用来调试和测试你开发的RESTful API或WebService接口。

它的重要性在于：

-   **独立验证**：不依赖前端页面，单独测试后端接口的**请求、响应、业务逻辑**和**异常处理**是否正确。
-   **问题排查**：快速定位问题是出在**前端调用、网络传输还是后端服务本身**。
-   **协作与文档**：生成并分享接口文档和测试用例，方便团队协作。

官网下载地址：[https://www.postman.com/downloads/](https://www.postman.com/downloads/)

## 二、Postman的基本使用

### 1、登录

Postman是需要登录的，如果不登录，则无法使用Postman的更多功能。比如，保存请求，创建工作空间等功能都无法使用。登录的时候会跳转默认浏览器。如果跳转的默认浏览器不是谷歌浏览器的话，可以按照下图点击 **copy the URL** 将登录路径复制到谷歌浏览器登录即可！

![登录](/uploads/images/2026-03-26/0a28dec9-7f2a-4301-8a14-925a97e879c5.png)

### 2、界面介绍

Postman的主界面主要包含以下几个部分：

![界面介绍](/uploads/images/2026-03-26/1bcd956b-e3a9-47c9-9140-51def5f5b47b.png)

| 区域 | 功能说明 |
| --- | --- |
| 请求区 | 设置请求方法（GET/POST等）、URL、参数、Headers、Body等 |
| 响应区 | 查看服务器返回的响应数据、状态码、响应时间等 |
| 侧边栏 | 管理Collections（集合）、Environments(环境变量)、History（历史记录）等 |

### 3、新建工作空间

通过新建工作空间，可以对请求接口做分类管理。比如你可以去一家公司就新建一个工作空间。当然，你也可以每一个项目就新建一个工作空间。

![新建工作空间](/uploads/images/2026-03-26/599f71c0-6b6e-46c4-a143-5eb94f0fee59.png)

进入如下界面，填写，工作空间名称、描述、可见性等信息。

![新建工作空间2](/uploads/images/2026-03-26/46ab02ae-1024-48e1-b40b-ed95f294da67.png)

### 4、新建集合

新建集合，也可以简单的理解就是建立目录。跟目录不同的是，集合他可以独立导出、生成文档、Mock 与自动化测试。通过合理的目录结构，可以清晰、有序地对接口请求进行分类管理。 若你的工作空间以公司维度划分，则集合可直接用项目名称命名；其下再按功能模块细分子目录。 若工作空间已按项目维度隔离，则集合无需再出现项目名，直接以功能模块命名即可。

![新建集合](/uploads/images/2026-03-26/4f9cb0cb-9e78-474a-a45c-7f0459990955.png)

### 5、新建请求

![新建请求](/uploads/images/2026-03-26/52e3b9a7-9a38-4eb5-9346-9648f598088f.png)

出出现如下界面

![新建请求2](/uploads/images/2026-03-26/39179696-f351-4d53-aa8a-49de7399049a.png)

注意：在 Postman 里，只要新建或修改了请求，不保存就等于“本地草稿”。不ctrl s保存，变更不会上传到云端，账号里仍是旧版本；换电脑、重新登录后，看到的只能是上次保存时的状态——新改的内容全没了。

#### 5.1 GET请求

GET请求用于从服务器获取数据，参数通常通过URL传递。

![GET请求](/uploads/images/2026-03-26/35fd31ea-3101-4cbf-8611-5a46693ea8d1.png)

**URL参数设置方式：**

方式一：直接在URL中拼接参数

```
http://localhost:81/dev-api/system/user/list?pageNum=1&pageSize=10
```

方式二：使用Params面板（推荐）

-   点击 **Params** 按钮
-   在Key-Value表格中输入参数名和值
-   Postman会自动拼接到URL中

#### 2.2 POST请求

POST请求用于向服务器提交数据，数据通常放在请求体（Body）中。

| 类型 | 使用场景 | 示例 |
| --- | --- | --- |
| form-data | 文件上传、表单提交 | multipart/form-data |
| x-www-form-urlencoded | 普通表单提交 | 键值对格式 |
| raw | JSON/XML等格式数据 | application/json |
| binary | 二进制文件上传 | 文件流 |

**JSON格式请求(最常用）：**

![JSON请求体](/uploads/images/2026-03-26/09e5ac46-9397-44a1-88a8-8de7becdd571.png)

文件上传，一般使用**form-data**：

![form-data](/uploads/images/2026-03-26/6a44e5da-f48b-4506-b299-7e7eea667408.png)

#### 2.3 PUT请求

PUT请求用于更新资源，用法与POST类似，数据也放在Body中。

#### 2.4 DELETE请求

DELETE请求用于删除资源，通常参数通过URL传递。

### 6、请求Headers设置

有些接口需要特定的请求头，如Content-Type、Authorization等。

**步骤：**

1.  点击 **Headers** 标签
2.  添加Key-Value对

![Headers设置](/uploads/images/2026-03-26/bfabc145-77c9-448d-8074-a23fdf838017.png)

**常用请求头：**

| Header | 说明 | 示例值 |
| --- | --- | --- |
| Content-Type | 请求内容类型 | application/json |
| Authorization | 认证信息 | Bearer xxxxx |
| Accept | 期望的响应类型 | application/json |
| Token | 自定义令牌 | xxxxx |

### 7、环境变量管理

环境变量可以让同一套请求在不同环境（开发、测试、生产）下快速切换。

#### 7.1 创建环境

![创建环境](/uploads/images/2026-03-26/5b653c61-bf07-4ec9-a647-cfcae574092b.png)

#### 7.2 使用环境变量

在URL、Params、Headers中使用 `{{变量名}}` 格式：

```
{{baseUrl}}/api/user/list
```

![使用环境变量](/uploads/images/2026-03-26/442c1c47-a542-4db8-97da-fa601bb36b99.png)

注意：创建完环境变量之后，一定要ctrl s保存一下。否则，可能在使用该环境变量的时候出现无法使用的情况！

### 8、导出、导入功能

导出、导入功能。可以让你很方便的将别人新建好的接口请求，导入到你自己的postman里面。

#### 5.1 导出

![导出](/uploads/images/2026-03-26/9f53eec8-55c2-4a68-b654-266cbcccb611.png)

进入如下界面,点击 **Export**,便可以导出一份json文件。

![导出2](/uploads/images/2026-03-26/78e3d035-02b4-4fdc-a684-9dee5dae4fb8.png)

#### 5.2 导入

拿到上一步导出的json文件，按照下图在对应工作区间导入即可！

![导入](/uploads/images/2026-03-26/741f7f7c-1816-41bc-b131-1fe04e30d250.png)

### 9、代码生成

Postman可以生成各种语言的调用代码，方便直接复制到项目中。

1.  点击请求右侧的 **</>** 图标
2.  选择目标语言（如 Java - OkHttp）
3.  复制生成的代码

![代码生成](/uploads/images/2026-03-26/7b66457a-b7fb-4808-b104-e2ae9eee24df.png)

### 10、复制key-vlaue参数

![复制参数-1](/uploads/images/2026-03-26/9c037a25-9311-4c91-9be6-acf14df94936.png)

进入如下界面复制即可。

![复制参数-2](/uploads/images/2026-03-26/de9e41dd-2daf-4e97-8c11-792b0b065805.png)

## 五、常见问题

### 1、CORS跨域问题

Postman作为独立工具，**不受浏览器同源策略限制**，不会出现CORS问题。这是Postman相比浏览器直接请求的优势。

### 2、SSL证书验证

如果接口使用自签名证书，可以设置中关闭SSL验证

![关闭ssl](/uploads/images/2026-03-26/48046a93-8b13-485f-95d5-173ff897ab6a.png)

### 3、请求超时

默认超时时间为0（无限），可以在设置中修改：

-   Settings → Request timeout in ms

### 4、中文乱码

响应出现中文乱码时：

1.  检查响应Headers中的Content-Type
2.  确保包含 `charset=utf-8`
