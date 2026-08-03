---
title: "Maven的基本使用"
published: 2026-08-01
description: "Maven的基本使用"
category: "开发工具"
draft: false
---

## 一、什么是maven

Maven的主要作用是简化了Java项目的构建过程。它通过一个名为`pom.xml`的核心配置文件来管理项目的依赖关系、编译设置、打包和部署等操作。使用Maven，开发者不需要手动下载和管理依赖的jar包，只需在`pom.xml`文件中声明所需的依赖项及其版本，Maven会自动从仓库中下载并添加到项目中。

此外，Maven还提供了许多插件，支持项目的开发、测试、打包和部署等一系列活动。这些插件可以扩展Maven的功能，使其能够满足不同项目的需求。

总的来说，Maven是一个强大的自动化构建工具，它通过标准化的项目结构和生命周期管理，提高了开发效率，降低了项目维护的复杂性。

![Maven](/uploads/images/2026-03-26/a837d4b3-d732-4b8e-a1a0-7b602d307e55.png)

中央仓库的地址：[https://mvnrepository.com/](https://mvnrepository.com/)

## 二、maven的基本操作

#### 1、idea配置maven

![设置maven](/uploads/images/2026-03-26/c267bae0-9527-4636-a421-5583a562538e.png)

需要注意的是，如果公司有使用私仓的话，settings.xml配置文件一定要使用包含私仓信息的，可以直接问同事要一份！

#### 2、引入新的依赖

##### 2.1、依赖在远程仓库中

maven仓库存在的依赖，直接引入，刷新maven即可

```xml
        <dependency>
            <groupId>org.springframework</groupId>
            <artifactId>spring-webmvc</artifactId>
            <version>5.1.6.RELEASE</version>
        </dependency>
```

groupld：用于定义当前Maven项目所隶属的组织名称，一般按照域名反写规则来确定，比如“com.zcloud”。 artifactld：用来定义当前Maven项目的名称，通常为具体的模块名称，比如“user-service”“admin-service”等。 version：用于设定当前项目的版本号。

##### 2.2、依赖不在远程仓库中

-   **使用 `system` 作用域**
    
    将需要引入的jar包放到pom文件同级目录lib下，如果没有这个目录可以新建一个目录，然后使用如下方式引入，坐标信息自定义即可，但最后和jar包实际信息保持一致或者能够正确反映该jar包信息！
    

```xml
       <dependency>
            <groupId>com.alibaba</groupId>
            <artifactId>alicrypto-java-aliyun</artifactId>
            <version>1.0.4</version>
            <scope>system</scope>
            <systemPath>${project.basedir}/lib/alicrypto-java-aliyun-1.0.4.jar</systemPath>
       </dependency>
```

如果想要在打包的时候也要把本地system的jar包打进来的话，就需要在maven插件中配置一个includeSystemScope属性：

```xml
<plugin>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-maven-plugin</artifactId>
    <configuration>
    	<!--设置为true，打包的时候把本地的system的jar包也打包进来-->
        <includeSystemScope>true</includeSystemScope>
    </configuration>
</plugin>
```

注：project.basedir 就是pom文件所在的目录。

scop标签的的值有下面几个：

| compile | 默认值，适用于所有阶段（测试、运行，编译） |
| --- | --- |
| provided | 期望容器或使用者会提供这个依赖。如servlet-api.jar；适用于（测试，编译） |
| runtime | 只在运行时使用，如 mysql的驱动jar |
| test | 只在测试时使用，如 junit.jar |
| system | Maven不会在仓库中查找对应依赖，在本地磁盘目录中查找；适用于（编译，测试，运行） |

-   **安装到本地仓库**

安装本地仓库直接使用如下命令安装即可！

```sh
mvn install:install-file -Dfile=alicrypto-java-aliyun-1.0.4.jar -DgroupId=com.alibaba -DartifactId=alicrypto-java-aliyun -Dversion=1.0.4 -Dpackaging=jar -DlocalRepositoryPath=D:\Learning_Document\Maven\repository
```

说明，-Dfile就是你需要安装的jar的路径，可以是绝对路径，也可以是当前命令执行目录下的相对路径。-DlocalRepositoryPath就是需要jar包需要安装到的maven本地仓库的路径！

如下图，就是在对应需要安装的jar包目录下打开cmd的执行成功的结果：

![命令安装本地jar包](/uploads/images/2026-03-26/131370c5-a72c-4e37-9e42-f4f4d8701129.png)

如下，在本地仓库对应目录存在我们安装的jar包，即是成功！

![命令安装本地jar包-2](/uploads/images/2026-03-26/6782ad6b-1399-4f9a-bb18-10769444a43a.png)

#### 3、maven打包等功能说明

![maven工具栏](/uploads/images/2026-03-26/7b6b2de0-38e7-42f8-b889-251c02afe4f2.png)

#### 4、maven的多环境管理

Maven 多环境管理能够实现多环境配置文件之间的灵活切换，以及对配置文件中不同环境变量值的精准替换。在一些公司的实际项目中会运用到这一功能，了解并知晓其存在即可，当所在公司采用这种方式时，能及时想到即可。当使用maven多环境管理功能的时候，在maven工具栏会出现Profiles项，如下图所示：

![maven多环境管理](/uploads/images/2026-03-26/28d0c321-cebd-4d97-91e7-8010009c5892.png)

pom文件里面会有如下配置：

```xml
<project>
   <profiles>
        <profile>
            <id>dev</id>
            <dependencies>
                <dependency>
                    <groupId>org.springframework.boot</groupId>
                    <artifactId>spring-boot-devtools</artifactId>
                </dependency>
            </dependencies>
            #设置该配置为默认生效
            <activation>
                <activeByDefault>true</activeByDefault>
            </activation>
            <properties>
                <env>dev</env>
                <server.port>8081</server.port>
                <log.level>INFO</log.level>
            </properties>
        </profile>
        <profile>
            <id>prod</id>
            <properties>
                <env>prod</env>
                <server.port>9090</server.port>
                <log.level>WARN</log.level>
            </properties>
        </profile>
    </profiles>
</project>
```

application.yml配置文件里面会有如下配置：

```yml
# 开发环境配置
server:
  # 服务器的HTTP端口，默认为8080
  port: ${server.port}
# 日志配置
logging:
  level:
    com.ruoyi: ${log.level}
    org.springframework: ${log.level}
```

#### 5、maven的私服

##### 5.1 maven私服的介绍

maven 私有仓库的搭建，通常都是使用 Nexus 这一主流工具。通过使用maven 私仓，我们为您能够构建专属于公司内部使用的依赖仓库。一方面，我们可以在这个私仓中高效管理公司自己开发的各类 Jar 包，实现内部组件的统一存储与版本管控；另一方面，还能将项目所需的中央仓库 Jar 包缓存到私仓中，既可以提升依赖下载的稳定性与速度，也能解决内网开发环境下的项目构建的需求。

![maven私仓](/uploads/images/2026-03-26/84e12ceb-841b-489e-a56c-784bcb6ebb38.png)

上面有四个maven仓库类型，含义如下：

| 仓库类型 | 比喻 | 功能 |
| --- | --- | --- |
| maven-central (代理仓库) | 海外代购仓库 | 代理Maven中央仓库，首次购买从国外运来，之后存在本地仓库，下次直接拿 |
| maven-releases (宿主仓库) | 公司正式产品仓库 | 存放公司正式发布的版本（打包时不带-SNAPSHOT） |
| maven-snapshots (宿主仓库) | 公司测试产品仓库 | 存放公司正在开发的版本（打包时带-SNAPSHOT） |
| maven-public (组仓库) | 总服务台 | 把上面三个仓库整合成一个统一入口，你只需要记住这个地址 |

##### 5.2 maven私服的使用

maven私服对于我们来说主要就是有以下两个常见的使用

-   发布jar包
    
    直接点击maven工具栏的deploy发布即可！
    
-   引入jar包
    

![maven私仓2](/uploads/images/2026-03-26/68a6a11a-74da-46d3-b23d-77b5e9e5ed3a.png)

## 三、常见问题

#### 1、依赖冲突

当两条依赖路径把同一个坐标的 jar 引了进来，但版本不同，JVM 只能选一个，于是“选错”的那个就把代码搞炸，这也就是依赖冲突。

##### 1.1 如何查看依赖冲突

-   命令的形式
    
    不建议用，依赖多的时候，不好查找
    
    ```
    mvn -Dverbose dependency:tree
    ```
    
-   使用插件 (建议使用该方式)
    

![依赖冲突1](/uploads/images/2026-03-26/cb024f96-8ea7-4227-aaa7-a19bdac97dda.png)

如果搜索插件的时候，没有任何结果的时候，可进行如下设置后，再进行搜索

![依赖冲突2](/uploads/images/2026-03-26/cc3091ba-ff65-4768-8d43-44e087759a05.jpg)

安装完成之后，pom文件下方就会出现 **Dependency Analyzer** ，点击即可对当前pom文件引入的依赖进行分析。

![maven-helper](/uploads/images/2026-03-26/255feb0b-3fa7-440b-b544-4bed2375d100.png)

##### 1.2 解决依赖冲突

1）使用maven的依赖传递原则来解决

-   路径最短优先原则

​ 主要根据依赖的路径长短来决定引入哪个依赖

-   最先声明优先原则
    
    如果两个依赖的路径一样，声明在前的则优先选择。
    

2）手动排除依赖

使用exclusion标签来排除依赖

```xml
      <dependency>
            <groupId>nl.basjes.parse.useragent</groupId>
            <artifactId>yauaa</artifactId>
            <exclusions>
                <exclusion>
                    <artifactId>commons-collections4</artifactId>
                    <groupId>org.apache.commons</groupId>
                </exclusion>
            </exclusions>
        </dependency>
```

可以自己手动在pom文件添加，也可以使用Maven Helper插件来快速排除依赖！

![排除依赖](/uploads/images/2026-03-26/0e010226-6624-4695-a3a1-fad1f328cc2d.png)

3）封装成rpc服务（了解）

当同一个Java程序 里必须同时加载两份不兼容的 jar包的时候，这个时候只能把其中一方单独拆成一个RPC服务，主应用通过 Feign/Dubbo/gRPC等进行远程调用！

#### 2、maven的pom文件未被正确识别

pom文件为蓝色的m标识的时候，为正确识别。

![pom文件识别](/uploads/images/2026-03-26/02775995-bc87-4ed9-9b4b-5717c1152711.png)

未被识别的时候，右击pom文件点击 **Add as Maven Project** 添加为maven工程：

![pom文件识别2](/uploads/images/2026-03-26/3a8a7f70-19c3-4208-8d7a-4537d1c9b169.png)

#### 3、maven工具栏消失

-   未启用maven插件

![maven工具栏消失](/uploads/images/2026-03-26/f2f3d52c-4a5c-4160-8b0a-337290b5afde.png)

-   pom文件未被正确识别
    
    ![maven工具栏消失2](/uploads/images/2026-03-26/69f40d96-498b-47f9-ac2b-8ecea16c205f.png)
    

#### 4、依赖未正确加载

![依赖未正确加载](/uploads/images/2026-03-26/db232f4a-8b07-46b1-8899-fea2fc01a853.png)
