---
title: "工作中Dubbo的使用"
published: 2026-08-01
description: "工作中Dubbo的使用"
category: "技术篇"
draft: false
---

## 一、什么是Dubbo？

Dubbo是阿里巴巴开源的Java RPC框架，用于实现服务的远程调用和治理。在微服务架构中，不同的服务部署在不同的机器上，服务之间需要相互调用，Dubbo就是帮你完成这件事的。

> **简单说：Dubbo就是让一个服务能调用另一个服务的方法，就像调用本地方法一样简单。**

### 1、为什么需要Dubbo？

| 场景 | 不用Dubbo | 用Dubbo |
| --- | --- | --- |
| 服务间调用 | 自己写HTTP请求，手动处理序列化 | 像调用本地方法一样调用远程服务 |
| 服务管理 | 不知道有哪些服务可用 | 自动注册和发现服务 |
| 负载均衡 | 自己实现 | 内置多种负载均衡策略 |
| 服务监控 | 手动统计 | 自带监控中心 |

### 2、Dubbo的核心角色

| 角色 | 说明 | 类比 |
| --- | --- | --- |
| Provider（提供者） | 暴露服务的应用，提供服务接口的实现 | 餐厅的厨师，负责做菜 |
| Consumer（消费者） | 调用远程服务的应用 | 顾客，点菜消费 |
| Registry（注册中心） | 服务注册与发现的地方 | 餐厅的菜单，告诉你有哪些菜 |
| Monitor（监控中心） | 统计服务的调用次数和耗时 | 餐厅的账本，记录每道菜被点了多少次 |

### 3、Dubbo的调用流程

```
1. Provider启动 → 向Registry注册自己的服务地址
2. Consumer启动 → 向Registry订阅需要的服务
3. Registry → 把Provider的地址列表推送给Consumer
4. Consumer → 根据地址列表，直接调用Provider（不再经过Registry）
5. Monitor → 统计调用信息
```

![dubbo调用关系](/uploads/images/2026-05-16/fc256743-745a-40ec-879d-783c223a2771.png)

## 二、注册中心的选择

Dubbo支持多种注册中心，**不仅限于Zookeeper**，你可以根据项目实际情况选择合适的注册中心：

| 注册中心 | 说明 | 适用场景 |
| --- | --- | --- |
| Zookeeper | Apache开源的分布式协调服务，Dubbo最经典的注册中心 | 传统项目，团队对ZK比较熟悉 |
| Nacos | 阿里开源的注册中心和配置中心，同时支持AP和CP模式 | Spring Cloud Alibaba技术栈项目，需要同时做配置管理 |
| Redis | 基于Redis实现的注册中心 | 轻量级项目，已有Redis基础设施 |

> **工作中最常用的是Zookeeper和Nacos两种**，下面以这两种为例进行整合演示。具体用哪个取决于你们公司的技术栈，入职后问一下同事即可。

## 三、SpringBoot整合Dubbo

### 1、引入依赖

**父工程引入依赖：**

```xml
<!-- Dubbo -->
<dependency>
    <groupId>org.apache.dubbo</groupId>
    <artifactId>dubbo-bom</artifactId>
    <version>${dubbo.version}</version>
    <type>pom</type>
    <scope>import</scope>
</dependency>
```

**各个子模块引入依赖——根据注册中心选择对应的依赖：**

**使用Zookeeper作为注册中心：**

```xml
<!-- dubbo -->
<dependency>
    <groupId>org.apache.dubbo</groupId>
    <artifactId>dubbo-spring-boot-starter</artifactId>
    <version>3.0.9</version>
</dependency>
<dependency>
    <groupId>org.apache.dubbo</groupId>
    <artifactId>dubbo-dependencies-zookeeper-curator5</artifactId>
    <type>pom</type>
    <exclusions>
        <exclusion>
            <artifactId>slf4j-reload4j</artifactId>
            <groupId>org.slf4j</groupId>
        </exclusion>
    </exclusions>
    <version>3.0.9</version>
</dependency>
```

**使用Nacos作为注册中心：**

```xml
<!-- dubbo -->
<dependency>
    <groupId>org.apache.dubbo</groupId>
    <artifactId>dubbo-spring-boot-starter</artifactId>
    <version>3.0.9</version>
</dependency>
<!-- nacos作为注册中心 -->
<dependency>
    <groupId>org.apache.dubbo</groupId>
    <artifactId>dubbo-registry-nacos</artifactId>
    <version>3.0.9</version>
</dependency>
<dependency>
    <groupId>com.alibaba.nacos</groupId>
    <artifactId>nacos-client</artifactId>
    <version>2.2.3</version>
</dependency>
```

### 2、定义公共接口

Provider和Consumer之间需要一个公共的接口模块，双方都依赖这个模块。

```java
public interface TestDubboService {
    String sayHello(String name);
    ZhuoYe getZuoYe();
}
```

### 3、服务提供者（Provider）

#### 3.1 配置文件

**使用Zookeeper作为注册中心：**

```yaml
dubbo:
  application:
    name: dubbo-springboot-demo-provider
  protocol:
    name: dubbo
    port: -1  # -1表示自动分配端口
  registry:
    address: zookeeper://192.168.190.129:2181
    timeout: 60000
```

**使用Nacos作为注册中心：**

```yaml
dubbo:
  application:
    name: dubbo-springboot-demo-provider
  protocol:
    name: dubbo
    port: -1
  registry:
    address: nacos://127.0.0.1:8848
    timeout: 60000
    # 如果nacos配置了命名空间，需要指定namespace
    # parameters:
    #   namespace: your-namespace-id
```

> **区别就只是 `registry.address` 的协议头不同**：Zookeeper是 `zookeeper://`，Nacos是 `nacos://`，其他配置完全一样。

#### 3.2 启动类添加注解

```java
@SpringBootApplication
@EnableDubbo  // 开启Dubbo
public class ProviderApp {
    public static void main(String[] args) {
        SpringApplication.run(ProviderApp.class, args);
    }
}
```

#### 3.3 实现服务接口

```java
@DubboService  // 标记为Dubbo服务，会自动注册到注册中心
public class TestDubboServiceImpl implements TestDubboService {

    @Override
    public String sayHello(String name) {
        return "hello," + name;
    }

    @Override
    public ZhuoYe getZuoYe() {
        ZhuoYe zuoYe = new ZhuoYe();
        zuoYe.setName("zhuoye-1")
                .setDescription("帅呆了！！！");
        return zuoYe;
    }
}
```

### 4、服务消费者（Consumer）

#### 4.1 配置文件

**使用Zookeeper作为注册中心：**

```yaml
dubbo:
  application:
    name: dubbo-springboot-demo-consumer
  protocol:
    name: dubbo
    port: -1
  registry:
    address: zookeeper://192.168.190.129:2181
    timeout: 60000
```

**使用Nacos作为注册中心：**

```yaml
dubbo:
  application:
    name: dubbo-springboot-demo-consumer
  protocol:
    name: dubbo
    port: -1
  registry:
    address: nacos://127.0.0.1:8848
    timeout: 60000
```

#### 4.2 启动类添加注解

```java
@SpringBootApplication
@EnableDubbo  // 开启Dubbo
public class ConsumerApp {
    public static void main(String[] args) {
        SpringApplication.run(ConsumerApp.class, args);
    }
}
```

#### 4.3 调用远程服务

```java
@RestController
@RequestMapping("dubbo")
public class TestDubboController {

    @DubboReference  // 注入远程服务
    private TestDubboService testDubboService;

    @GetMapping("hello")
    public String hello(String name) {
        return testDubboService.sayHello(name);
    }

    @GetMapping("getZhuoye")
    public ZhuoYe getZhuoye() {
        return testDubboService.getZuoYe();
    }
}
```

## 四、核心注解说明

| 注解 | 用在谁身上 | 说明 |
| --- | --- | --- |
| @EnableDubbo | 启动类 | 开启Dubbo自动配置 |
| @DubboService | Provider的服务实现类 | 标记为Dubbo服务，自动注册到注册中心 |
| @DubboReference | Consumer的属性 | 注入远程服务的代理对象 |

> **版本说明：** 在 Dubbo 2.7.x 及更早版本中，使用的是 `@Service` 和 `@Reference` 注解（来自 `org.apache.dubbo.config.annotation.Service` 或 `com.alibaba.dubbo.config.annotation.Service`）。从 Dubbo 2.7.7 开始，官方推荐使用 `@DubboService` 和 `@DubboReference` 替代，目的是避免与 Spring 的 `@Service` 注解产生冲突和混淆。如果你在公司的老项目中看到 `@Service` 注解标注的服务类，那就是早期版本的写法，功能上和 `@DubboService` 是一样的。

## 五、常用配置说明

### 1、超时设置

```java
// 方式一：在注解上设置（推荐，精确控制）
@DubboService(timeout = 5000)
public class UserServiceImpl implements UserService { ... }

// 方式二：在消费端设置
@DubboReference(timeout = 3000)
private UserService userService;
```

### 2、重试设置

```java
@DubboReference(retries = 2)  // 重试2次，总共执行3次
private UserService userService;
```

> **注意：** 涉及写操作（新增、修改、删除）的方法不要设置重试，避免重复执行。

### 3、负载均衡策略

| 策略 | 说明 |
| --- | --- |
| Random | 随机（默认） |
| RoundRobin | 轮询 |
| LeastActive | 最少活跃调用数 |
| ConsistentHash | 一致性Hash |

```java
@DubboReference(loadbalance = "roundrobin")
private UserService userService;
```

### 4、版本控制

当服务接口有不兼容升级时，可以通过版本来区分：

```java
// Provider：提供不同版本的服务
@DubboService(version = "1.0")
public class UserServiceImplV1 implements UserService { ... }

@DubboService(version = "2.0")
public class UserServiceImplV2 implements UserService { ... }

// Consumer：指定调用哪个版本
@DubboReference(version = "1.0")
private UserService userService;
```

## 六、项目中如何使用Dubbo

### 1、项目中首次使用Dubbo

按照上面"三、SpringBoot整合Dubbo"的步骤操作即可。

### 2、项目中非首次使用Dubbo

直接使用 `Ctrl + Shift + R` 全局搜索 `@DubboService`、`@DubboReference`、`@Service`、`@Reference`（后两个是早期版本的注解，老项目中会用到），参考同事的代码，照葫芦画瓢即可。

## 七、常见使用场景

### 1、跨服务调用

```
用户服务 → 调用订单服务获取用户订单
订单服务 → 调用商品服务获取商品信息
```

### 2、公共服务抽取

```
短信服务、邮件服务、文件上传服务 → 独立部署，其他服务通过Dubbo调用
```

## 八、常见问题排查

### 1、服务调用失败：No provider available

**可能原因：**

-   Provider未启动或未注册到注册中心
-   网络不通，Provider端口未开放
-   接口类路径不一致（Provider和Consumer的接口包名必须一致）

**排查步骤：**

```bash
# 1. 检查注册中心（Zookeeper）是否启动
# 2. 检查Provider日志，确认服务已注册
# 3. 检查Consumer和Provider的接口包名是否一致
```

### 2、服务调用超时

**可能原因：**

-   Provider处理慢（数据库查询慢、业务逻辑复杂）
-   网络延迟高
-   并发量大，Provider处理不过来

**解决方案：**

```java
// 增加超时时间
@DubboReference(timeout = 10000)
private UserService userService;
```

### 3、注册中心连不上

**可能原因：**

-   注册中心未启动（Zookeeper或Nacos）
-   地址或端口配置错误
-   防火墙未放行端口

**排查命令：**

```bash
# 测试Zookeeper连通性
telnet 192.168.190.129 2181

# 测试Nacos连通性（默认8848端口）
curl http://127.0.0.1:8848/nacos/
```

### 4、本地改了代码但没有生效（新人高频问题）

**现象：** 本地修改了Provider的代码并重启，但调用接口后发现行为没有变化，打的断点也不进。

**原因：** 注册中心里注册了多个同名的服务实例（线上环境 + 你本地的），Consumer通过负载均衡调用时，实际走的是线上的服务实例，而不是你本地的。

**排查步骤：**

1.  打开注册中心的管理控制台（Zookeeper用PrettyZoo等客户端，Nacos用Web控制台）
2.  查看该服务名下有几个实例，确认你的本地实例是否在里面
3.  检查Consumer调用的到底是哪个实例

**解决方案：**

| 方案 | 操作 | 推荐度 |
| --- | --- | --- |
| 直连本地 | Consumer配置 @DubboReference(url = "dubbo://127.0.0.1:20880") 绕过注册中心直接连本地 | 推荐，最简单 |
| 版本区分 | 本地Provider注册一个独立的版本号，Consumer指定调用该版本 | 推荐，不影响其他实例 |
| 只启动本地Provider | 把线上的Provider停掉，只保留本地的实例 | 可以但不影响线上 |
| 隔离环境 | 本地连接开发环境的注册中心，不连线上的 | 推荐，规范做法 |

> **关于直连端口：** `20880` 是Provider的Dubbo协议端口，对应配置文件中的 `dubbo.protocol.port`。如果配置的是固定端口（如 `port: 20880`），直接填即可；如果配置的是 `-1`（自动分配），实际端口会在Provider启动日志中打印出来，需要去日志里查找。

```java
// 方式一：注解直连本地（调试时临时使用，用完记得去掉）
// 20880是Provider的dubbo协议端口，即配置文件中 dubbo.protocol.port 的值
@DubboReference(url = "dubbo://127.0.0.1:20880")
private UserService userService;

// 方式二：配置文件指定直连（不影响代码）
// application.yml
dubbo:
  consumer:
    url: dubbo://127.0.0.1:20880

// 方式三：通过版本区分（推荐）
// Provider端：本地启动时指定一个测试版本
@DubboService(version = "local-dev")
public class UserServiceImpl implements UserService { ... }

// Consumer端：指定调用本地测试版本
@DubboReference(version = "local-dev")
private UserService userService;
```

> **注意：** 直连方式会绕过注册中心，仅用于本地调试，上线前必须去掉。版本区分方式的好处是：你本地注册的服务和线上的服务通过版本号隔离开，Consumer明确指定调用 `local-dev` 版本，不会误打到线上实例。排查问题的思路就是：**先确认你的请求到底打到了哪个实例上**。确认方式可以在后端对应调用Provider的服务上打个断点，走到断点就说明请求走的是本地，也可以通过这种方式来验证走本地服务的时候，逻辑是否正确的。

## 九、注意事项

1.  **接口包名必须一致**：Provider和Consumer引用的接口类，包路径必须完全一致，否则找不到服务
2.  **实体类必须实现Serializable**：Dubbo传输的对象必须实现序列化接口
3.  **谨慎设置重试**：写操作不要设置重试，避免重复执行
4.  **合理设置超时**：根据业务实际情况设置超时时间，不要太大也不要太小
5.  **检查注册中心状态**：注册中心挂了，新的服务无法注册和发现
