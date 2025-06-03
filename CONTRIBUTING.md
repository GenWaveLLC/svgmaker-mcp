# Contributing to @genwave/svgmaker-mcp

Thank you for your interest in contributing to the SVGMaker MCP Server! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please help us keep this project open and inclusive. By participating, you agree to:
- Be respectful and considerate in your communication
- Accept constructive criticism gracefully
- Focus on what's best for the community

## How to Contribute

1. Fork the repository
2. Create a new branch for your changes
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes
4. Write clear commit messages
   ```bash
   git commit -m "feat: add new feature" # for features
   git commit -m "fix: resolve issue" # for fixes
   git commit -m "docs: update documentation" # for documentation
   ```
5. Push to your fork
6. Create a Pull Request

## Pull Request Process

1. Update documentation if you're changing functionality
2. Add tests for new features
3. Ensure all tests pass
4. Link any relevant issues
5. Get at least one code review

## Development Setup

1. Clone your fork:
   ```bash
   git clone https://github.com/your-username/svgmaker-mcp.git
   cd svgmaker-mcp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create your `.env` file:
   ```bash
   cp .env.example .env
   ```

4. Run in development mode:
   ```bash
   npm run dev
   ```

## Reporting Issues

When reporting issues, please include:
- A clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node.js version, etc.)

## Questions?

If you have questions or need help, please:
1. Check existing issues and documentation
2. Open a new issue if needed

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
