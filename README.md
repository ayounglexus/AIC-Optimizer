# Endfield Tools - Production Calculator

This is a production calculator tool designed for players of "Arknights: Endfield". It aims to help players plan and optimize in-game resource production, including facility construction, item crafting, and recipe management.

## Features

*   **Facility Management**: View and manage various production facilities in the game.
*   **Items and Recipes**: Browse all craftable items and their corresponding recipes.
*   **Production Planning**: Automatically calculate required raw materials and production steps based on target items.
*   **Visual Interface**: An intuitive user interface for simulating and adjusting production chains.

## Tech Stack

*   **Frontend**: React, TypeScript, Vite
*   **UI Components**: Shadcn/ui (inferred from `components.json` and `src/components/ui`)
*   **Styling**: CSS (inferred from `index.css`)

## Installation and Running

### Prerequisites

*   Node.js (LTS version recommended)
*   pnpm (or npm/yarn)

### Steps

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/your-username/endfield-tools.git
    cd endfield-tools
    ```
    (Note: Assuming a GitHub repo, replace `your-username` with actual if known, or remove if not applicable)

2.  **Install dependencies**:
    ```bash
    pnpm install
    ```

3.  **Run the development server**:
    ```bash
    pnpm dev
    ```
    The project will run on a local development server, usually `http://localhost:5173`.

4.  **Build for production**:
    ```bash
    pnpm build
    ```
    This will generate production-ready static files in the `dist/` directory.

## Usage

After starting the application, you can use the intuitive interface to:

1.  Select the target items you wish to produce.
2.  View the facilities, raw materials, and production time required for those items.
3.  Adjust production quantities, and the tool will automatically update resource requirements.

## Contributing

Community contributions are welcome! If you have any suggestions for improvement or find bugs, please feel free to submit an Issue or Pull Request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
