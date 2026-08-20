#!/usr/bin/env node
import { existsSync, mkdirSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { packageVersion, readStamp, writeStamp } from './skill-stamp.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = process.cwd();
const packageRoot = join(__dirname, '..');
const skillsSrc = join(packageRoot, 'skills', 'tutorialize');
const claudeDir = join(projectRoot, '.claude');
const skillDest = join(claudeDir, 'skills', 'tutorialize');
const agentDest = join(claudeDir, 'agents', 'tutorial-crafter.md');
function ask(question) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim().toLowerCase());
        });
    });
}
function yes(answer) {
    return answer === '' || answer === 'y' || answer === 'yes';
}
function usage() {
    console.log(`
Usage: pw-tutorial-video <command> [options]

Commands:
  init          Install /tutorialize skill and tutorial-crafter agent into .claude/
  build-site    Generate a static tutorial video gallery site
  regen-voices  Pre-render the narration voice clips without running any test

Options:
  -y, --yes              Answer yes to everything (for scripted updates)
  --config=<path>        Path to tutorial-site.config.js (build-site only)
  --lang=<lang>          regen-voices: only this language
  --workers=<n>          regen-voices: parallel TTS syntheses (default 2)
  --force                regen-voices: re-synthesize cached clips too (voice change)
`);
}
const AUTO_YES = process.argv.includes('-y') || process.argv.includes('--yes');
/** In --yes mode, take the default without blocking on stdin. */
async function confirm(question) {
    if (AUTO_YES) {
        console.log(`${question}y`);
        return true;
    }
    return yes(await ask(question));
}
/** "0.1.0 → 0.2.0" or "not installed → 0.2.0", for the prompt. */
function transition(from, to) {
    return `${from ?? 'unversioned'} \u2192 ${to}`;
}
async function init() {
    const version = packageVersion(packageRoot);
    console.log(`\n  pw-tutorial-video ${version} — Claude Code Setup\n`);
    if (!existsSync(skillsSrc)) {
        console.error('Could not find skills/ directory in the package. Ensure the package is installed correctly.');
        process.exit(1);
    }
    if (!existsSync(claudeDir)) {
        const answer = await ask('.claude/ directory not found. Create it? [Y/n] ');
        if (!yes(answer)) {
            console.log('Aborted.');
            process.exit(0);
        }
        mkdirSync(claudeDir, { recursive: true });
    }
    const stamp = readStamp(claudeDir);
    // Skill
    if (existsSync(skillDest)) {
        if (stamp.skill === version) {
            console.log(`  Skill already up to date (${version}).`);
        }
        else if (await confirm(`Update skill in .claude/skills/tutorialize/ (${transition(stamp.skill, version)})? [Y/n] `)) {
            copySkill();
            stamp.skill = version;
        }
        else {
            console.log('  Skipping skill.');
        }
    }
    else if (await confirm('Install /tutorialize skill into .claude/skills/? [Y/n] ')) {
        copySkill();
        stamp.skill = version;
    }
    else {
        console.log('  Skipping skill.');
    }
    // Agent
    if (existsSync(agentDest)) {
        if (stamp.agent === version) {
            console.log(`  Agent already up to date (${version}).`);
        }
        else if (await confirm(`Update agent in .claude/agents/tutorial-crafter.md (${transition(stamp.agent, version)})? [Y/n] `)) {
            copyAgent();
            stamp.agent = version;
        }
        else {
            console.log('  Skipping agent.');
        }
    }
    else if (await confirm('Install tutorial-crafter agent into .claude/agents/? [Y/n] ')) {
        copyAgent();
        stamp.agent = version;
    }
    else {
        console.log('  Skipping agent.');
    }
    if (stamp.skill || stamp.agent)
        writeStamp(claudeDir, stamp);
    console.log('\n  Done! You can now use /tutorialize in Claude Code.\n');
}
function copySkill() {
    mkdirSync(skillDest, { recursive: true });
    cpSync(skillsSrc, skillDest, { recursive: true, filter: (src) => !src.endsWith('agent.md') });
    console.log('  + Skill copied to .claude/skills/tutorialize/');
}
function copyAgent() {
    const agentDir = join(claudeDir, 'agents');
    mkdirSync(agentDir, { recursive: true });
    const agentSrc = join(skillsSrc, 'agent.md');
    cpSync(agentSrc, agentDest);
    console.log('  + Agent copied to .claude/agents/tutorial-crafter.md');
}
// Flags may appear before the command: `pw-tutorial-video --yes` means init.
const command = process.argv.slice(2).find((arg) => !arg.startsWith('-'));
if (!command || command === 'init') {
    init().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
else if (command === 'build-site') {
    const configFlag = process.argv.find((a) => a.startsWith('--config='));
    const configPath = configFlag ? configFlag.split('=')[1] : undefined;
    import('./site/build-site.js')
        .then(({ buildSite }) => buildSite(configPath))
        .catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
else if (command === 'regen-voices') {
    // The TTS settings usually live in the project's .env (TUTORIAL_TTS_CMD…).
    try {
        process.loadEnvFile?.(join(process.cwd(), '.env'));
    }
    catch {
        // no .env — environment variables alone drive the TTS
    }
    const flag = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
    const audioDir = join(process.cwd(), 'static', 'audio', 'tutorial-voice');
    import('./voice-prerender.js')
        .then(({ regenVoices }) => regenVoices(audioDir, {
        lang: flag('lang'),
        workers: flag('workers') ? parseInt(flag('workers'), 10) : undefined,
        force: process.argv.includes('--force')
    }))
        .then(({ total, done, failed }) => {
        if (total === 0) {
            console.log('No narration texts found — sources: tutorials/transcripts/ and tutorials/output/.');
        }
        else {
            console.log(`\n${done} voice clip(s) synthesized${failed ? `, ${failed} failed` : ''}.`);
        }
        if (failed)
            process.exit(1);
    })
        .catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
else {
    console.error(`Unknown command: ${command}`);
    usage();
    process.exit(1);
}
//# sourceMappingURL=init.js.map