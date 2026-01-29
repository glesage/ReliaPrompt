# AGENTS instructions for Relia Prompt

Always read package.json
It includes commands that can be run for tests, dev, build, lint and others
Always use `bun` to run commands or install dependencies.

## Code conventions

- KISS: Keep It Simple Stupid. Complexity is the enemy of maintainability.
- Use explicit variable names (even if lengthy).
- Use prettifer to auto-format code.
- Avoid typecasting unless absolutely impossible to avoid.

## Development

Run `rm -rf dist` before building big changes or before testing and committing the final changes.
Run `bun run build`, `bun run lint` and `bun run test` anytime you make major changes and fix issues that arise.

## Creating PRs

Always test the feature with browser or playwright and post screenshots of the results in the PR description.
