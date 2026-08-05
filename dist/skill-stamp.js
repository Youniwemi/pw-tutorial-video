import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
export const STAMP_FILE = '.pw-tutorial-video.json';
export function stampPath(claudeDir) {
    return join(claudeDir, STAMP_FILE);
}
export function readStamp(claudeDir) {
    const path = stampPath(claudeDir);
    if (!existsSync(path))
        return {};
    try {
        return JSON.parse(readFileSync(path, 'utf-8'));
    }
    catch {
        return {};
    }
}
export function writeStamp(claudeDir, stamp) {
    writeFileSync(stampPath(claudeDir), `${JSON.stringify(stamp, null, 2)}\n`);
}
export function packageVersion(packageRoot) {
    try {
        return JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf-8')).version ?? '0.0.0';
    }
    catch {
        return '0.0.0';
    }
}
/** What `init` would bring up to date, given what is on disk. */
export function outdated(claudeDir, version, installed) {
    const stamp = readStamp(claudeDir);
    const stale = [];
    if (installed.skill && stamp.skill !== version)
        stale.push('skill');
    if (installed.agent && stamp.agent !== version)
        stale.push('agent');
    return stale;
}
//# sourceMappingURL=skill-stamp.js.map