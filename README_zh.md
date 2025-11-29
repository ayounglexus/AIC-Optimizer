# Endfield Tools - 生产计算器

这是一个为《明日方舟：终末地》玩家设计的生产计算器工具。它旨在帮助玩家规划和优化游戏内的资源生产，包括设施建造、物品制作和配方管理。

## 功能特性

*   **设施管理**: 查看和管理游戏中的各种生产设施。
*   **物品与配方**: 浏览所有可生产的物品及其对应的制作配方。
*   **生产规划**: 根据目标物品，自动计算所需的原材料和生产步骤。
*   **可视化界面**: 直观的用户界面，方便玩家进行生产链的模拟和调整。

## 技术栈

*   **前端**: React, TypeScript, Vite
*   **UI 组件**: Shadcn/ui (根据 `components.json` 和 `src/components/ui` 推断)
*   **样式**: CSS (通过 `index.css` 推断)

## 安装与运行

### 前提条件

*   Node.js (推荐 LTS 版本)
*   pnpm (或 npm/yarn)

### 步骤

1.  **克隆仓库**:
    ```bash
    git clone https://github.com/your-username/endfield-tools.git
    cd endfield-tools
    ```
    (Note: Assuming a GitHub repo, replace `your-username` with actual if known, or remove if not applicable)

2.  **安装依赖**:
    ```bash
    pnpm install
    ```

3.  **运行开发服务器**:
    ```bash
    pnpm dev
    ```
    项目将在本地开发服务器上运行，通常是 `http://localhost:5173`。

4.  **构建生产版本**:
    ```bash
    pnpm build
    ```
    这将在 `dist/` 目录下生成生产就绪的静态文件。

## 使用方法

启动应用后，您可以通过直观的界面来：

1.  选择您想要生产的目标物品。
2.  查看生产该物品所需的设施、原材料和生产时间。
3.  调整生产数量，工具将自动更新资源需求。

## 贡献

欢迎社区贡献！如果您有任何改进建议或发现 Bug，请随时提交 Issue 或 Pull Request。

## 许可证

本项目采用 MIT 许可证。详情请参阅 [LICENSE](LICENSE) 文件。
