#!/usr/bin/env node
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { outdated, packageVersion } from './skill-stamp.js';
/**
 * Prints a one-line reminder when a project's copied skill/agent no longer
 * matches the installed package. It never writes anything: a dependency has no
 * business editing a project's `.claude/` directory unasked.
 *
 * Silent unless there is something to say, and it must never fail an install —
 * every path exits 0.
 */
try {
    const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
    // npm sets INIT_CWD to the directory the install was launched from.
    const projectRoot = process.env.INIT_CWD || process.cwd();
    const claudeDir = join(projectRoot, '.claude');
    const installed = {
        skill: existsSync(join(claudeDir, 'skills', 'tutorialize')),
        agent: existsSync(join(claudeDir, 'agents', 'tutorial-crafter.md'))
    };
    // Nothing installed means the project never opted in — stay quiet.
    if (installed.skill || installed.agent) {
        const version = packageVersion(packageRoot);
        const stale = outdated(claudeDir, version, installed);
        if (stale.length > 0) {
            const what = stale.join(' and ');
            const verb = stale.length > 1 ? 'are' : 'is';
            console.log(`\npw-tutorial-video ${version}: your ${what} in .claude/ ${verb} out of date.` +
                `\n  Run: npx pw-tutorial-video init\n`);
        }
    }
}
catch {
    // A reminder is never worth breaking an install over.
}
//# sourceMappingURL=postinstall.js.map