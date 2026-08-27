---
title: "Linux系统的使用"
published: 2026-08-01
description: "Linux系统的使用"
category: "开发工具"
draft: false
updated: 2026-08-27
tags: []
---


**为什么需要学习Linux系统的使用？**

因为在真实工作中，很多中间件以及我们的应用服务，通常都是部署在 **Linux 服务器** 上，而不是 Windows 系统。
所以，Linux 的常见操作是开发人员必须掌握的基础能力。

另外，Linux 的使用方式和 Windows 也不太一样。
Windows 更多是通过图形化界面进行管理，
而 Linux 在实际工作中，更多是通过**命令行**来完成文件查看、日志排查、服务启动、进程管理等操作。

因此，想要更好地适应真实开发工作，
Linux 的基本使用一定要会。

## 一、XShell 的使用  

### 1.1 什么是 XShell

XShell 是一个强大的安全终端模拟软件，支持SSH1、SSH2、SFTP、TELNET等多种协议，用于远程连接Linux服务器。它是Java开发人员日常工作中不可或缺的工具。

### 1.2 安装

![1](/uploads/images/2026-03-26/f12b5ff7-8fb3-4e42-b34d-c2cbee5df669.png)

### 1.3 连接服务器步骤

**第一步：创建新会话**

1. 打开 XShell，点击「文件」→「新建」
2. 或直接点击工具栏的「新建」图标

**第二步：配置连接信息**

| 配置项 | 说明 | 示例 |
|--------|------|------|
| 名称 | 会话名称（自定义，便于识别） | 正常服务器少的话，直接填写IP即可 |
| 协议 | 连接协议 | SSH |
| 主机 | 服务器IP地址 | 192.168.1.100 |
| 端口 | SSH端口 | 22（默认） |

![1](/uploads/images/2026-03-26/e31e83c5-9a9b-46d7-a01e-22975791ef20.png)

**第三步：配置用户认证**

1. 点击左侧「用户身份验证」

2. 输入用户名（如：root）

   ![1](/uploads/images/2026-03-26/7cd79f71-a4a6-4fd0-a634-47baf7ee317c.png)

3. 输入密码

4. 点击「确定」连接

   ![1](/uploads/images/2026-03-26/f80fd206-14c3-4fc9-a8d4-1191b03c6309.png)

### 1.4 保存会话技巧

建议按环境分类保存会话，方便管理：

```
XShell 会话管理
├── 生产环境
│   ├── 应用服务器1
│   ├── 应用服务器2
│   └── 数据库服务器
├── 测试环境
│   ├── 应用服务器
│   └── 数据库服务器
└── 开发环境
    └── 本地虚拟机
```

### 1.5 常见问题

**问题1：连接被拒绝**
- 检查IP地址和端口是否正确
- 检查服务器SSH服务是否启动：`systemctl status sshd`
- 检查防火墙是否开放22端口

**问题2：密码正确但无法登录**
- 检查用户名是否正确
- 检查服务器是否开启了密码登录
- 联系运维人员确认账号状态

**问题3：连接超时**

- 检查网络连通性：`ping 服务器IP`     `telnet 服务器IP  SSH端口` 
- 检查防火墙设置
- 确认SSH端口是不是默认端口22

**问题4：中文乱码**

- 将编码设置为 UTF-8

  ![1](/uploads/images/2026-03-26/197ee8cb-d59b-438b-8667-8d8696102450.png)

---

## 二、XFTP 的使用

### 2.1 什么是 XFTP

XFTP 是一个文件传输软件，用于在Windows和Linux之间安全地传输文件，支持SFTP、FTP等协议。通常与XShell配合使用。

### 2.2 安装

![6](/uploads/images/2026-03-26/c39239e9-37a7-4a1d-80ba-a67b145959a0.png)

### 2.3 连接服务器

在已连接的XShell会话中，点击工具栏的「XFTP」图标，可以直接打开XFTP并自动连接到当前服务器，无需重复输入密码。

![9](/uploads/images/2026-03-26/9b33531d-596e-4b77-8625-f1ed09463623.png)

### 2.4 界面说明

![9](/uploads/images/2026-03-26/e15f4ba2-ffc6-4b4e-b676-d2284d63a856.png)

### 2.5 文件传输操作

| 操作 | 方法 | 说明 |
|------|------|------|
| 上传 | 拖拽文件到右侧 / 选中后点击上传按钮 | 从本地上传文件到服务器 |
| 下载 | 拖拽文件到左侧 / 选中后点击下载按钮 | 从服务器下载文件到本地 |
| 新建文件夹 | 右键 → 新建文件夹 | 在当前目录创建文件夹 |
| 删除 | 右键 → 删除 / 选中后按Delete键 | 删除选中的文件或文件夹 |
| 重命名 | 右键 → 重命名 / 选中后按F2键 | 重命名文件或文件夹 |
| 编辑文件 | 右键 → 用记事本编辑 | 对文件内容进行编辑 |
| 修改权限 | 右键 → 更改权限 | 修改文件权限（chmod） |

### 2.6 常用场景

**场景1：上传Java应用包**

1. 在左侧本地目录找到打包好的 `.jar` 文件
2. 在右侧服务器目录切换到目标部署目录（如 `/opt/app`）
3. 拖拽文件到右侧，或选中后点击「上传」按钮
4. 等待传输完成

**场景2：下载日志文件**

1. 在右侧服务器目录找到日志文件（如 `/opt/logs/app.log`）
2. 在左侧本地目录选择保存位置
3. 拖拽文件到左侧，或选中后点击「下载」按钮
4. 等待传输完成

**场景3：批量传输**

1. 选中多个文件（按住Ctrl键多选，或按住Shift键连续选）
2. 拖拽或使用上传/下载按钮
3. 可以看到批量传输进度

### 2.7 XShell 与 XFTP 配合使用

在实际工作中，XShell和XFTP通常配合使用：

1. **XShell** 用于执行命令、查看日志、管理服务
2. **XFTP** 用于上传部署包、下载日志文件、修改配置文件

**典型工作流程：**

```
1. 使用XFTP上传应用包到服务器
   ↓
2. 使用XShell连接服务器，进入部署目录
   ↓
3. 使用XShell停止旧服务、备份旧版本
   ↓
4. 使用XShell启动新服务
   ↓
5. 使用XShell查看运行日志（tail -f）
   ↓
6. 如需下载日志分析，使用XFTP下载
```

---

## 三、常用命令

### 3.1 目录结构

Linux只有一个根目录 `/`，采用层级式的目录结构。

**重要目录说明：**

| 目录 | 说明 |
|------|------|
| `/bin -> /usr/bin` | 系统的可执行文件，可以在任何目录下执行 |
| `/usr/local/bin` | 用户自己的可执行文件，可以在任何目录下执行 |
| `/etc` | 存放配置文件，配置环境变量(`/etc/profile`) |
| `/home` | 每一个用户的根目录，用来保存用户私人的数据，默认目录名和用户名相同 |
| `/opt` | 存放额外安装的软件，相当于Windows系统的`Program Files`目录 |
| `/var` | 存放经常变化的文件，如日志文件(`/var/log`) |
| `/tmp` | 存放临时文件 |
| `/root` | 系统管理员（root用户）的根目录 |

**目录结构图：**
```
/
├── bin
├── etc
├── home
│   ├── user1
│   └── user2
├── opt
├── root
├── tmp
└── var
```

---

### 3.2 基本指令

#### 3.2.1 Linux服务器信息

| 操作 | 命令 | 说明 |
|------|------|------|
| 查看IP地址 | `ifconfig` 或 `ip addr` | 查看服务器IP地址 |
| 查看系统性能 | `top` | 运行的进程和系统性能信息（CPU、内存等） |
| 查看内存使用 | `free -h` | 以人类可读的方式显示内存使用情况 |
| 查看磁盘使用 | `df -h` | 查看各个分区的磁盘使用情况 |
| 查看系统版本 | `cat /etc/redhat-release` | 查看CentOS版本 |
| 查看内核版本 | `uname -r` | 查看Linux内核版本 |

**防火墙相关操作：**

```bash
# 查看防火墙状态
systemctl status firewalld

# 启动防火墙
systemctl start firewalld

# 停止防火墙
systemctl stop firewalld

# 开机自启动
systemctl enable firewalld

# 禁用开机自启动
systemctl disable firewalld
```

> **注意**：所有的系统服务都可以使用 `systemctl` 进行管理，命令格式为：`systemctl start|stop|status|restart [服务名]`
>
> 有些版本的服务器可能使用 `iptables` 而不是 `firewalld`，两者都是设置和管理网络防火墙规则的工具。

**开放端口操作（了解）：**

```bash
# 开放3306端口（MySQL常用端口）
firewall-cmd --permanent --zone=public --add-port=3306/tcp

# 重新加载防火墙配置（必须执行，否则规则不生效）
firewall-cmd --reload

# 查看已开放的端口
firewall-cmd --zone=public --list-ports

# 查看防火墙所有规则
firewall-cmd --zone=public --list-all

# 移除已开放的端口
firewall-cmd --permanent --zone=public --remove-port=3306/tcp
firewall-cmd --reload
```

---

#### 3.2.2 文本编辑：vi/vim

vi和vim是Linux中的文本编辑器，用来在Linux中创建、查看或者编辑文本文件，相当于Windows中的记事本。

**三种模式：**

```
一般模式（默认模式）
    ↓ 按 i 或 a
编辑模式
    ↓ 按 Esc
命令行模式（按 shift+: 进入）
```

| 模式 | 说明 | 常用操作 |
|------|------|----------|
| **一般模式** | 打开文件的默认模式 | `gg`：跳到文件首行<br>`G`：跳到文件末行<br>`yy`：复制当前行<br>`p`：粘贴<br>`dd`：删除当前行<br>`u`：撤销 |
| **编辑模式** | 编辑文件内容 | 按 `i` 或 `a` 进入，可编辑文件内容 |
| **命令行模式** | 保存、退出、搜索等 | 按 `:` 进入，输入命令 |

**常用命令：**

| 命令 | 说明 |
|------|------|
| `:q` | 退出编辑器（未修改时） |
| `:q!` | 不保存强制退出编辑器 |
| `:wq` | 保存并且退出编辑器 |
| `:w` | 保存但不退出 |
| `:set nu` | 显示行号 |
| `:set nonu` | 取消行号 |
| `/搜索内容` | 搜索内容，小写 `n` 向下查找，大写 `N` 向上查找 |
| `?搜索内容` | 向上搜索内容 |

---

#### 3.2.3 文件和目录操作

**1. 查看和切换目录**

| 命令 | 说明 |
|------|------|
| `ll` 或 `ls -l` | 查看当前目录下所有目录和文件（详细信息） |
| `ls` | 查看当前目录下所有目录和文件（简单列表） |
| `ls -a` | 查看所有文件（包括隐藏文件） |
| `pwd` | 显示当前所在目录的完整路径 |
| `cd /opt` | 切换到opt目录下（绝对路径） |
| `cd ..` | 切换到上级目录 |
| `cd bin` | 切换到当前目录的bin目录下（相对路径） |
| `cd ~` | 切换到当前用户的根目录 |
| `cd -` | 切换到上一次所在的目录 |

**2. 创建和复制**

| 命令 | 说明 |
|------|------|
| `mkdir data` | 在当前目录下创建目录data |
| `mkdir -p data/mysql` | 递归创建目录（一次创建多级目录） |
| `mkdir /opt/data` | 在opt目录下创建目录data |
| `cp gateway.jar gateway-bak.jar` | 复制文件并重命名（备份常用） |
| `cp -r dir1 dir2` | 递归复制目录 |
| `cp app.jar /opt/` | 复制文件到指定目录 |

**3. 删除操作（⚠️ 谨慎使用）**

| 命令 | 说明 |
|------|------|
| `rm file.txt` | 提示后删除文件 |
| `rm -f file.txt` | 强制删除文件（不提示） |
| `rm -r data` | 提示后递归删除目录 |
| `rm -rf data` | 强制递归删除目录（不提示） |

> ⚠️ **危险命令警告**：`rm -rf /` 会删除整个系统的所有文件，**千万不要执行**！

**4. 查看文件内容（Java开发常用）**

| 命令 | 说明 |
|------|------|
| `cat file.txt` | 查看文件全部内容，一次性显示 |
| `more file.txt` | 分页查看文件内容，空格翻页，q退出 |
| `less file.txt` | 分页查看文件内容，支持上下翻页，q退出 |
| `head -n 50 file.log` | 查看文件前50行 |
| `tail -n 50 file.log` | 查看文件后50行 |
| `tail -f file.log` | **实时监控**文件末尾内容（查看日志常用） |
| `tail -f file.log ｜ grep error` | 实时监控并过滤包含error的行 |
| `grep "mysql" file.log` | 查看文件中包含"mysql"的内容 |
| `grep -n "error" file.log` | 查看文件中包含"error"的内容，并显示行号 |
| `grep -i "error" file.log` | 忽略大小写搜索 |
| `grep -C 5 "error" file.log` | 显示匹配行及其前后5行 |

**5. 查找文件**

| 命令 | 说明 |
|------|------|
| `find / -name file.txt` | 从根目录查找名为file.txt的文件 |
| `find /opt -name "*.java"` | 查找opt目录下所有.java文件 |
| `find /opt -name "*.java" ｜ grep user` | 查找opt目录下名称包含user的.java文件 |
| `find /opt -type d -name "logs"` | 查找名为logs的目录 |

---

#### 3.2.4 用户相关操作

> **说明**：在公司中，用户创建一般由运维人员负责，开发人员主要使用 `su` 切换用户命令。

| 命令 | 说明 |
|------|------|
| `useradd zhuoye` | 添加用户zhuoye（在/home目录下创建用户根目录） |
| `useradd -d /home/zhuoyun zhuoye` | 创建用户并指定根目录 |
| `passwd zhuoye` | 给用户zhuoye设置密码 |
| `userdel zhuoye` | 删除用户zhuoye |
| `id zhuoye` | 查看用户zhuoye的信息 |
| `su zhuoye` | 切换到用户zhuoye |
| `su -` | 切换到root用户 |

**用户切换说明：**

- 从权限高的用户切换到权限低的用户：**不需要**密码验证
- 从权限低的用户切换到权限高的用户：**必须**密码验证

---

#### 3.2.5 压缩和解压操作

**1. gzip/gunzip（单个文件）**

| 命令 | 说明 |
|------|------|
| `gzip file.txt` | 压缩单个文件，生成`.gz`压缩包，并删除原文件 |
| `gunzip file.txt.gz` | 解压`.gz`压缩包，并删除原压缩包 |

**2. zip/unzip（多个文件和目录）**

| 命令 | 说明 |
|------|------|
| `zip archive.zip file1.txt file2.txt` | 把多个文件压缩为zip文件 |
| `zip -r archive.zip dir/` | 递归压缩目录 |
| `unzip archive.zip` | 解压zip文件到当前目录 |
| `unzip archive.zip -d /opt/data` | 解压zip文件到指定目录 |

**3. tar（Java开发最常用）**

| 命令 | 说明 |
|------|------|
| `tar -zcvf archive.tar.gz file1 file2 dir/` | 打包并压缩 |
| `tar -zxvf archive.tar.gz` | 解压到当前目录 |
| `tar -zxvf archive.tar.gz -C /opt/data` | 解压到指定目录 |

> **参数说明**：
> - `-z`：使用gzip压缩/解压
> - `-c`：创建压缩包
> - `-x`：解压
> - `-v`：显示详细过程
> - `-f`：指定文件名（必须放在最后）
> - `-C`：指定解压目录

---

#### 3.2.6 权限相关操作

**1. 修改文件所有者**

| 命令 | 说明 |
|------|------|
| `chown zhuoye file.txt` | 修改文件的所有者为zhuoye用户 |
| `chown -R zhuoye data/` | 递归修改目录及其内部文件的所有者 |
| `chown zhuoye:zhuoye file.txt` | 同时修改所有者和所属组 |

**2. 文件权限控制**

| 命令 | 说明 |
|------|------|
| `chmod 777 file.txt` | 将文件权限设置为777（所有用户可读写执行） |
| `chmod 755 file.txt` | 所有者可读写执行，其他用户可读执行 |
| `chmod 644 file.txt` | 所有者可读写，其他用户只读 |

**权限说明：**

Linux中每个文件或目录都有三部分权限：所有者权限、同组用户权限、其他组用户权限。

| 权限 | r（读） | w（写） | x（执行） | 数字表示 |
|------|---------|---------|-----------|----------|
| 说明 | 可查看内容 | 可修改内容 | 可执行/进入目录 | 4 / 2 / 1 |

| 权限组合 | 说明 | 数字 |
|----------|------|------|
| `rwx` | 读写执行 | 7 (4+2+1) |
| `r-x` | 读和执行 | 5 (4+1) |
| `r--` | 只读 | 4 |
| `---` | 无权限 | 0 |

**权限表示示例：**

```
-rwxr-xr--  file.txt
 ││││││││││
 │││││││││└─ 其他用户：只读(4)
 │││││││└──── 同组用户：读执行(5)
 │││││└─────── 所有者：读写执行(7)
```

---

#### 3.2.7 进程管理（Java开发必备）

| 命令 | 说明 |
|------|------|
| `ps -ef ｜ grep mysql` | 查找mysql服务相关的进程 |
| `ps -ef ｜ grep java` | 查找Java进程 |
| `jps` | **查看当前运行的Java进程**（JDK自带，最常用） |
| `lsof -i :3306` | 查看占用3306端口的进程 |
| `netstat -tunlp ｜ grep 8080` | 查看占用8080端口的进程 |
| `kill -9 PID` | 强制关闭指定PID的进程 |
| `kill -15 PID` | 正常关闭指定PID的进程 |

**Java应用部署常用操作：**

```bash
# 1. 查看Java进程
jps
# 或
ps -ef | grep java

# 2. 查看应用占用的端口
lsof -i :8080

# 3. 停止应用
kill -15 <PID>

# 4. 后台启动Java应用（常用）
nohup java -jar app.jar > app.log 2>&1 &

# 5. 查看应用日志
tail -f app.log
```

---

#### 3.2.8 软件包安装

**1. RPM包安装**

| 命令 | 说明 |
|------|------|
| `rpm -ivh package.rpm` | 安装rpm包（i-安装，v-显示详情，h-进度条） |
| `rpm -ivh --force package.rpm` | 强制安装 |
| `rpm -e package.rpm` | 卸载rpm软件包 |
| `rpm -qa ｜ grep java` | 查看已安装的软件 |

**2. YUM安装（推荐）**

| 命令 | 说明 |
|------|------|
| `yum install firefox` | 安装软件 |
| `yum list installed ｜ grep firefox` | 查看已安装的软件 |
| `yum remove firefox.x86_64` | 卸载软件 |
| `yum update` | 更新所有软件包 |
| `yum search keyword` | 搜索软件包 |

---

### 3.3 拓展指令

#### 3.3.1 文件上传下载

| 命令 | 说明 |
|------|------|
| `rz -y` | 上传本地文件到Linux服务器（-y表示覆盖同名文件） |
| `sz filename` | 下载服务器文件到本地电脑 |

> **说明**：如果提示命令不存在，需要先安装：`yum install lrzsz`

#### 3.3.2 执行可执行文件

```bash
# 方式1：使用相对路径或绝对路径
./script.sh

# 方式2：使用sh命令
sh script.sh

# 方式3：使用bash命令
bash script.sh
```

#### 3.3.3 网络相关（Java开发调试必备）

| 命令 | 说明 |
|------|------|
| `ping www.baidu.com` | 测试网络连通性 |
| `telnet ip port` | 测试端口是否连通（如：`telnet 192.168.1.100 3306`） |
| `curl http://api.example.com` | 测试HTTP接口 |
| `wget http://example.com/file.zip` | 下载文件 |

#### 3.3.4 环境变量

| 命令 | 说明 |
|------|------|
| `echo $JAVA_HOME` | 查看JAVA_HOME环境变量 |
| `echo $PATH` | 查看PATH环境变量 |
| `export JAVA_HOME=/opt/jdk11` | 临时设置环境变量 |
| `source /etc/profile` | 使配置文件生效 |

**永久配置环境变量：**

```bash
# 1. 编辑配置文件
vim /etc/profile

# 2. 在文件末尾添加
export JAVA_HOME=/opt/jdk11
export PATH=$JAVA_HOME/bin:$PATH

# 3. 使配置生效
source /etc/profile
```

---

## 四、实战练习

### 4.1 日常操作流程练习

**任务：部署一个Java应用**

```bash
# 1. 连接服务器（使用XShell）

# 2. 进入应用部署目录
cd /opt/app

# 3. 查看当前目录内容
ll

# 4. 查看是否有Java进程在运行
jps

# 5. 如果有旧进程，先停止（假设PID是12345）
kill -15 12345

# 6. 备份旧版本
cp app.jar app-bak-$(date +%Y%m%d).jar

# 7. 使用XFTP上传新版本app.jar到当前目录

# 8. 后台启动应用
nohup java -jar app.jar > app.log 2>&1 &

# 9. 查看启动日志
tail -f app.log

# 10. 确认启动成功后，按Ctrl+C退出日志查看（应用继续运行）
```

### 4.2 问题排查练习

**问题1：应用无法启动**

```bash
# 检查Java环境
java -version

# 检查端口是否被占用
lsof -i :8080

# 查看错误日志
tail -100 app.log | grep ERROR

# 检查磁盘空间
df -h
```

**问题2：无法访问应用**

```bash
# 检查应用是否运行
jps

# 检查端口监听
netstat -tunlp | grep 8080

# 检查防火墙
firewall-cmd --zone=public --list-ports

# 如果没有开放端口，添加端口
firewall-cmd --permanent --zone=public --add-port=8080/tcp
firewall-cmd --reload
```



