---
title: "工作中ES的使用"
published: 2026-08-01
description: "工作中ES的使用"
category: "技术篇"
draft: false
---

## 一、ES到底是什么？

### 1、什么是ES（Elasticsearch）？

> **简单说：ES是一个搜索引擎，擅长在海量数据中快速搜索。**

**为什么需要ES？**

你可能会问：MySQL也能查询啊，为什么还要ES？

| 对比项 | MySQL | ES |
| --- | --- | --- |
| 模糊查询 | LIKE '%xxx%'，很慢 | 分词搜索，很快 |
| 百万级数据 | 查询变慢 | 依然很快 |
| 复杂搜索 | 写复杂SQL | 简单API调用 |
| 全文检索 | 效率低 | 专门干这个的 |

**结论：搜索功能、大量数据的查询，用ES。**

### 2、ES和MySQL概念对比

| MySQL | ES | 说明 |
| --- | --- | --- |
| 数据库 | 索引（Index） | 数据的集合 |
| 表 | 类型（Type） | 7.x后已废弃，一个索引就是一个表 |
| 行 | 文档（Document） | 一条数据 |
| 列 | 字段（Field） | 一个属性 |
| 表结构 | 映射（Mapping） | 字段定义 |

### 3、什么时候用ES？

| 场景 | 是否用ES |
| --- | --- |
| 商品搜索 | 是 |
| 日志分析 | 是 |
| 百万级数据查询 | 是 |
| 简单的增删改查 | 否，用MySQL |
| 事务操作 | 否，用MySQL |

## 二、核心概念

### 1、索引（Index）

就是数据库，存放数据的地方。

```
商品索引：product_index
用户索引：user_index
订单索引：order_index
```

### 2、文档（Document）

就是一条数据，JSON格式。

```json
{
    "id": 1,
    "name": "iPhone 15",
    "price": 5999,
    "category": "手机"
}
```

### 3、映射（Mapping）

就是表结构，定义字段类型。

```json
{
    "mappings": {
        "properties": {
            "id": { "type": "long" },
            "name": { "type": "text" },
            "price": { "type": "integer" },
            "category": { "type": "keyword" }
        }
    }
}
```

**常用字段类型：**

| 类型 | 说明 | 例子 |
| --- | --- | --- |
| text | 可分词的文本 | 商品描述 |
| keyword | 精确匹配 | 品牌、状态 |
| integer/long | 整数 | 价格、数量 |
| double | 小数 | 金额 |
| date | 日期 | 创建时间 |
| boolean | 布尔 | 是否上架 |

### 4、倒排索引

**原理：** 把内容分词，建立 词→文档ID 的映射。

```
文档1：苹果手机很好用
文档2：华为手机性价比高

分词后：
苹果 → [文档1]
手机 → [文档1, 文档2]
很好用 → [文档1]
华为 → [文档2]
性价比高 → [文档2]

搜索"手机"，直接找到文档1和文档2
```

## 三、SpringBoot整合ES

### 方案选择

| 方案 | 说明 | 推荐度 |
| --- | --- | --- |
| Spring Data Elasticsearch | 像用JPA一样用ES | 推荐，简单 |
| RestHighLevelClient | 官方客户端（7.x） | 推荐，灵活 |
| Elasticsearch Java Client | 官方新客户端（8.x） | ES 8.x用这个 |

**新人建议：先学Spring Data Elasticsearch，最简单。**

## 四、Spring Data Elasticsearch（推荐）

### 第一步：引入依赖

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-elasticsearch</artifactId>
</dependency>
```

### 第二步：配置连接

```yaml
spring:
  elasticsearch:
    uris: http://127.0.0.1:9200
    username: elastic
    password: 123456
```

### 第三步：定义实体类

```java
@Document(indexName = "product")  // 索引名称
@Data
public class Product {

    @Id
    private Long id;

    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String name;  // 商品名称，支持分词

    @Field(type = FieldType.Keyword)
    private String category;  // 分类，精确匹配

    @Field(type = FieldType.Double)
    private Double price;  // 价格

    @Field(type = FieldType.Integer)
    private Integer stock;  // 库存
}
```

### 第四步：定义Repository

```java
@Repository
public interface ProductRepository extends ElasticsearchRepository<Product, Long> {

    // 按名称模糊查询
    List<Product> findByName(String name);

    // 按分类查询
    List<Product> findByCategory(String category);

    // 价格区间查询
    List<Product> findByPriceBetween(Double min, Double max);

    // 自定义查询：名称包含关键字
    @Query("{\"match\": {\"name\": \"?0\"}}")
    List<Product> searchByName(String keyword);
}
```

### 第五步：使用

```java
@Service
@Slf4j
public class ProductService {

    @Autowired
    private ProductRepository productRepository;

    // 1. 新增/更新文档
    public void save(Product product) {
        productRepository.save(product);
        log.info("保存成功");
    }

    // 2. 批量新增
    public void saveAll(List<Product> products) {
        productRepository.saveAll(products);
    }

    // 3. 根据ID查询
    public Product getById(Long id) {
        return productRepository.findById(id).orElse(null);
    }

    // 4. 查询所有
    public List<Product> getAll() {
        Iterable<Product> all = productRepository.findAll();
        List<Product> list = new ArrayList<>();
        all.forEach(list::add);
        return list;
    }

    // 5. 删除
    public void delete(Long id) {
        productRepository.deleteById(id);
    }

    // 6. 按名称搜索
    public List<Product> searchByName(String name) {
        return productRepository.findByName(name);
    }

    // 7. 价格区间查询
    public List<Product> searchByPriceRange(Double min, Double max) {
        return productRepository.findByPriceBetween(min, max);
    }
}
```

## 五、复杂查询

### 使用ElasticsearchRestTemplate

```java
@Service
@Slf4j
public class ProductSearchService {

    @Autowired
    private ElasticsearchRestTemplate esTemplate;

    /**
     * 多条件搜索
     * 支持关键字搜索 + 分类筛选 + 价格区间
     */
    public List<Product> search(String keyword, String category, Double minPrice, Double maxPrice) {
        // 1. 构建查询条件
        NativeSearchQueryBuilder queryBuilder = new NativeSearchQueryBuilder();

        // bool查询（组合查询）
        BoolQueryBuilder boolQuery = QueryBuilders.boolQuery();

        // 关键字搜索（must：必须满足）
        if (StringUtils.isNotBlank(keyword)) {
            boolQuery.must(QueryBuilders.matchQuery("name", keyword));
        }

        // 分类筛选（filter：过滤，不参与评分）
        if (StringUtils.isNotBlank(category)) {
            boolQuery.filter(QueryBuilders.termQuery("category", category));
        }

        // 价格区间
        if (minPrice != null && maxPrice != null) {
            boolQuery.filter(QueryBuilders.rangeQuery("price")
                    .gte(minPrice)
                    .lte(maxPrice));
        }

        queryBuilder.withQuery(boolQuery);

        // 2. 执行查询
        SearchHits<Product> hits = esTemplate.search(queryBuilder.build(), Product.class);

        // 3. 处理结果
        return hits.getSearchHits().stream()
                .map(SearchHit::getContent)
                .collect(Collectors.toList());
    }

    /**
     * 分页查询
     */
    public Page<Product> searchPage(String keyword, int page, int size) {
        NativeSearchQueryBuilder queryBuilder = new NativeSearchQueryBuilder();

        // 关键字搜索
        if (StringUtils.isNotBlank(keyword)) {
            queryBuilder.withQuery(QueryBuilders.matchQuery("name", keyword));
        }

        // 分页
        queryBuilder.withPageable(PageRequest.of(page, size));

        // 排序（按价格升序）
        queryBuilder.withSort(SortBuilders.fieldSort("price").order(SortOrder.ASC));

        SearchHits<Product> hits = esTemplate.search(queryBuilder.build(), Product.class);

        // 转换结果
        List<Product> list = hits.getSearchHits().stream()
                .map(SearchHit::getContent)
                .collect(Collectors.toList());

        return new PageImpl<>(list, PageRequest.of(page, size), hits.getTotalHits());
    }
}
```

## 六、常用查询类型

| 查询类型 | 说明 | 示例 |
| --- | --- | --- |
| match | 分词匹配 | 搜索"苹果手机"会分词 |
| term | 精确匹配 | 搜索"iPhone15"必须完全一致 |
| range | 范围查询 | 价格100-500 |
| bool | 组合查询 | 多条件组合 |
| wildcard | 通配符 | "apple*" |

```java
// match查询（分词）
QueryBuilders.matchQuery("name", "苹果手机");

// term查询（精确）
QueryBuilders.termQuery("category", "手机");

// range查询（范围）
QueryBuilders.rangeQuery("price").gte(100).lte(500);

// bool查询（组合）
BoolQueryBuilder boolQuery = QueryBuilders.boolQuery();
boolQuery.must(QueryBuilders.matchQuery("name", "手机"));
boolQuery.filter(QueryBuilders.termQuery("category", "手机"));
```

## 七、ES和MySQL数据同步

> **实际工作中，数据存MySQL，搜索用ES，需要保持同步。**

### 常见方案

| 方案 | 说明 | 优缺点 |
| --- | --- | --- |
| 同步双写 | 写MySQL同时写ES | 简单，但可能不一致 |
| 异步消息 | 写MySQL发MQ，消费写ES | 解耦，推荐 |
| Canal监听 | 监听MySQL binlog | 无侵入，复杂 |

### 简单示例：同步双写

```java
@Service
@Transactional
public class ProductServiceImpl implements ProductService {

    @Autowired
    private ProductMapper productMapper;  // MySQL

    @Autowired
    private ProductRepository productRepository;  // ES

    /**
     * 新增商品
     */
    public void addProduct(Product product) {
        // 1. 存MySQL
        productMapper.insert(product);

        // 2. 存ES
        productRepository.save(product);
    }

    /**
     * 更新商品
     */
    public void updateProduct(Product product) {
        // 1. 更新MySQL
        productMapper.updateById(product);

        // 2. 更新ES
        productRepository.save(product);  // ES的save是新增或更新
    }

    /**
     * 删除商品
     */
    public void deleteProduct(Long id) {
        // 1. 删除MySQL
        productMapper.deleteById(id);

        // 2. 删除ES
        productRepository.deleteById(id);
    }
}
```

## 八、新人避坑指南

| 坑 | 正确做法 |
| --- | --- |
| 连不上ES | 检查地址、端口、账号密码 |
| 搜索不到数据 | 检查分词器配置，字段类型 |
| 中文搜索不准 | 安装IK分词器 |
| 字段类型错误 | text支持分词，keyword精确匹配 |
| 数据不同步 | 写MySQL后记得同步到ES |
| 没建索引就存数据 | 先创建索引和映射 |

## 九、问同事的问题

刚入职用ES时，可以问同事：

| 问题 | 说明 |
| --- | --- |
| "ES地址是什么？" | 配置需要 |
| "索引命名有什么规范吗？" | 了解命名规范 |
| "用的哪个客户端？" | 确认技术方案 |
| "有IK分词器吗？" | 中文搜索需要 |
| "数据怎么同步的？" | 了解同步方案 |

## 十、注意事项

1.  **ES不是数据库**：主要用来搜索，不是用来存数据
2.  **分词器很重要**：中文要用IK分词器
3.  **字段类型要选对**：text分词，keyword精确匹配
4.  **数据要同步**：MySQL和ES数据要一致
5.  **不要深度分页**：from+size不要超过10000

## 十一、ES 8.x 新客户端（了解）

如果项目用的是ES 8.x，要用新的Java Client：

```xml
<dependency>
    <groupId>co.elastic.clients</groupId>
    <artifactId>elasticsearch-java</artifactId>
    <version>8.11.0</version>
</dependency>
```

用法类似，只是API略有不同。

## 十二、终极建议

> **ES不难，关键是理解它和MySQL的区别，知道什么时候用ES。**

**使用步骤记住五步：**

1.  确认ES地址和版本
2.  引入依赖
3.  定义实体类（加@Document注解）
4.  定义Repository（继承ElasticsearchRepository）
5.  直接调用方法使用

**记住：搜索功能、大量数据查询用ES，普通CRUD用MySQL！**
