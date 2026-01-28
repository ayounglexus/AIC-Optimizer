# Endfield Calc — Production Chain Calculator for "Arknights: Endfield"

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> **Special Thanks**: This project is a fork of [JamboChen's Endfield Calc](https://github.com/JamboChen/endfield-calc). Huge thank you to JamboChen for creating this amazing tool and releasing it under the MIT license!

## Overview

**Endfield Calc** is a production chain calculator for **Arknights: Endfield** that helps players plan resource requirements, production ratios, and facility needs—including circular production loops.

## Key Features

### 🎯 Core Functionality
- **Multi-target planning** with automatic dependency resolution
- **Smart recipe selection** with circular dependency handling
- **Real-time calculation** of facility counts and power consumption
- **Manual raw material marking** for flexible supply chain control

### 📊 Dual View Modes

#### Table View
- Comprehensive production breakdown with all metrics
- **Interactive hover**: Highlight upstream dependencies on mouse hover

![Table View Interaction](./img/table-hover-demo.gif)

#### Dependency Tree View
Two visualization modes for different planning needs:

**Recipe View**: Aggregates facilities by recipe type, shows total requirements
- Best for overall recipe optimization and material flow overview

**Facility View**: Shows each individual facility as a separate node
- Best for detailed capacity planning and load balancing
- Displays capacity utilization and precise material allocation

![Tree Views](./img/tree-comparison.gif)

Both modes feature interactive flow diagrams, cycle visualization, and flow rate labels.

## Technology Stack

- **Framework**: React 18 + TypeScript + Vite
- **Visualization**: React Flow with Dagre layout
- **UI**: Radix UI + Tailwind CSS
- **i18n**: react-i18next

## Getting Started

### Local Development
```bash
git clone https://github.com/lightninglast/AIC-Arithmetic.git
cd AIC-Arithmetic
pnpm install
pnpm run dev
```

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE)

---

**Note**: Fan-made tool, not officially affiliated with Arknights: Endfield.
