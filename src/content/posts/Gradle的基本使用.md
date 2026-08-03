---
title: "Gradle的基本使用"
published: 2026-08-01
description: "Gradle的基本使用"
category: "开发工具"
draft: false
---

### 一、什么是Gradle

Gradle是一个构建工具，用于自动化项目的构建、测试、部署等过程。它使用一种基于Groovy或Kotlin的领域特定语言（DSL）来编写构建脚本，使得构建配置更加灵活和强大。

通俗来说，Gradle就像是一个智能的助手，你告诉它（通过编写构建脚本）你的项目需要如何编译、需要哪些依赖库、如何打包等，它就会按照你的指示自动完成这些任务。同时，它还能高效地处理任务之间的依赖关系，只执行必要的步骤，从而加快构建速度。

### 二、为什么有Maven了，还需要Gradle

Maven 和 Gradle 的本质使命是一样的：**帮你“一键”完成代码编译、测试、打包、发布、依赖管理**。 但 Maven 是 2004 年的“XML 老将”，Gradle 是 2012 年诞生的“DSL 新兵”，两者设计理念差异巨大，导致在**大型、多模块、持续交付**的场景下，Gradle 往往能**更快、更省、更灵活**。

一句话，Maven 能干的 Gradle 都能干，反之不行；**当项目规模变大、构建速度、灵活性、持续集成成为瓶颈时，Gradle 就是“升级补丁”**。

### 三、gradle项目的一般目录结构

![gradle目录结构](/uploads/images/2026-03-27/e93f5ee2-c276-4d1d-88d0-fb5116e59a91.png)

### 四、gradle项目常见操作

#### 1、打开gradle项目

1） 打开时选择当前工程下的build.gradle打开即可。打开后可能出现如下idea右侧无gradle工具栏的问题。此时可以按照如下操作

![添加为gradle项目](/uploads/images/2026-03-27/27a15cb1-607a-4bb0-9945-cd2b532e47ac.png)

2）打开完成后需要在idea的 **Settings -> Building,Execution,Deployment -> Bulids Tools ->Gradle** 中配置gradle

![gradle设置本地仓库](/uploads/images/2026-03-27/54304d61-c76d-4748-80ef-b57ec1dca573.png)

#### 2、引入依赖

引入远程仓库依赖，gradle也是 可以使用maven中央仓库的。

中央仓库的地址：[https://mvnrepository.com/](https://mvnrepository.com/)

1)、远程仓库存在的依赖，直接引入，刷新gradle

gradle的依赖是在build.gradle文件下的

```groovy
dependencies {
implementation group: 'commons-beanutils', name: 'commons-beanutils', version: "${commonsbeanutilsVersion}"
}
```

这里面的版本是配置在gradle.properties文件里面的，这个文件定义的属性就是全局的！

```
commonsbeanutilsVersion         =1.9.4
```

`implementation` 是一个**依赖配置（Dependency Configuration）**，用于声明依赖项，类似于maven在引入依赖的时候scope标签的值。配置项的可选值如下:

| 依赖配置 | 说明 | 典型应用场景 |
| --- | --- | --- |
| implementation | 编译期和运行时使用，不传递依赖给其他模块。 | 推荐首选，用于声明绝大多数私有依赖，有助于加快编译和隐藏接口。 |
| api | 编译期和运行时使用，且会传递依赖。在Gradle 3.4+中引入，作用同已废弃的compile。 | 制作库时，需要向使用者暴露其依赖的第三方库接口。 |
| compileOnly | 仅在编译期需要，不打包到最终产物（如APK/JAR）。 | 编译时提供支持，但运行时由环境提供（如Servlet API）。 |
| runtimeOnly | 仅在运行时需要，编译期不需要。 | 数据库驱动等仅在运行时使用的库。 |
| testImplementation | 用于测试代码（src/test）的编译和运行，不参与主代码打包。 | JUnit等测试框架。 |
| debugImplementation | 仅在构建 debug 变体时参与编译和打包。 | 仅需在调试模式下使用的工具（如LeakCanary）。 |
| releaseImplementation | 仅在构建 release 变体时参与编译和打包。 |  |

2）仓库不存在的依赖引入方式

```groovy
dependencies {
    // 依赖lib目录下的某个jar文件，指定具体的jar文件使用files()
    implementation files('lib/xxx.jar')
 
    // 依赖lib目录下的所有以.jar结尾的文件
    //fileTree() 用于指定一个目录，并通过通配符规则批量匹配文件，适合依赖一个目录下的多个 JAR（无需逐个指定）
    implementation fileTree(dir: 'lib', includes: ['*.jar'])
 
    // 依赖lib目录下的除了xxx.jar以外的所有以.jar结尾的文件
    implementation fileTree(dir: 'lib', excludes: ['xxx.jar'], includes: ['*.jar'])
}
```

#### 3、打包

​ 在build.gradle中通过如下方式设置打jar包或者war包

```groovy
#打war的话，就把java换成war
apply plugin: 'java'
```

​ 点击右侧gradle工具栏下的对应模块下build下的build按钮进行打包对应模块。

![gradle打包](/uploads/images/2026-03-27/45d05fc8-d0fc-451b-8c2a-83c7188e2ddc.png)

打完的包会在对应模块下的bulid目录下的libs目录下，如下图：

![gradle-打jar包](/uploads/images/2026-03-27/1dbaac2a-7ae9-4ecf-88d1-a55c9f6738a2.png)
