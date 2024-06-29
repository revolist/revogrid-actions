import { execa } from 'execa';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { packageDirs } from './package-dirs.mjs';

// Define __dirname and __filename for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read version from root package.json
const rootPackageJsonPath = path.resolve(__dirname, '../package.json');
const rootPackageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf-8'));
const newVersion = rootPackageJson.version;

if (!newVersion) {
  console.error(chalk.red('Error: Please provide a version using --version'));
  process.exit(1);
}

async function updateVersionInPackage(packageDir) {
  const fullPath = path.resolve(__dirname, '..', packageDir, 'release.mjs');
  try {
    await execa('node', [fullPath, '--version', newVersion], {
      stdio: 'inherit',
    });
    console.log(chalk.green(`Successfully updated version in ${packageDir}`));
  } catch (error) {
    console.error(chalk.red(`Failed to update version in ${packageDir}`));
    console.error(error);
  }
}

async function commitAndPushChanges(packageDir, newVersion) {
  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    console.error(chalk.red('GitHub token is not set'));
    process.exit(1);
  }

  try {
    // Configure Git to use the GitHub token
    await execa('git', ['config', 'user.name', 'github-actions[bot]'], { cwd: packageDir });
    await execa('git', ['config', 'user.email', 'github-actions[bot]@users.noreply.github.com'], { cwd: packageDir });

    // Get the remote URL of the submodule
    const { stdout: remoteUrl } = await execa('git', ['config', '--get', 'remote.origin.url'], { cwd: packageDir });

    // Set the remote URL to use the GitHub token for authentication
    const authenticatedUrl = remoteUrl.replace('https://', `https://x-access-token:${githubToken}@`);
    await execa('git', ['remote', 'set-url', 'origin', authenticatedUrl], { cwd: packageDir });

    // Add changes
    await execa('git', ['add', '.'], { cwd: packageDir, stdio: 'inherit' });

    // Commit changes
    await execa('git', ['commit', '-m', `chore(release): update versions to ${newVersion}`], { cwd: packageDir, stdio: 'inherit' });

    // Push changes
    await execa('git', ['push', 'origin', 'HEAD'], { cwd: packageDir, stdio: 'inherit' });

    console.log(chalk.green(`Successfully committed and pushed version updates for ${packageDir} to GitHub`));
  } catch (error) {
    console.error(chalk.red(`Failed to commit and push changes for ${packageDir}`));
    console.error(error);
  }
}

(async () => {
  for (const packageDir of packageDirs) {
    await updateVersionInPackage(packageDir);
    await commitAndPushChanges(packageDir, newVersion);
  }
  console.log(chalk.blue('All versions updated.'));
})();
