---
title: "Swagger的使用"
published: 2026-08-01
description: "Swagger的使用"
category: "开发工具"
draft: false
---

### 一、Swagger是什么？为什么需要Swagger？

#### 1、Swagger是什么

Swagger是一款**RESTful API文档自动生成和测试工具**，在Java后端开发中主要用于自动生成API接口文档，并提供在线测试接口的功能。

简单的说，Swagger就是**帮你的接口自动生成文档的工具**。以前写接口需要手动写Word文档或者Excel表格来记录接口地址、参数、返回值等，现在只需要在代码上加几个注解，Swagger就能自动生成漂亮的网页版接口文档。

**官方网站**：[https://swagger.io/](https://swagger.io/)

#### 2、为什么需要Swagger

对个人开发：

-   **不用手写文档**：通过注解自动生成接口文档，大大减少文档编写工作量
-   **在线测试**：直接在浏览器中测试接口，不需要打开Postman等额外工具
-   **文档与代码同步**：代码变了，文档自动更新，不会出现文档过时的问题

对团队协作：

-   **前端同事很高兴**：前端开发人员可以直接查看接口文档，了解接口参数和返回值
-   **提高沟通效率**：不用反复问"这个接口什么参数？"、"这个接口返回什么？"
-   **便于接口交接**：新入职的同事可以通过Swagger文档快速了解项目接口

### 二、Swagger的基本使用

#### 1、Swagger版本区分（了解）

工作中常见的是以下几种情况：

| 版本 | Swagger路径 | 注解包 | 说明 |
| --- | --- | --- | --- |
| Swagger 2 | /swagger-ui.html | io.swagger.annotations | 老版本 |
| Swagger 3 | /swagger-ui/index.html | io.swagger.v3.oas.annotations | 新版本，也叫 OpenAPI 3.0 |
| Swagger 3（兼容模式） | /swagger-ui/index.html | io.swagger.annotations | 使用Swagger 2注解，生成Swagger 3文档 ✅ |
| Knife4j（Swagger 2增强版） | /doc.html | io.swagger.annotations | 中文增强版，界面美观，国内常用 |
| Knife4j（Swagger 3增强版） | /doc.html | io.swagger.v3.oas.annotations | 基于Swagger 3的增强版 |

**如何快速判断项目用的是Swagger 2还是Swagger 3？**

看访问地址：

-   `/swagger-ui.html` → **Swagger 2**
-   `/swagger-ui/index.html` → **Swagger 3** ✅
-   `/doc.html` → **Knife4j**（增强版）

**什么是Knife4j？**

Knife4j 是 Swagger 的**中文增强版**，主要特点：

-   **界面更美观**：全新的UI设计，比原生Swagger更好看
-   **中文友好**：原生支持中文，无需额外配置
-   **功能增强**：增加了很多实用功能，如离线文档、接口排序等
-   **国内流行**：在国内项目中使用非常广泛

Knife4j 本质上是 Swagger 的皮肤增强，底层还是 Swagger，只是界面更好看。

本节以\*\*Swagger 3（兼容模式）\*\*为主进行讲解。

**什么是"兼容模式"？**

-   使用 **Swagger 2 的注解**（`@Api`, `@ApiOperation` 等）
-   生成 **Swagger 3 的文档**（OpenAPI 3.0 规范）

这样写的好处：可以继续用熟悉的 Swagger 2 注解，享受 Swagger 3 的新特性。

#### 2、引入Swagger依赖（了解）

**使用Swagger 3（兼容模式，推荐用于Spring Boot 2.x）**

在`pom.xml`中添加依赖：

```xml
<!-- Springfox Swagger 3.0 -->
<dependency>
    <groupId>io.springfox</groupId>
    <artifactId>springfox-boot-starter</artifactId>
    <version>3.0.0</version>
</dependency>
```

**其他版本参考：**

Swagger 2（老版本）：

```xml
<dependency>
    <groupId>io.springfox</groupId>
    <artifactId>springfox-swagger2</artifactId>
    <version>2.9.2</version>
</dependency>
<dependency>
    <groupId>io.springfox</groupId>
    <artifactId>springfox-swagger-ui</artifactId>
    <version>2.9.2</version>
</dependency>
```

Knife4j（Swagger增强版，推荐）：

```xml
<!-- Knife4j 3.x（基于Swagger 2，适用于Spring Boot 2.x）-->
<dependency>
    <groupId>com.github.xiaoymin</groupId>
    <artifactId>knife4j-spring-boot-starter</artifactId>
    <version>3.0.3</version>
</dependency>

<!-- Knife4j 4.x（基于Swagger 3，适用于Spring Boot 2.x/3.x）-->
<dependency>
    <groupId>com.github.xiaoymin</groupId>
    <artifactId>knife4j-openapi3-jakarta-spring-boot-starter</artifactId>
    <version>4.1.0</version>
</dependency>
```

Springdoc OpenAPI（用于Spring Boot 3.x）：

```xml
<dependency>
    <groupId>org.springdoc</groupId>
    <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
    <version>2.8.14</version>
</dependency>
```

#### 3、配置Swagger(了解)

创建配置类，配置Swagger的基本信息。

**RuoYi-Vue项目中的SwaggerConfig配置（实际使用）：**

```java
package com.zcloud.web.core.config;

import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import io.swagger.annotations.ApiOperation;
import io.swagger.models.auth.In;
import springfox.documentation.builders.ApiInfoBuilder;
import springfox.documentation.builders.PathSelectors;
import springfox.documentation.builders.RequestHandlerSelectors;
import springfox.documentation.service.ApiInfo;
import springfox.documentation.service.ApiKey;
import springfox.documentation.service.AuthorizationScope;
import springfox.documentation.service.Contact;
import springfox.documentation.service.SecurityReference;
import springfox.documentation.spi.DocumentationType;
import springfox.documentation.spi.service.contexts.SecurityContext;
import springfox.documentation.spring.web.plugins.Docket;

/**
 * Swagger3的接口配置
 * 虽然使用Swagger 2的注解（@ApiOperation等），但生成的是Swagger 3（OpenAPI 3.0）文档
 */
@Configuration
public class SwaggerConfig {

    /** 是否开启swagger */
    @Value("${swagger.enabled}")
    private boolean enabled;

    /** 设置请求的统一前缀 */
    @Value("${swagger.pathMapping}")
    private String pathMapping;

    /**
     * 创建API
     */
    @Bean
    public Docket createRestApi() {
        return new Docket(DocumentationType.OAS_30)  // ← OAS_30表示Swagger 3
                .enable(enabled)
                .apiInfo(apiInfo())
                .select()
                // 扫描所有有@ApiOperation注解的方法（Swagger 2注解风格）
                .apis(RequestHandlerSelectors.withMethodAnnotation(ApiOperation.class))
                .paths(PathSelectors.any())
                .build()
                /* 设置安全模式，支持token认证 */
                .securitySchemes(securitySchemes())
                .securityContexts(securityContexts())
                .pathMapping(pathMapping);
    }

    /**
     * 安全模式，token通过Authorization请求头传递
     */
    private List<SecurityScheme> securitySchemes() {
        List<SecurityScheme> apiKeyList = new ArrayList<>();
        apiKeyList.add(new ApiKey("Authorization", "Authorization", In.HEADER.toValue()));
        return apiKeyList;
    }

    /**
     * 安全上下文
     */
    private List<SecurityContext> securityContexts() {
        List<SecurityContext> securityContexts = new ArrayList<>();
        securityContexts.add(
                SecurityContext.builder()
                        .securityReferences(defaultAuth())
                        .operationSelector(o -> o.requestMappingPattern().matches("/.*"))
                        .build());
        return securityContexts;
    }

    /**
     * 默认的安全上引用
     */
    private List<SecurityReference> defaultAuth() {
        AuthorizationScope authorizationScope = new AuthorizationScope("global", "accessEverything");
        AuthorizationScope[] authorizationScopes = new AuthorizationScope[1];
        authorizationScopes[0] = authorizationScope;
        List<SecurityReference> securityReferences = new ArrayList<>();
        securityReferences.add(new SecurityReference("Authorization", authorizationScopes));
        return securityReferences;
    }

    /**
     * 添加摘要信息
     */
    private ApiInfo apiInfo() {
        return new ApiInfoBuilder()
                .title("若依管理系统_接口文档")
                .description("用于管理集团旗下公司的人员信息")
                .contact(new Contact("若依", null, null))
                .version("版本号:3.9.1")
                .build();
    }
}
```

**配置说明：**

-   `DocumentationType.OAS_30`：**这是Swagger 3**（OpenAPI 3.0规范）
-   `RequestHandlerSelectors.withMethodAnnotation(ApiOperation.class)`：扫描`@ApiOperation`注解（Swagger 2注解风格）
-   `securitySchemes()`：配置Token认证

**配置文件（application.yml）：**

```yaml
# Swagger配置
swagger:
  # 是否开启swagger
  enabled: true
  # 请求前缀
  pathMapping: /dev-api
```

#### 4、访问Swagger UI

只需要启动后端项目，无需启动前端项目，就可以在浏览器中访问Swagger UI界面。

![swagger界面](/uploads/images/2026-03-26/a6e82f0c-d8ea-4742-989d-f9f168ff5c5d.png)

**不同版本的访问地址：**

| 版本 | Swagger路径 | 判断依据 | 特点 |
| --- | --- | --- | --- |
| Swagger 2 | /swagger-ui.html | 地址中没有 index.html | 老版本，界面较简陋 |
| Swagger 3 | /swagger-ui/index.html | 地址中有 index.html | 新版本，功能更强 |
| Knife4j | /doc.html | 地址是 doc.html | 增强版，界面美观，中文友好 ✅ |

**如何快速记住：**

-   看到 `swagger-ui/index.html` → **Swagger 3**
-   看到 `swagger-ui.html` → **Swagger 2**
-   看到 `doc.html` → **Knife4j**（增强版）✅

**访问地址的构成说明（重点）：**

实际工作中，访问地址需要根据项目配置来拼接：

```
http://[域名或IP]:[端口][项目前缀][Swagger路径]
```

**如何找到正确的访问地址：**

1.  确认项目端口：查看`application.yml`中的`server.port`
2.  确认项目前缀：查看`application.yml`中的`server.servlet.context-path`
3.  在地址后加上 `/swagger-ui/index.html`（Swagger 3）

当然，有时候，Swagger路径也可以改的！正常情况，如果更改的话就是在项目配置文件里面去配置这个路径！如果默认路径都无法访问的话，就去配置文件里面去看，有没有自定义swagger路径。

#### 5、常用注解（了解）

Swagger 3（兼容模式）使用 Swagger 2 的注解风格。了解就行，不同版本注解可能有差异，需要使用的时候对应看别人代码用的什么注解就行！

**常用注解：**

| 注解 | 使用位置 | 作用 |
| --- | --- | --- |
| @Api | Controller类 | 标识接口分组，描述模块功能 |
| @ApiOperation | 方法 | 描述接口的具体功能 |
| @ApiModel | 实体类 | 描述实体类的信息 |
| @ApiModelProperty | 字段 | 描述字段的信息 |

### 三、Swagger的高级配置（了解）

#### 1、环境控制

通常只在开发环境和测试环境启用Swagger，生产环境需要禁用。

**项目中的配置：**

```yaml
# application.yml
swagger:
  # 是否开启swagger
  enabled: true
```

**通过配置文件控制（推荐）：**

```yaml
# application-dev.yml（开发环境）
swagger:
  enabled: true

# application-prod.yml（生产环境）
swagger:
  enabled: false
```

#### 2、Token认证配置

通过Authorization请求头传递token。

**配置方式（已在SwaggerConfig中配置）：**

```java
/**
 * 安全模式，token通过Authorization头请求头传递
 */
private List<SecurityScheme> securitySchemes() {
    List<SecurityScheme> apiKeyList = new ArrayList<>();
    apiKeyList.add(new ApiKey("Authorization", "Authorization", In.HEADER.toValue()));
    return apiKeyList;
}
```

**使用方式：**

1.  登录后获取token
2.  在Swagger UI界面点击右上角的 **Authorize** 按钮
3.  输入：`Bearer {token}` 或直接输入 `{token}`
4.  之后所有接口请求都会自动带上这个请求头

### 四、在Swagger中测试接口

#### 1、测试GET请求

**步骤：**

1.  点击接口名称，展开接口详情
2.  点击 **Try it out** 按钮
3.  填写请求参数（如果有）
4.  点击 **Execute** 执行请求
5.  查看响应结果

![get请求](/uploads/images/2026-03-26/42442029-f034-449a-9001-95203e956a43.png)

#### 2、测试POST请求

**步骤：**

1.  点击接口名称，展开接口详情
2.  点击 **Try it out** 按钮
3.  在Request body中填写JSON格式的请求数据
4.  点击 **Execute** 执行请求
5.  查看响应结果

![post请求](/uploads/images/2026-03-26/6c795821-4f0d-4f3e-b601-e50779333c47.png)

#### 3、设置Token认证

**步骤：**

1.  使用登录接口或者token或者登录对应前端平台F12获取别的接口传的Token
    
2.  点击页面右上角的 **Authorize** 按钮
    
    ![获取token](/uploads/images/2026-03-26/4bd8a600-ff20-4605-97cb-46681d436231.png)
    
3.  输入token，点击 **Authorize** 确认
    

![获取token2](/uploads/images/2026-03-26/9fe3688d-83a9-49cd-ba25-96a87f2752d6.png)
