# Codex Pet Desktop

<p align="center">
  <img src="assets/branding/cloud-terminal-pet-source.png" width="160" alt="Codex Pet Desktop 云朵猫终端图标">
</p>

<p align="center">
  一个默认保护隐私、随本地 Codex 活动变化的非商业 Windows 桌面宠物。
</p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="https://github.com/zxy19960316/codex-pet-desktop/releases/latest">下载最新版</a> ·
  <a href="CHANGELOG.md">更新记录</a> ·
  <a href="CONTRIBUTING.md">参与贡献</a>
</p>

Codex Pet Desktop 是一个独立开发、源码公开的 Electron 桌面伴侣。它会在本机跟随近期
Codex 会话，根据任务状态切换动画，并显示会话状态、额度和 Token 用量；不会把会话内容
上传到云端。

> **非商业许可：**从 v1.1.0 起，源码和安装包内原创素材采用
> [PolyForm Noncommercial License 1.0.0](LICENSE)。大家可以在许可证允许的个人、学习、
> 研究、教育、公益和其他非商业场景中使用、研究、修改和分享，但不得用于商业目的。
> 由于限制商业使用，严格来说本项目属于“源码可用（source-available）”，并非 OSI 认可的
> 开源软件。已经发布的 v1.0.0 继续遵循其发布时附带的 MIT 许可，既有授权不会被撤销。

## 主要功能

- 支持 `idle`、`thinking`、`typing`、`working`、`approval`、`waiting_input`、
  `success`、`error`、`quota_low`、`quota_empty`、`offline` 和 `sleep` 共 12 种宠物状态。
- 左键点击宠物可查看当前会话速览；右键点击宠物可打开中文会话 Hub，查看近期会话状态、
  项目标识、已用时间、今日活跃时长、额度和 Token。
- 紧凑的游戏风格状态栏会跟随宠物移动，显示当前模型、思考强度、`5H`/`WEEKLY` 额度和
  当前轮 Token / 模型上下文窗口。
- Windows 像素级窗口形状：宠物周围的透明区域不会遮挡鼠标点击。
- 支持 50–200% 缩放、Ctrl+滚轮调整、多显示器、置顶、鼠标穿透和跨屏实际大小补偿。
- 正式托盘应用、原创云朵猫终端图标、中文设置中心、可选的 Windows 登录时启动。
- 支持本地 PNG/WebP 宠物包导入、校验、预览、切换、状态回退和原子复制。
- 可选的 Codex 生命周期 Hook 与 App Server 连接；不会绕过 Codex 自身的信任确认。

## Windows 下载与安装

要求：Windows 10/11 x64，电脑上已安装可在本机使用的 Codex。

1. 打开 [GitHub 最新 Release](https://github.com/zxy19960316/codex-pet-desktop/releases/latest)。
2. 下载 `codex-pet-desktop-1.1.0-setup-x64.exe` 和同名 `.sha256` 文件。
3. 可在 PowerShell 中核对 SHA-256：

   ```powershell
   Get-FileHash .\codex-pet-desktop-1.1.0-setup-x64.exe -Algorithm SHA256
   Get-Content .\codex-pet-desktop-1.1.0-setup-x64.exe.sha256
   ```

   两处哈希值应完全一致。

4. 运行安装包，从开始菜单或桌面快捷方式启动 **Codex Pet Desktop**。

v1.1.0 安装包暂未进行代码签名，因此 Microsoft Defender SmartScreen 可能提示“无法识别的
应用”。请先确认下载来源并核对哈希值，再决定是否运行。卸载程序默认保留设置和已导入的
本地宠物包。

## 使用方法

1. 启动后，宠物和紧凑状态栏会出现在屏幕右下方附近。
2. 左键点击宠物，打开或收起“当前会话速览”。
3. 右键点击宠物，打开详细“会话 Hub”；其中最多显示 6 个近期会话，并提供“打开设置中心”。
4. 右键点击系统托盘图标，可打开应用菜单、设置中心、Codex 连接操作和退出命令。
5. 在“通用设置”中调整大小、置顶、跨屏缩放、鼠标穿透和登录时启动。
6. 在“Codex 连接”中保留“自动启动 App Server”，可自动读取本地额度并启用受支持的控制；
   关闭后仍可只使用本地生命周期状态。
7. 如果 Hook 尚未安装，从托盘菜单选择 **Connect Codex activity**；随后在 Codex 中打开
   `/hooks`，检查命令并主动选择信任。
8. 打开或切换 Codex 任务。应用会在本机读取今天或昨天的近期会话文件，并更新模型、思考
   强度、Token、额度、会话状态和宠物动画。

如果当前账号没有 `5H` 或 `WEEKLY` 限制，对应条目不会凭空显示。关闭启动应用时使用的
终端不会退出已安装程序；如需彻底关闭，请从托盘菜单选择 **Quit**。

## 宠物素材与打包边界

公开安装包只包含原创程序化像素宠物 **Pixel Sprout** 和仓库内原创品牌素材，不包含本机的
Pokémon、Codex PokéPets 或其他第三方角色素材。

导入自己有权使用的本地素材：

1. 创建包含 `manifest.json`、PNG/WebP 预览图和 PNG/WebP 精灵图的文件夹。
2. 至少提供 `idle` 动画；可补齐全部 12 种状态以获得完整效果。
3. 打开 **设置中心 → 宠物管理 → 导入宠物包**，选择该文件夹。
4. 检查导入结果并设为当前宠物。文件只会复制到应用的本机用户数据目录，不会进入 Git
   仓库或公开安装包。

完整目录结构、清单示例、尺寸限制、状态映射和本地制作流程见
[宠物素材制作与接入指南](docs/guides/PET_ASSET_AUTHORING.md)；底层格式见
[Pet Package System](docs/guides/PET_PACKAGE_SYSTEM.md)。已经合法保存在本机的兼容 Codex
PokéPets 可按[本地导入指南](docs/guides/CODEX_POKEPETS_IMPORT.md)逐个转换。

请勿向 Git、Issue、PR 或 Release 上传 Pokémon 原画、游戏提取资源或没有再分发许可的第三方
素材。本机修改、二次创作或附加“不得商用”声明，不会自动取得原角色美术的再分发权。分享
任何宠物包前请阅读 [ASSET_POLICY.md](ASSET_POLICY.md)。

## 隐私与安全

- 没有云端账号、遥测上传、浏览器 Cookie 读取、云设置同步或登录模拟。
- 会话监视器只读取有限数量的近期本地 Codex JSONL 文件，并提取界面需要的时间戳、安全的
  会话/轮次标识、生命周期事件类型、模型名、思考强度、Token、上下文窗口和额度元数据。
- 生命周期 Hook 只保留会话 ID、轮次 ID、事件名和时间；应用不会保存提示词、对话、工具输入
  或工具输出。
- 设置、Hook 事件和导入宠物都留在 Electron 的本机用户数据目录。
- 渲染进程保持沙箱隔离，只通过经过校验的类型化 IPC 接收数据。

不要在 Issue 中上传会话文件、本地日志、设置目录、凭据或专有素材。安全问题请按
[SECURITY.md](SECURITY.md) 说明处理。

## 从源码运行与构建

要求：Windows 10/11、Node.js 24 LTS、npm 11、Python 3.13 和 Git。

```powershell
git clone https://github.com/zxy19960316/codex-pet-desktop.git
cd codex-pet-desktop
npm ci
python -m pip install --requirement requirements-image-tools.txt
npm run dev
```

质量检查与打包：

```powershell
npm run format:check
npm run lint
npm test
npm run build
npm run package:dir
npm run package:installer
```

`package:dir` 会在被 Git 忽略的 `release/` 下生成解包应用；`package:installer` 会在
`release/m3-3/` 生成未签名的 Windows x64 NSIS 安装包和 SHA-256 文件。

## 许可证与非商业使用

v1.1.0 的源码与安装包内原创素材采用 `PolyForm-Noncommercial-1.0.0`：

- 可以在许可证允许的个人学习、研究实验、教育、公益、公共研究、兴趣项目等非商业目的下
  使用、修改和分享。
- 不授予销售本软件、用于商业产品或付费服务、用于预期商业应用，或其他商业目的的许可。
- 商业使用必须另行取得版权所有人的书面许可；本仓库本身不提供该授权。
- 依赖项和用户导入的第三方素材继续遵循它们各自的许可证与权利声明。
- v1.0.0 已经授予的 MIT 权利继续有效；新的限制只适用于附带本许可证的版本。

完整、具有约束力的条款以 [LICENSE](LICENSE) 为准。版本和发布规则见
[VERSIONING.md](VERSIONING.md)，贡献流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。

本项目与 OpenAI、Nintendo、Game Freak、Creatures Inc.、The Pokémon Company、Clawd on
Desk、AgentPet 或 Codex PokéPets 均无隶属或背书关系；公开仓库和安装包不包含这些项目的
源代码或角色素材。
