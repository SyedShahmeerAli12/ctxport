'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Detects project name and tech stack from package.json, requirements.txt,
 * Gemfile, go.mod, etc. in the given directory.
 * Returns { name, stack } — both strings.
 */
function detectStack(cwd) {
  const results = [];
  let name = path.basename(cwd);

  // Node.js / package.json
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.name) name = pkg.name;
      const deps = Object.keys({
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {})
      });

      const knownFrameworks = [
        ['next', 'Next.js'],
        ['react', 'React'],
        ['vue', 'Vue'],
        ['svelte', 'Svelte'],
        ['angular', 'Angular'],
        ['express', 'Express'],
        ['fastify', 'Fastify'],
        ['koa', 'Koa'],
        ['nestjs', 'NestJS'],
        ['remix', 'Remix'],
        ['gatsby', 'Gatsby'],
        ['astro', 'Astro'],
        ['electron', 'Electron'],
        ['prisma', 'Prisma'],
        ['mongoose', 'MongoDB'],
        ['pg', 'PostgreSQL'],
        ['mysql2', 'MySQL'],
        ['redis', 'Redis'],
        ['graphql', 'GraphQL'],
        ['stripe', 'Stripe'],
        ['tailwindcss', 'Tailwind CSS'],
        ['typescript', 'TypeScript'],
        ['jest', 'Jest'],
        ['vitest', 'Vitest']
      ];

      for (const [pkg, label] of knownFrameworks) {
        if (deps.some(d => d === pkg || d.startsWith(`@${pkg}/`) || d.startsWith(`${pkg}-`))) {
          results.push(label);
        }
      }

      if (results.length === 0) results.push('Node.js');
    } catch {
      results.push('Node.js');
    }
  }

  // Python
  if (fs.existsSync(path.join(cwd, 'requirements.txt')) || fs.existsSync(path.join(cwd, 'pyproject.toml'))) {
    const frameworks = [];
    try {
      const reqs = fs.readFileSync(path.join(cwd, 'requirements.txt'), 'utf8');
      if (/django/i.test(reqs)) frameworks.push('Django');
      else if (/flask/i.test(reqs)) frameworks.push('Flask');
      else if (/fastapi/i.test(reqs)) frameworks.push('FastAPI');
    } catch { /* skip */ }
    results.push('Python', ...frameworks);
  }

  // Ruby
  if (fs.existsSync(path.join(cwd, 'Gemfile'))) {
    results.push('Ruby');
    try {
      const gemfile = fs.readFileSync(path.join(cwd, 'Gemfile'), 'utf8');
      if (/rails/i.test(gemfile)) results.push('Rails');
    } catch { /* skip */ }
  }

  // Go
  if (fs.existsSync(path.join(cwd, 'go.mod'))) {
    results.push('Go');
  }

  // Rust
  if (fs.existsSync(path.join(cwd, 'Cargo.toml'))) {
    results.push('Rust');
  }

  // Java / Kotlin
  if (fs.existsSync(path.join(cwd, 'pom.xml'))) results.push('Java', 'Maven');
  if (fs.existsSync(path.join(cwd, 'build.gradle')) || fs.existsSync(path.join(cwd, 'build.gradle.kts'))) {
    results.push('Gradle');
  }

  // Docker
  if (fs.existsSync(path.join(cwd, 'Dockerfile'))) results.push('Docker');

  const unique = [...new Set(results)];
  return {
    name,
    stack: unique.length > 0 ? unique.join(', ') : 'Unknown'
  };
}

module.exports = { detectStack };
