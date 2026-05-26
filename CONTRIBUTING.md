# Contributing to obsidian-po-editor

Thank you for your interest in contributing! This guide will help you get started.

## 🎯 Quick Start

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `bun run test`
5. Run lints: `bun run check:fix`
6. Commit with [conventional commits](https://www.conventionalcommits.org/): `git commit -m "feat: add new effect"`
7. Push and submit a Pull Request

## 📋 Pull Request Guidelines

### Before Submitting

- [ ] Tests pass: `bun run test`
- [ ] No lint warnings: `bun run check`
- [ ] Code is formatted: `bun run check:fix`
- [ ] Documentation is updated (if applicable)
- [ ] Examples still compile and run

### PR Description

- Clearly describe what changed and why
- Reference related issues with `Fixes #123`
- Include screenshots/GIFs for visual changes
- List any breaking changes

## 🐛 Reporting Bugs

Use the [bug report template](https://github.com/kodaskills/obsidian-po-editor/issues/new?template=bug_report.md) and include:

- **zellig version**: Which version are you using?
- **OS**: Windows, macOS, Linux?
- **Minimal reproduction**: Code snippet or example
- **Expected vs actual behavior**

## 💡 Feature Requests

Use the [feature request template](https://github.com/kodaskills/obsidian-po-editor/issues/new?template=feature_request.md) to suggest improvements.

## 🎨 Code Style

- Follow [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/)
- Use `bun run check:fix` for formatting
- Write doc comments for public APIs
- Keep functions focused and small

## 📝 Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new chromatic aberration mode
fix: correct barrel distortion calculation
docs: update README with 3D camera example
test: add integration tests for CRT settings
chore: update dependencies
```

## 🧪 Testing

```bash
bun run test
```

## 🤝 Community

- Be respectful and inclusive
- Help others when you can
- Ask questions if unsure

## ❓ Questions?

Open an issue with the "question" label or reach out via discussions.

---

Thank you for contributing! 🎉
