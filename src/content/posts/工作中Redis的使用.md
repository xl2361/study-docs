---
title: "工作中Redis的使用"
published: 2026-08-01
description: "工作中Redis的使用"
category: "技术篇"
draft: false
---

## 一、什么是Redis？

Redis是一个开源的内存数据结构存储系统，可以用作数据库、缓存和消息中间件。它支持多种类型的数据结构，如字符串、哈希、列表、集合、有序集合等。

### 1、Redis的特点

| 特点 | 说明 |
| --- | --- |
| 高性能 | 数据存储在内存中，读写速度极快，QPS可达10万+ |
| 丰富的数据类型 | 支持String、Hash、List、Set、ZSet等多种数据结构 |
| 持久化 | 支持RDB和AOF两种持久化方式，防止数据丢失 |
| 支持集群 | 支持主从复制和集群模式，实现高可用 |
| 原子性 | 所有操作都是原子性的，支持事务 |

### 2、Redis的五种基本数据类型

| 数据类型 | 说明 | 适用场景 |
| --- | --- | --- |
| String | 最基本的类型，可以存储字符串、整数、浮点数 | 缓存、计数器、分布式锁 |
| Hash | 键值对集合，适合存储对象 | 用户信息、商品信息 |
| List | 有序列表，支持从两端插入和弹出 | 消息队列、最新列表 |
| Set | 无序集合，元素唯一 | 标签、共同关注 |
| ZSet | 有序集合，每个元素关联一个分数 | 排行榜、延时队列 |

## 二、项目中如何使用Redis

### 1、项目中首次使用Redis

#### 1.1 引入依赖

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

#### 1.2 配置Redis信息

**基础配置：**

```yaml
spring:
  redis:
    host: 127.0.0.1
    port: 6379
    password: 123456
    database: 0
```

**完整配置（推荐）：**

```yaml
spring:
  redis:
    host: 127.0.0.1
    port: 6379
    password: 123456
    database: 0
    timeout: 10000ms
    lettuce:
      pool:
        max-active: 8        # 连接池最大连接数
        max-wait: -1ms       # 连接池最大阻塞等待时间（负值表示无限制）
        max-idle: 8          # 连接池最大空闲连接
        min-idle: 0          # 连接池最小空闲连接
```

#### 1.3 配置RedisTemplate

```java
@Configuration
public class RedisConfig {

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory factory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);

        // 使用Jackson2JsonRedisSerializer来序列化和反序列化redis的value值
        Jackson2JsonRedisSerializer<Object> jackson2JsonRedisSerializer = new Jackson2JsonRedisSerializer<>(Object.class);
        ObjectMapper mapper = new ObjectMapper();
        mapper.setVisibility(PropertyAccessor.ALL, JsonAutoDetect.Visibility.ANY);
        mapper.activateDefaultTyping(LaissezFaireSubTypeValidator.instance, ObjectMapper.DefaultTyping.NON_FINAL);
        jackson2JsonRedisSerializer.setObjectMapper(mapper);

        // 使用StringRedisSerializer来序列化和反序列化redis的key值
        StringRedisSerializer stringRedisSerializer = new StringRedisSerializer();

        // key采用String的序列化方式
        template.setKeySerializer(stringRedisSerializer);
        // hash的key也采用String的序列化方式
        template.setHashKeySerializer(stringRedisSerializer);
        // value序列化方式采用jackson
        template.setValueSerializer(jackson2JsonRedisSerializer);
        // hash的value序列化方式采用jackson
        template.setHashValueSerializer(jackson2JsonRedisSerializer);

        template.afterPropertiesSet();
        return template;
    }
}
```

#### 1.4 写Redis工具类

```java
@Component
public class RedisUtils {

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    // =============================String类型操作=============================

    /**
     * 设置缓存
     */
    public void set(String key, Object value, long time) {
        redisTemplate.opsForValue().set(key, value, time, TimeUnit.SECONDS);
    }

    /**
     * 获取缓存
     */
    public Object get(String key) {
        return key == null ? null : redisTemplate.opsForValue().get(key);
    }

    /**
     * 判断key是否存在
     */
    public Boolean hasKey(String key) {
        return redisTemplate.hasKey(key);
    }

    /**
     * 删除缓存
     */
    public Boolean delete(String key) {
        return redisTemplate.delete(key);
    }

    /**
     * 批量删除
     */
    public Long delete(Collection<String> keys) {
        return redisTemplate.delete(keys);
    }

    /**
     * 设置过期时间
     */
    public Boolean expire(String key, long time) {
        return redisTemplate.expire(key, time, TimeUnit.SECONDS);
    }

    /**
     * 获取过期时间
     */
    public Long getExpire(String key) {
        return redisTemplate.getExpire(key, TimeUnit.SECONDS);
    }

    /**
     * 自增
     */
    public Long increment(String key) {
        return redisTemplate.opsForValue().increment(key);
    }

    /**
     * 自增指定值
     */
    public Long increment(String key, long delta) {
        return redisTemplate.opsForValue().increment(key, delta);
    }

    /**
     * 自减
     */
    public Long decrement(String key) {
        return redisTemplate.opsForValue().decrement(key);
    }

    // =============================Hash类型操作=============================

    /**
     * 获取Hash中的值
     */
    public Object hGet(String key, String field) {
        return redisTemplate.opsForHash().get(key, field);
    }

    /**
     * 设置Hash中的值
     */
    public void hSet(String key, String field, Object value) {
        redisTemplate.opsForHash().put(key, field, value);
    }

    /**
     * 获取Hash中所有值
     */
    public Map<Object, Object> hGetAll(String key) {
        return redisTemplate.opsForHash().entries(key);
    }

    /**
     * 设置整个Hash
     */
    public void hSetAll(String key, Map<String, Object> map) {
        redisTemplate.opsForHash().putAll(key, map);
    }

    /**
     * 删除Hash中的字段
     */
    public Long hDelete(String key, Object... fields) {
        return redisTemplate.opsForHash().delete(key, fields);
    }

    /**
     * 判断Hash中是否存在该字段
     */
    public Boolean hHasKey(String key, String field) {
        return redisTemplate.opsForHash().hasKey(key, field);
    }

    // =============================List类型操作=============================

    /**
     * 获取List中的值
     */
    public Object lGet(String key, long index) {
        return redisTemplate.opsForList().index(key, index);
    }

    /**
     * 获取List指定范围内的值
     */
    public List<Object> lGet(String key, long start, long end) {
        return redisTemplate.opsForList().range(key, start, end);
    }

    /**
     * 从右边插入
     */
    public Long lPush(String key, Object value) {
        return redisTemplate.opsForList().rightPush(key, value);
    }

    /**
     * 从右边弹出
     */
    public Object rPop(String key) {
        return redisTemplate.opsForList().rightPop(key);
    }

    /**
     * 获取List长度
     */
    public Long lSize(String key) {
        return redisTemplate.opsForList().size(key);
    }
}
```

#### 1.5 使用Redis工具类

```java
@Service
public class UserService {

    @Autowired
    private RedisUtils redisUtils;

    public User getUserById(String userId) {
        // 先从缓存获取
        Object cached = redisUtils.get("user:" + userId);
        if (cached != null) {
            return (User) cached;
        }

        // 缓存没有，从数据库查询
        User user = userMapper.selectById(userId);

        // 存入缓存，设置1小时过期
        if (user != null) {
            redisUtils.set("user:" + userId, user, 3600);
        }

        return user;
    }

    public void updateUser(User user) {
        // 更新数据库
        userMapper.updateById(user);

        // 删除缓存（保证一致性）
        redisUtils.delete("user:" + user.getId());
    }
}
```

### 2、项目中非首次使用Redis

直接可以使用 `Ctrl + Shift + R` 全局搜索redis，参考别人的代码是如何使用的，照葫芦画瓢（这个技能很重要）。

## 三、项目中使用Redis的常见场景

### 1、缓存热点数据

有些图表数据来源的表数据较多，处理过程复杂，导致接口响应慢，可以使用Redis缓存。

```java
public List<DataVO> getChartData(String type) {
    String cacheKey = "chart:data:" + type;

    // 先查缓存
    Object cached = redisUtils.get(cacheKey);
    if (cached != null) {
        return (List<DataVO>) cached;
    }

    // 查询数据库并处理
    List<DataVO> data = processData(type);

    // 存入缓存，5分钟过期
    redisUtils.set(cacheKey, data, 300);

    return data;
}
```

### 2、存储验证码/Token

```java
// 存储验证码，5分钟过期
public void saveVerifyCode(String phone, String code) {
    redisUtils.set("verify:" + phone, code, 300);
}

// 验证验证码
public boolean verifyCode(String phone, String code) {
    Object cached = redisUtils.get("verify:" + phone);
    return code.equals(cached);
}
```

### 3、分布式锁

使用Redis实现分布式锁，防止重复操作：

```java
public boolean tryLock(String lockKey, String requestId, int expireTime) {
    Boolean result = redisTemplate.opsForValue()
        .setIfAbsent(lockKey, requestId, expireTime, TimeUnit.SECONDS);
    return Boolean.TRUE.equals(result);
}

public boolean releaseLock(String lockKey, String requestId) {
    String script = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
    RedisScript<Long> redisScript = RedisScript.of(script, Long.class);
    Long result = redisTemplate.execute(redisScript, Collections.singletonList(lockKey), requestId);
    return result != null && result == 1L;
}
```

**推荐使用Redisson实现分布式锁：**

```xml
<dependency>
    <groupId>org.redisson</groupId>
    <artifactId>redisson-spring-boot-starter</artifactId>
    <version>3.23.4</version>
</dependency>
```
```java
@Autowired
private RedissonClient redissonClient;

public void doSomething() {
    RLock lock = redissonClient.getLock("myLock");
    try {
        // 尝试获取锁，最多等待10秒，锁30秒后自动释放
        if (lock.tryLock(10, 30, TimeUnit.SECONDS)) {
            // 执行业务逻辑
        }
    } finally {
        if (lock.isHeldByCurrentThread()) {
            lock.unlock();
        }
    }
}
```

### 4、计数器

```java
// 点赞数增加
public void likeArticle(String articleId) {
    redisUtils.increment("article:like:" + articleId);
}

// 获取点赞数
public Long getLikeCount(String articleId) {
    Object count = redisUtils.get("article:like:" + articleId);
    return count == null ? 0L : Long.parseLong(count.toString());
}
```

### 5、限流

使用Redis实现简单的限流：

```java
public boolean allowRequest(String userId, int maxCount, int seconds) {
    String key = "rate:" + userId;
    Long count = redisUtils.increment(key);

    if (count == 1) {
        redisUtils.expire(key, seconds);
    }

    return count <= maxCount;
}
```

## 四、缓存三大问题

### 1、缓存穿透

**问题**：查询一个不存在的数据，缓存中没有，数据库中也没有。导致每次请求都穿透缓存直接查询数据库。

**解决方案：**

| 方案 | 说明 |
| --- | --- |
| 缓存空值 | 查询结果为空时，也将空值缓存起来，设置较短的过期时间 |
| 布隆过滤器 | 在查询前先判断数据是否可能存在，不存在直接返回 |

```java
public User getUserById(String userId) {
    Object cached = redisUtils.get("user:" + userId);
    if (cached != null) {
        if ("NULL".equals(cached)) {
            return null;  // 命中空值
        }
        return (User) cached;
    }

    User user = userMapper.selectById(userId);
    if (user != null) {
        redisUtils.set("user:" + userId, user, 3600);
    } else {
        // 缓存空值，5分钟过期
        redisUtils.set("user:" + userId, "NULL", 300);
    }
    return user;
}
```

### 2、缓存击穿

**问题**：某个热点key过期，此时大量请求同时查询这个key，全部穿透到数据库。

**解决方案：**

| 方案 | 说明 |
| --- | --- |
| 热点数据永不过期 | 对于真正的热点数据，可以不设置过期时间 |
| 加互斥锁 | 只允许一个线程去查询数据库，其他线程等待 |

```java
public User getUserWithLock(String userId) {
    Object cached = redisUtils.get("user:" + userId);
    if (cached != null) {
        return (User) cached;
    }

    // 获取分布式锁
    String lockKey = "lock:user:" + userId;
    try {
        if (tryLock(lockKey, "1", 10)) {
            // 再次检查缓存
            cached = redisUtils.get("user:" + userId);
            if (cached != null) {
                return (User) cached;
            }

            // 查询数据库
            User user = userMapper.selectById(userId);
            if (user != null) {
                redisUtils.set("user:" + userId, user, 3600);
            }
            return user;
        } else {
            // 获取锁失败，等待后重试
            Thread.sleep(50);
            return getUserWithLock(userId);
        }
    } finally {
        releaseLock(lockKey, "1");
    }
}
```

### 3、缓存雪崩

**问题**：大量缓存key在同一时间集中过期，导致所有请求都落到数据库上。

**解决方案：**

| 方案 | 说明 |
| --- | --- |
| 过期时间加随机值 | 在基础过期时间上增加随机值，避免同时过期 |
| 多级缓存 | 使用多级缓存，如本地缓存 + Redis |
| 熔断降级 | 当数据库压力过大时，进行熔断降级 |

```java
// 过期时间加随机值
public void setWithRandomExpire(String key, Object value, long baseTime) {
    long randomTime = baseTime + new Random().nextInt(300);
    redisUtils.set(key, value, randomTime);
}
```

## 五、缓存一致性策略

对于缓存一致性问题，直接先更新数据库，再删除缓存就能满足大部分的场景。

```
更新数据库 -> 删除缓存 -> 下次查询时重新写入缓存
```

**为什么是删除缓存而不是更新缓存？**

| 策略 | 优点 | 缺点 |
| --- | --- | --- |
| 删除缓存 | 简单，避免无效计算 | 下次查询需要重新加载 |
| 更新缓存 | 下次查询更快 | 可能更新了但没被使用，浪费资源 |

**延时双删策略**（更高一致性要求）：

```
删除缓存 -> 更新数据库 -> 延时几百毫秒 -> 再次删除缓存
```

## 六、Redis常用命令

### 1、String类型

| 命令 | 说明 |
| --- | --- |
| SET key value | 设置键值 |
| GET key | 获取值 |
| DEL key | 删除键 |
| EXPIRE key seconds | 设置过期时间 |
| SETNX key value | 不存在时才设置 |
| INCR key | 自增1 |
| DECR key | 自减1 |

### 2、Hash类型

| 命令 | 说明 |
| --- | --- |
| HSET key field value | 设置Hash字段值 |
| HGET key field | 获取Hash字段值 |
| HGETALL key | 获取Hash所有字段和值 |
| HDEL key field | 删除Hash字段 |
| HEXISTS key field | 判断字段是否存在 |

### 3、List类型

| 命令 | 说明 |
| --- | --- |
| LPUSH key value | 从左边插入 |
| RPUSH key value | 从右边插入 |
| LPOP key | 从左边弹出 |
| RPOP key | 从右边弹出 |
| LRANGE key start stop | 获取指定范围元素 |

### 4、通用命令

| 命令 | 说明 |
| --- | --- |
| KEYS pattern | 查找匹配的键（生产环境慎用） |
| TTL key | 查看剩余过期时间 |
| TYPE key | 查看键的类型 |
| EXISTS key | 判断键是否存在 |
| FLUSHDB | 清空当前数据库 |

## 七、常见问题排查

### 1、连接超时

**可能原因：**

-   Redis服务未启动
-   防火墙未放行端口
-   配置的IP或端口错误
-   密码错误

**排查命令：**

```bash
# 测试端口连通性
telnet 127.0.0.1 6379

# 使用redis-cli连接测试
redis-cli -h 127.0.0.1 -p 6379 -a password
```

### 2、内存占用过高

**排查方法：**

```bash
# 查看Redis内存使用情况
redis-cli info memory

# 查看大key
redis-cli --bigkeys
```

### 3、响应慢

**可能原因：**

-   执行了慢查询（如KEYS \*）
-   存在大key
-   网络延迟
