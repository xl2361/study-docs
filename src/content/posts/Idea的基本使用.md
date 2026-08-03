---
title: "Idea的基本使用"
published: 2026-08-01
description: "Idea的基本使用"
category: "开发工具"
draft: false
---

### 一、idea是什么？

IDEA”常常特指 **IntelliJ IDEA**，这是一款功能强大的集成开发环境。它由JetBrains开发，尤其受Java开发者欢迎，以其**智能代码补全、代码分析和重构功能**而闻名。它也支持Kotlin、Python等多种语言和框架。IDEA正常情况下是需要破解才可以永久使用，按照网上破解教程破解即可！

### 二、idea常见操作

#### 1、打开一个工程

1.1、按照下图打开一个工程

![打开项目](/uploads/images/2026-03-25/dce3db36-78a6-419a-9a6c-94c92893a7d7.png)

1.2、选择要打开的工程，点击 **Select Folder**

![打开项目2](/uploads/images/2026-03-25/6a2ae958-2be3-4e3c-8cfd-a629167df23d.png)

1.3、根据当前工程类型选择对应的打开方式

![打开项目3](/uploads/images/2026-03-25/400c9041-5991-48a9-b395-beae18ae21e5.png)

-   有 pom.xml → Maven 工程
-   有 build.gradle / settings.gradle → Gradle 工程
-   有 .project + .classpath → Eclipse 工程
-   上面全没有，只有 src 文件夹 → 裸源码（普通 Java 工程）

#### 2、设置当前工程的JDK版本

如果当前工程的JDK版本为1.8，则以下几处地方均需要设置。

-   设置Project里面的JDK版本
    
    Ctrl+Alt+Shift+S打开如下界面，设置工程的JDK版本。
    

![设置JDK版本](/uploads/images/2026-03-25/06797146-0109-4f9c-8ed0-a048106d2ecc.png)

-   设置Modules里面JDK版本
    
    Ctrl+Alt+Shift+S打开如下界面，可以在下图界面设置工程里面对应模块的JDK版本。
    

![设置JDK版本2](/uploads/images/2026-03-25/b6ce59a4-134a-4b24-bc7b-b257e64cf85a.png)

-   设置编译的JDK版本

![设置JDK版本3](/uploads/images/2026-03-25/59572d81-f194-4949-af90-e2de04e5b150.png)

#### 3、配置启动类

![启动类配置](/uploads/images/2026-03-25/0515ff48-767c-49ae-b840-47b29ec59d40.png)

#### 4、插件的安装

![安装插件](/uploads/images/2026-03-25/b2d2703a-4056-4d37-b7c9-b2bf82298fe8.png)

#### 5、添加Service窗口

在SpringCloud项目中由于微服务模块很多,此时使用IDEA提供的Service界面可以很方便的可以看的当前工程下有哪些可启动模块，以及这些模块的运行状态和端口。还可以右击下面对应模块的启动类，选择 Jump to source 进入该启动类。

![添加service窗口](/uploads/images/2026-03-25/26b0da52-35d5-403e-98ef-c9655a56f45f.png)

首次添加可以使用Alt 8 快捷键，来添加service窗口，添加步骤如下：

![添加service窗口2](/uploads/images/2026-03-25/20ef6024-e278-4556-b119-131b37bdcd45.png)

![添加service窗口3](/uploads/images/2026-03-25/ed8406a8-1f2c-4fda-9fb6-ba58d0e49eee.png)

#### 6、当前文件里面查找、替换操作

1）ctrl f 查找

![查找当前文件内容](/uploads/images/2026-03-25/af9ea083-a91f-4761-b374-c7531da03ce8.png)

2）ctrl r 替换，也可以使用这个来查找

![替换当前文件内容](/uploads/images/2026-03-25/13c21cdf-5e56-494e-afd2-29d1cefb9143.png)

#### 7、全局查找、替换

1）查找

ctrl shift f 全局文件查找，查找范围：整个项目/指定目录 **全部文件**（含源码、配置、XML、JS、MD…）

![全局查找](/uploads/images/2026-03-25/2c0ead7b-0289-4e37-9cdc-a0a706eefab9.png)

双击 shift 查找文件, 这个搜索功能的范围几乎涵盖了整个 IDE 的内容，包括项目代码、菜单项、工具窗口、设置和更多。

![全局查找2](/uploads/images/2026-03-25/8df5dbe8-aca0-4975-b525-751a7f89aa38.png)

2）ctrl shift r 替换，也可以使用这个来查找

![全局替换](/uploads/images/2026-03-25/f8bab816-512f-4326-96ca-4139409ab742.png)

#### 8、查看当前类、方法、变量在哪里使用

1）查看类、方法使用处

光标放到你要查看的类或者方法上，按住ctrl键，再点击鼠标左击即可查看当前类或者方法在哪些地方使用。

![查看类、方法引用](/uploads/images/2026-03-25/07419630-c714-4202-b383-18a15957949f.png)

2）查看变量在哪里使用

鼠标左击变量即可，查看，该变量使用处。

![查看变量使用处](/uploads/images/2026-03-25/2ac587d8-6db4-4f9c-b474-102b5d3e1b19.png)

#### 9、查看当前类、方法、变量定义处

光标放到你要查看的类、方法或者变量上，按住ctrl键，再点击鼠标左击即可调转到对应类、方法、变量定义的地方。如果调用的方法是接口里面的，则会跳转到对应接口里面，此时需要点击接口方法前的向下的箭头进入到对应的实现类里面的方法里面。

![进入实现类方法](/uploads/images/2026-03-25/40a0f30f-2b2f-4ca9-8f45-054bfd63769a.png)

#### 10、本地历史

当你本地代码出现丢失的情况，此时通过版本控制工具比如git也无法找到的话。此时，就可以使用idea本地历史记录来查看记录的历史版本。

1）右击你需要查看的文件或者文件夹查看历史版本

![本地历史记录](/uploads/images/2026-03-25/6b3422ae-3996-4ca1-b81c-45a18e1a7547.png)

2）进入如下界面，按照下图指示，根据需要来恢复代码

![本地历史记录2](/uploads/images/2026-03-25/e11277e5-5145-4053-88c6-c196264b78ff.png)

#### 11、格式化代码

格式化代码可以使用快捷键 Ctrl Alt L。直接使用 Ctrl Alt L，默认格式化当前文件。如果当前文件不全是你写的，最好选中格式化的范围之后，再使用Ctrl Alt L进行代码格式化。否则，你可能会修改别人的代码，当你推送代码到远程仓库之后，后续你格式化别人的代码都会变成你写的，当这块代码出问题的时候，可能你会背锅！

![格式化代码](/uploads/images/2026-03-25/32350161-9145-446c-b6fa-b6d7407db501.png)

#### 12、快速生成for循环

![快速生成for循环](/uploads/images/2026-03-25/7eafbdd4-b79b-4058-b4c8-2f3e06faf0bf.png)

### 三、其他常用快捷键

| 场景 | 高频键 | 作用一句话 |
| --- | --- | --- |
| 最近文件 | Ctrl+E | 弹刚才打开过的文件列表 |
| 跳回/跳前 | Ctrl+Alt+← / → | 光标来回穿越文件 |
| 重命名 | Shift+F6 | 重命名变量/类/包 |
| 万能修复 | Alt+Enter | 导包、类型转换、生成变量、实现类、实现方法等 |
| 生成代码 | Alt+Insert | 一键生成构造器、getter/setter、toString 等 |
| 包围代码 | Ctrl+Alt+T | 快速加 if/try/while/Runnable… |
| 优化 import | Ctrl+Alt+O | 删无用包、按规则排序 |
| 复制 | Ctrl+D | 不用剪贴板直接复制当前行 |
| 剪切 | Ctrl+X | 剪切 |
