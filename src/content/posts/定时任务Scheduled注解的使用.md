---
title: "定时任务Scheduled注解的使用"
published: 2026-08-01
description: "定时任务Scheduled注解的使用"
category: "技术篇"
draft: false
---

## 一、基础概述

### 1、什么是定时任务？

> **简单说：定时任务就是到点自动执行的代码。**

**生活中的例子：**

-   每天凌晨2点备份数据库
-   每小时同步一次第三方数据
-   每月1号生成报表

**工作中常见的定时任务场景：**

| 场景 | 执行频率 |
| --- | --- |
| 数据同步 | 每小时/每天 |
| 报表生成 | 每天/每周/每月 |
| 数据清理 | 每天凌晨 |
| 消息推送 | 定时发送 |
| 订单超时取消 | 每分钟检查 |

### 2、Spring Scheduled是什么？

Spring框架自带的定时任务功能，使用简单，只需要加注解就能实现。

**优点：**

-   不需要额外引入框架
-   使用简单，加注解就行
-   适合简单的定时任务

**缺点：**

-   默认单线程，任务会串行执行
-   不支持集群（每台机器都会执行）
-   没有可视化管理和监控

## 二、快速入门

### 第一步：开启定时任务支持

在启动类上加 `@EnableScheduling` 注解：

```java
@SpringBootApplication
@EnableScheduling  // 开启定时任务支持
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

### 第二步：创建定时任务

在方法上加 `@Scheduled` 注解：

```java
@Component
public class MyScheduledTask {

    @Scheduled(cron = "0 0 2 * * ?")  // 每天凌晨2点执行
    public void executeTask() {
        System.out.println("定时任务执行了：" + new Date());
        // 这里写业务逻辑
    }
}
```

**就这样，一个定时任务就完成了！**

## 三、@Scheduled注解参数详解

### 1、cron表达式（最常用）

**格式：**

```
秒 分 时 日 月 周 [年]
```
| 位置 | 含义 | 允许值 | 特殊字符 |
| --- | --- | --- | --- |
| 1 | 秒 | 0-59 | , - * / |
| 2 | 分 | 0-59 | , - * / |
| 3 | 时 | 0-23 | , - * / |
| 4 | 日 | 1-31 | , - * ? / L W |
| 5 | 月 | 1-12 | , - * / |
| 6 | 周 | 0-7 | , - * ? / L # |

**特殊字符说明：**

| 字符 | 说明 | 例子 |
| --- | --- | --- |
| * | 所有值 | * * * * * ? 每秒执行 |
| ? | 不指定值 | 日和周只能有一个用? |
| - | 范围 | 0 0 9-17 * * ? 9点到17点每小时 |
| , | 列举 | 0 0 9,12,15 * * ? 9点、12点、15点 |
| / | 间隔 | 0 0/30 * * * ? 每30分钟 |
| L | 最后 | 0 0 0 L * ? 每月最后一天 |

**常用cron表达式：**

| 表达式 | 说明 |
| --- | --- |
| 0 0 12 * * ? | 每天中午12点 |
| 0 0 0 * * ? | 每天凌晨0点 |
| 0 0/30 * * * ? | 每30分钟 |
| 0 0 2 * * ? | 每天凌晨2点 |
| 0 0 0 1 * ? | 每月1号凌晨 |
| 0 0 9-17 * * ? | 每天9点到17点每小时 |
| 0 0 9 * * MON-FRI | 周一到周五每天9点 |
| 0 0/5 * * * ? | 每5分钟 |

**在线生成工具：** [https://cron.ciding.cc/](https://cron.ciding.cc/)

> **新人技巧：** 不用背cron表达式，用在线工具生成就行。

### 2、fixedDelay（固定延迟）

**特点：** 上一次执行完成后，等待指定时间再执行。

```java
@Scheduled(fixedDelay = 5000)  // 上次执行完5秒后再执行
public void task1() {
    System.out.println("执行任务：" + new Date());
    // 假设执行了3秒
    // 那么下次执行是：执行完成时间 + 5秒
}
```

**适合场景：** 任务执行时间不固定，需要等上次执行完再执行的情况。

### 3、fixedRate（固定频率）

**特点：** 不管上次是否执行完，每隔固定时间执行一次。

```java
@Scheduled(fixedRate = 5000)  // 每5秒执行一次
public void task2() {
    System.out.println("执行任务：" + new Date());
}
```

**适合场景：** 需要固定频率执行的任务，如心跳检测。

### 4、initialDelay（首次延迟）

**特点：** 第一次延迟指定时间后再开始执行。

```java
@Scheduled(initialDelay = 10000, fixedRate = 5000)
// 启动后10秒开始执行，之后每5秒执行一次
public void task3() {
    System.out.println("执行任务：" + new Date());
}
```

**适合场景：** 项目启动后需要延迟一段时间再执行的任务。

### 5、参数对比

| 参数 | 说明 | 使用场景 |
| --- | --- | --- |
| cron | 精确时间点 | 每天凌晨、每小时等 |
| fixedDelay | 上次执行完后再等 | 执行时间不固定的任务 |
| fixedRate | 固定频率执行 | 心跳、监控等 |
| initialDelay | 首次延迟 | 项目启动后延迟执行 |

## 四、实际工作中的示例

### 示例1：每天凌晨同步数据

```java
@Component
@Slf4j
public class DataSyncTask {

    @Autowired
    private DataService dataService;

    @Scheduled(cron = "0 0 2 * * ?")  // 每天凌晨2点执行
    public void syncData() {
        log.info("开始同步数据");
        try {
            dataService.syncFromThirdParty();
            log.info("数据同步完成");
        } catch (Exception e) {
            log.error("数据同步失败", e);
        }
    }
}
```

### 示例2：每5分钟检查超时订单

```java
@Component
@Slf4j
public class OrderTimeoutTask {

    @Autowired
    private OrderService orderService;

    @Scheduled(cron = "0 0/5 * * * ?")  // 每5分钟执行
    public void checkTimeout() {
        log.info("开始检查超时订单");
        int count = orderService.cancelTimeoutOrders();
        log.info("取消了{}个超时订单", count);
    }
}
```

### 示例3：定时清理临时文件

```java
@Component
@Slf4j
public class FileCleanTask {

    @Scheduled(cron = "0 0 3 * * ?")  // 每天凌晨3点执行
    public void cleanTempFiles() {
        log.info("开始清理临时文件");
        // 删除7天前的临时文件
        File tempDir = new File("/tmp");
        // 清理逻辑...
        log.info("临时文件清理完成");
    }
}
```

### 示例4：带有任务开关的定时任务（真实工作场景必备）

**业务痛点：**

1.  **本地开发抢数据：** 本地启动项目时，如果不小心触发了定时任务，会把测试环境的数据处理掉，影响测试同事。
2.  **线上紧急止血：** 线上定时任务出现严重 Bug，如果代码里没有开关，只能紧急发版或者直接停机。

**解决方案：** 结合配置文件（配合 Nacos / Apollo 等动态配置中心使用效果最佳）实现任务的动态控制。

**application.yml 配置：**

YAML

```yml
# 定时任务开关配置
task:
  user-sync:
    enabled: true  # 生产环境设为 true，本地开发环境设为 false
```

**Java 代码实现：**

Java

```java
@Component
@Slf4j
public class UserSyncTask {

    @Autowired
    private UserService userService;

    // 从配置文件中读取开关状态。冒号后面的 false 是默认值（防备没配报错）
    // 如果公司使用了 Nacos 或 Apollo，修改配置后这里的值会动态生效，无需重启服务
    @Value("${task.user-sync.enabled:false}")
    private boolean isTaskEnabled;

    @Scheduled(cron = "0 0/10 * * * ?")  // 每10分钟执行一次
    public void syncUser() {
        // 1. 任务开关判断（核心防御逻辑）
        if (!isTaskEnabled) {
            log.info("【用户同步定时任务】全局开关已关闭，本次跳过执行...");
            return;
        }

        log.info("【用户同步定时任务】开始执行...");
        try {
            // 2. 执行核心业务逻辑
            userService.syncUserData();
            log.info("【用户同步定时任务】执行成功");
        } catch (Exception e) {
            // 3. 异常捕获，防止单次报错导致后续不再调度
            log.error("【用户同步定时任务】执行发生异常", e);
        }
    }
}
```

> **🔥 进阶写法（更优雅的 Spring 原生方式）：** 如果你希望在本地环境**彻底不加载**这个定时任务（连 Bean 都不创建），可以使用 `@ConditionalOnProperty` 注解代替代码里的 `if` 判断：
> 
> Java
> 
> ```java
> @Component
> @Slf4j
> // 只有当配置文件中 task.user-sync.enabled=true 时，这个定时任务才会生效
> @ConditionalOnProperty(name = "task.user-sync.enabled", havingValue = "true")
> public class UserSyncTask {
>     
>     @Scheduled(cron = "0 0/10 * * * ?")
>     public void syncUser() {
>         // 直接写业务逻辑，不需要再做 if 判断了
>     }
> }
> ```
> 
> 注意：@ConditionalOnProperty的方式只能在项目启动时决定是否开启，不支持不重启服务动态切换。真实工作中可根据实际需求选择这两种开关方式。

## 五、多线程配置（进阶）

### 问题：默认单线程

```java
@Scheduled(cron = "0/5 * * * * ?")
public void task1() throws InterruptedException {
    Thread.sleep(10000);  // 执行10秒
    System.out.println("任务1");
}

@Scheduled(cron = "0/5 * * * * ?")
public void task2() {
    System.out.println("任务2");
}
// task2要等task1执行完才能执行
```

### 解决方案：配置线程池

```java
@Configuration
@EnableScheduling
public class ScheduleConfig implements SchedulingConfigurer {

    @Override
    public void configureTasks(ScheduledTaskRegistrar taskRegistrar) {
        // 配置10个线程
        taskRegistrar.setScheduler(Executors.newScheduledThreadPool(10));
    }
}
```

配置后，多个定时任务可以并行执行。

## 六、常见问题

### 1、定时任务不执行？

**检查：**

-   启动类有没有加 `@EnableScheduling`
-   类有没有加 `@Component`
-   cron表达式是否正确
-   定时任务注解@Scheduled修饰的方法不能有入参

### 2、任务执行时间过长影响其他任务？

**解决：**

-   配置线程池，让任务并行执行
-   或者优化任务执行效率

### 3、多台服务器都会执行怎么办？

Scheduled不支持集群，每台服务器都会执行。

**解决方案：**

-   使用XXL-Job等分布式任务调度框架
-   或者用数据库锁让只有一台服务器执行

## 七、注意事项

1.  **记得打日志**：定时任务要记录执行情况
2.  **异常处理**：加try-catch，避免异常导致任务停止
3.  **执行时间**：避免任务执行时间超过间隔时间
4.  **集群问题**：Scheduled不支持集群，每台机器都会执行
5.  **线程池**：多个任务建议配置线程池
6.  **执行时间错开**：系统中如果有大量定时任务，把执行时间错开，不要出现某一时刻大量定时任务同时执行的现象
7.  **方法签名的硬性要求**：被@Scheduled修饰的方法**必须且只能返回 `void`**，且**不能有任何入参**。如果加了入参或者返回值，Spring 容器在初始化调度器时会直接报错或忽略。
