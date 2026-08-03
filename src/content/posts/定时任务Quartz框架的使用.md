---
title: "定时任务Quartz框架的使用"
published: 2026-08-01
description: "定时任务Quartz框架的使用"
category: "技术篇"
draft: false
---

## 一、基础概述

![分布式定时任务鼻祖Quartz架构图](/uploads/images/2026-04-18/51e15cdb-c084-4373-9c81-c4bd9abd672e.png)

### 1、什么是Quartz？

> **简单说：Quartz是一个强大的企业级定时任务框架，用来在指定时间、按照复杂规则自动执行代码。**

**生活中的例子：**

-   每天凌晨2点备份数据库
-   每小时同步一次上游系统数据
-   每月最后一天晚上23点生成对账报表

### 2、为什么学Quartz？

你可能会问：Spring的`@Scheduled`不是也能做定时任务吗？

| 对比项 | @Scheduled | Quartz |
| --- | --- | --- |
| 使用难度 | 极简，加个注解即可 | 相对复杂，有体系概念 |
| 动态修改 | 不支持（改了要重启服务器） | 完全支持动态增删改查 |
| 持久化 | 不支持（全在内存） | 支持（任务信息存数据库，重启不丢） |
| 集群支持 | 不支持（多台机器会重复跑） | 支持（自带集群分布式锁机制） |
| 任务管理 | 代码里写死，像个黑盒 | 可接入前端页面动态管理 |

**结论：简单且固定的场景用 `@Scheduled`，需要动态管理、怕重启丢任务、有多台服务器集群的场景，必须用 Quartz（或 XXL-Job 等）。**

### 3、Quartz三个核心概念

| 概念 | 说明 | 类比 |
| --- | --- | --- |
| Job（任务） | 具体要干的事 | 具体的工作内容 |
| Trigger（触发器） | 定义什么时候执行 | 工作时间表 |
| Scheduler（调度器） | 把Job和Trigger组合起来 | 老板，统筹安排工作 |

Plaintext

```
Job（做什么） + Trigger（什么时候做） = Scheduler（安排执行）
```

## 二、快速入门（最简内存版 Demo）

*这部分用于快速理解 Quartz 的骨架，任务信息保存在内存中，重启后重置。*

### 第一步：引入依赖

只要引入 Spring Boot 的官方 Starter，底层依赖全部帮你搞定。

XML

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-quartz</artifactId>
</dependency>
```

### 第二步：创建任务类（🔥 优雅写法）

> **避坑：** 很多老教程教你实现 `Job` 接口，然后告诉你无法使用 `@Autowired`。在 Spring Boot 中，**强烈建议继承 `QuartzJobBean`**，这样就可以直接快乐地注入任何 Service 了！

Java

```Java
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.quartz.QuartzJobBean;
import org.springframework.stereotype.Component;
import java.util.Date;

@Component
public class MyJob extends QuartzJobBean {

    // 继承 QuartzJobBean 后，直接使用 @Autowired 注入，非常优雅！
    @Autowired
    private OrderService orderService;

    @Override
    protected void executeInternal(JobExecutionContext context) throws JobExecutionException {
        System.out.println("定时任务执行了：" + new Date());
        // 直接调用你的业务逻辑
        orderService.doSomething();
    }
}
```

### 第三步：创建配置类（老板分配工作）

Java

```Java
@Configuration
public class QuartzConfig {

    @Bean
    public JobDetail myJobDetail() {
        // 创建JobDetail，指定任务类
        return JobBuilder.newJob(MyJob.class)
                .withIdentity("myJob", "group1")  // 任务名称和分组
                .storeDurably()                    // 即使没有Trigger也保留在调度器中
                .build();
    }

    @Bean
    public Trigger myJobTrigger() {
        // 创建触发器，每10秒执行一次
        return TriggerBuilder.newTrigger()
                .forJob(myJobDetail())             // 关联上面的 JobDetail
                .withIdentity("myTrigger", "group1")  
                .withSchedule(SimpleScheduleBuilder.simpleSchedule()
                        .withIntervalInSeconds(10)  // 每10秒执行
                        .repeatForever())           // 无限重复
                .build();
    }
}
```

启动项目后，任务就会自动每 10 秒执行一次了。

* * *

## 三、两种核心 Trigger（触发器）

### 1、SimpleTrigger（简单触发器）

**适用场景：** 简单的重复执行，比如“每隔 X 分钟执行一次”、“延迟 X 秒后执行 10 次”。

Java

```Java
// 延迟立即开始，每5秒执行一次，共执行10次
Trigger trigger = TriggerBuilder.newTrigger()
        .startNow() 
        .withSchedule(SimpleScheduleBuilder.simpleSchedule()
                .withIntervalInSeconds(5)  
                .withRepeatCount(10))      
        .build();
```

### 2、CronTrigger（Cron触发器）

**适用场景：** 复杂的时间表达式，比如“每天凌晨2点”、“每周五下午4点”。

Java

```java
// 每天凌晨2点执行
Trigger trigger = TriggerBuilder.newTrigger()
        .withSchedule(CronScheduleBuilder.cronSchedule("0 0 2 * * ?"))
        .build();
```

> **🚨 注意：Quartz Cron 与 Linux Crontab 的区别**
> 
> 1.  Quartz 的 Cron 支持**秒级**（有 6~7 位），而 Linux 通常只有 5 位（没有秒）。
> 2.  Quartz 规定\*\*“日”和“周”必须有一个用 `?` 隔开\*\*以防冲突，Linux 不支持 `?`。
> 3.  强烈建议使用在线工具生成并测试：[https://cron.ciding.cc/](https://cron.ciding.cc/)

* * *

## 四、高阶必杀技：并发控制（极度重要）

**痛点：** 假设你的任务是每 5 分钟同步一次大量数据。如果某次同步数据量极大，跑了 8 分钟才跑完，但第 5 分钟的时候，Quartz 又会启动一个新线程去跑同步，**导致两个线程同时操作同一批数据，引发严重的死锁或脏数据！**

**解决方案：加一个 `@DisallowConcurrentExecution` 注解。**

Java

```Java
import org.quartz.DisallowConcurrentExecution;

@Component
@DisallowConcurrentExecution // 🔥加上这个注解，Quartz就会等上一次任务彻底跑完，再跑下一次，绝不并发！
public class SafeDataSyncJob extends QuartzJobBean {
    @Override
    protected void executeInternal(JobExecutionContext context) {
        // 耗时的业务逻辑...
    }
}
```

* * *

## 五、动态管理任务（企业级真实场景）

> **在真实的开发中，以下这些代码通常会被写在 Service 层，然后暴露成 Controller 接口。前端会画一个漂亮的后台管理页面，运营人员在页面上点击“新增”、“启动”、“暂停”按钮，本质上就是调用了这里的代码，从而实现不重启服务器就能掌控定时任务。**

通过 SpringBoot 自动注入的 `Scheduler` 对象，我们可以为所欲为：

Java

```Java
@Service
public class QuartzManageService {

    @Autowired
    private Scheduler scheduler;  

    // 1. 动态添加任务
    public void addJob(String jobName, String jobGroup, String cronExpression, Class<? extends Job> jobClass) throws Exception {
        JobDetail jobDetail = JobBuilder.newJob(jobClass).withIdentity(jobName, jobGroup).build();
        Trigger trigger = TriggerBuilder.newTrigger().withIdentity(jobName, jobGroup)
                .withSchedule(CronScheduleBuilder.cronSchedule(cronExpression)).build();
        scheduler.scheduleJob(jobDetail, trigger);
    }

    // 2. 暂停任务
    public void pauseJob(String jobName, String jobGroup) throws Exception {
        scheduler.pauseJob(JobKey.jobKey(jobName, jobGroup));
    }

    // 3. 恢复任务
    public void resumeJob(String jobName, String jobGroup) throws Exception {
        scheduler.resumeJob(JobKey.jobKey(jobName, jobGroup));
    }

    // 4. 立刻手动触发执行一次（不管时间到没到，常用于测试或数据紧急补偿）
    public void triggerJob(String jobName, String jobGroup) throws Exception {
        scheduler.triggerJob(JobKey.jobKey(jobName, jobGroup));
    }
}
```

* * *

## 六、企业级生产实战（持久化配置）

> **内存模式的致命弱点：** 一旦服务器重启，所有动态添加的任务、修改的时间全部丢失！
> 
> **企业级做法：** 开启 JDBC 持久化，让 Quartz 把任务数据、执行状态全部存到 MySQL 里。

### 1、准备数据库表

前往 Quartz 官网下载自带的 SQL 脚本（包含了 `QRTZ_JOB_DETAILS`、`QRTZ_TRIGGERS` 等十来张表），在你的 MySQL 数据库中执行建表。

### 2、修改 application.yml

只要加这几行配置，Spring Boot 会自动接管一切，从内存模式切换为数据库模式：

YAML

```yml
spring:
  quartz:
    job-store-type: jdbc  # 🔥核心：告诉Spring使用数据库存储任务信息
    jdbc:
      initialize-schema: never  # 不让它每次启动建表，我们手动建好了
    properties:
      org:
        quartz:
          jobStore:
            class: org.quartz.impl.jdbcjobstore.JobStoreTX
            driverDelegateClass: org.quartz.impl.jdbcjobstore.StdJDBCDelegate
            isClustered: true  # 🔥核心：开启集群支持。部署多台机器时，它们会抢数据库锁，保证任务只执行一次！
            clusterCheckinInterval: 10000 # 集群心跳检测时间
```

有了这两步，你的项目就已经具备了**分布式调度、防重跑、防宕机丢失**的企业级能力！

* * *

## 七、新人避坑指南

| 坑点 | 正确做法（避坑） |
| --- | --- |
| 任务类无法注入 Bean，报空指针 | 不要实现 Job 接口，改为继承 QuartzJobBean，即可完美使用 @Autowired。 |
| 任务执行时间过长，导致互相踩踏 | 在任务类名上方加上 @DisallowConcurrentExecution 注解，禁止并发。 |
| Linux 和代码的 Cron 语法冲突 | Quartz 的 Cron 有秒位，且日和周必须有一个用 ?。拿不准时一定要用在线生成工具，不要盲猜。 |
| 发版重启后，之前加的任务全没了 | 生产环境务必配置 spring.quartz.job-store-type=jdbc，走数据库持久化。 |
| 业务出了 Bug，导致定时任务彻底停摆 | 在 executeInternal 方法里，业务逻辑一定要 try-catch 包裹，并打上 log.error。千万别把异常抛给 Quartz 调度器，否则容易导致后续调度卡死。 |

* * *

## 八、技术选型对比（我该用哪个？）

| 维度 | @Scheduled | Quartz | XXL-Job / Elastic-Job |
| --- | --- | --- | --- |
| 上手难度 | 极低（1个注解） | 中等（需懂底层概念） | 中等（需额外部署调度中心） |
| 动态启停/改时间 | ❌ 不支持 | ✅ 支持（需自己写接口和页面） | ✅ 支持（自带漂亮的网页控制台） |
| 集群防重跑 | ❌ 不支持 | ✅ 支持（基于数据库锁） | ✅ 支持（支持分片广播等高级玩法） |
| 适用场景 | 适合单体小项目，时间固定的简单任务 | 适合不希望引入外部系统，但要求高可用、动态改任务的项目 | 适合大中型企业、微服务架构，任务海量且需要完善的监控告警 |

**💡 终极建议：**

1.  能简单就简单，小项目无脑用 `@Scheduled`。
2.  如果项目不能引入重量级的外部框架，但又要防重启、集群防重跑，直接上 **Quartz 持久化模式**。
3.  如果公司体量大、任务多，运维有现成的平台，不要自己造轮子，直接接入 **XXL-Job**。
