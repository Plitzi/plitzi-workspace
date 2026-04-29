# Plitzi

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPLv3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0.en.html)
[![Build Status](https://img.shields.io/github/actions/workflow/status/plitzi/plitzi-workspace/ci.yml?branch=main)](https://github.com/plitzi/plitzi-workspace/actions)
[![Coverage Status](https://img.shields.io/coveralls/github/plitzi/plitzi-workspace/main.svg?style=flat)](https://coveralls.io/github/plitzi/plitzi-workspace?branch=main)
[![npm version](https://img.shields.io/npm/v/@plitzi/sdk.svg)](https://www.npmjs.com/package/@plitzi/sdk)
[![Community Chat](https://img.shields.io/badge/chat-on%20discord-7289da.svg)](https://discord.gg/plitzi)

---

## About Plitzi

Plitzi is an open-source **web application builder** designed to empower developers and communities to create, modify, and share modern web apps with ease. Built with extensibility and transparency in mind, Plitzi fosters collaboration and innovation under the [GNU Affero General Public License v3.0 (AGPL-3.0)](https://www.gnu.org/licenses/agpl-3.0.en.html).

---

## Features ![Features Badge](https://img.shields.io/badge/-Features-4caf50?style=flat-square&logo=awesome-lists&logoColor=white)

- 🔧 **Modular SDK & Builder:** Fully open and extensible toolkit to design and customize web apps.
- 🌐 **Cloud & Self-Hosting:** Deploy on official Plitzi cloud or your own infrastructure.
- 🤝 **Community-Driven:** Contributions and improvements are encouraged and welcomed.
- 📚 **Comprehensive Documentation:** Clear guides and examples to get started quickly.
- 🛠 **Developer Tools:** Built-in debugging and dev utilities for rapid iteration.

---

## Repository Structure

```
/
├─ apps/
│  ├─ sdk/              # Core SDK modules
│  ├─ builder/          # Web app builder UI and logic
│  ├─ server/           # SSR/RSC/MCP Server
├─ packages/
│  ├─ sdk-auth/         # Authentication SDK components
│  ├─ sdk-data-source/  # Data source integrations
│  ├─ sdk-dev-tools/    # Developer utilities
│  ├─ sdk-elements/     # UI elements and components
│  ├─ sdk-event-bridge/ # Event handling bridge
│  ├─ sdk-interactions/ # User interaction handlers
│  ├─ sdk-navigation/   # Navigation components
│  ├─ sdk-plugins/      # Plugin system
│  ├─ sdk-shared/       # Shared utilities and types
│  ├─ sdk-state/        # State management
│  ├─ sdk-style/        # Styling system
│  └─ sdk-variables/    # Variable management
├─ LICENSE              # AGPL-3.0 License
├─ README.md            # This file
```

---

## Getting Started

1. **Clone the repository**

```bash
git clone https://github.com/plitzi/plitzi-workspace.git
cd plitzi-workspace
```

2. **Install dependencies**

```bash
npm install
```

3. **Run the builder locally**

```bash
npm run dev
```

4. **Explore the SDK and contribute**

Check the `apps/sdk` and `apps/builder` folders for source code and examples.

---

## Quick Start Example ![Quick Start](https://img.shields.io/badge/-Quick%20Start-2196f3?style=flat-square&logo=thunder&logoColor=white) WIP

Here's a minimal example of using the Plitzi SDK in your project:

<!-- ```js
import { PlitziApp } from '@plitzi/sdk';

const app = new PlitziApp({
  target: document.getElementById('app'),
  config: {
    title: 'My First Plitzi App',
    // ...other config options
  }
});

app.start();
``` -->

For more details, see the [documentation](https://github.com/plitzi/plitzi-workspace/wiki) and the `apps/sdk` or `apps/builder` folder.

---

## Contribution Guidelines ![Contribute](https://img.shields.io/badge/-Contribute-fbc02d?style=flat-square&logo=github&logoColor=black)

We welcome contributions from everyone! To keep the project healthy and collaborative, please follow these guidelines:

- Read the [Code of Conduct](https://github.com/plitzi/plitzi-workspace/blob/main/CODE_OF_CONDUCT.md).
- Open issues for bugs, features, or questions before submitting PRs.
- Fork the repository and create feature branches.
- Write clear, descriptive commit messages.
- Include tests and documentation for new features or fixes.
- Submit pull requests against the `main` branch.
- All contributions are licensed under AGPL-3.0.

- **Security:** Please review our [Security Policy](https://github.com/plitzi/plitzi-workspace/security/policy) for reporting vulnerabilities.

---

## Community & Support ![Community](https://img.shields.io/badge/-Community%20%26%20Support-8e24aa?style=flat-square&logo=discord&logoColor=white)

Join our community to discuss ideas, get help, or contribute:

- **Discord:** [https://discord.gg/plitzi](https://discord.gg/plitzi)
- **GitHub Discussions:** [https://github.com/plitzi/plitzi-workspace/discussions](https://github.com/plitzi/plitzi-workspace/discussions)
- **Email:** crodriguez@plitzi.com

### Getting Help

- **Browse the [Wiki](https://github.com/plitzi/plitzi-workspace/wiki)** for guides and FAQs.
- **Open a [GitHub Issue](https://github.com/plitzi/plitzi-workspace/issues)** for bugs or feature requests.
- **Ask questions in [Discussions](https://github.com/plitzi/plitzi-workspace/discussions)** or on [Discord](https://discord.gg/plitzi).

---

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).

If you want to use Plitzi in a proprietary or closed-source environment, a commercial license is required.

Commercial licenses are designed for companies that want to:

- Keep their code private
- Build proprietary products
- Avoid AGPL obligations

If you want to use Plitzi in a proprietary or closed-source environment, you must obtain a commercial license.

See [COMMERCIAL_LICENSE.md](./COMMERCIAL_LICENSE.md) for details.

---

## Acknowledgments

Thanks to the open-source community and all contributors who help make Plitzi a collaborative and empowering platform.

---

_Build and grow your web apps with Plitzi — freedom to create, freedom to share._

---

## Contributors ![Contributors](https://img.shields.io/badge/-Contributors-00bcd4?style=flat-square&logo=github&logoColor=white)

We sincerely thank all the contributors who have helped make Plitzi better. Your efforts and dedication drive this project forward.

![GitHub contributors](https://contrib.rocks/image?repo=plitzi/plitzi-workspace)

---

## Roadmap ![Roadmap](https://img.shields.io/badge/-Roadmap-ff7043?style=flat-square&logo=roadmap&logoColor=white) WIP

- [ ] **v1.0 Release:** Stable Server, builder and SDK core
<!-- - [ ] **Plugin Marketplace:** Community-driven extensions
- [ ] **Cloud Deployment:** One-click deploy to Plitzi Cloud
- [ ] **Improved Documentation:** More guides and API docs
- [ ] **Mobile Support:** Responsive and PWA enhancements
- [ ] **Internationalization:** Multilanguage support
- [ ] **Accessibility Improvements**
- [ ] **Performance Optimizations** -->

See the [GitHub Projects](https://github.com/plitzi/plitzi-workspace/projects) for more details and ongoing issues.

### Self-Hosting Notice

Plitzi can be self-hosted using the open-source components provided in this repository.

However, some features (such as advanced data management, cloud services, and certain backend capabilities) require additional services that are not included in this repository.

The open-source version is fully functional for local development and customization, but production-grade deployments may require additional infrastructure.
