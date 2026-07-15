#!/usr/bin/env node
import { existsSync, mkdirSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = process.cwd();
const packageRoot = join(__dirname, '..');
const skillsSrc = join(packageRoot, 'skills', 'tutorialize');

const claudeDir = join(projectRoot, '.claude');
const skillDest = join(claudeDir, 'skills', 'tutorialize');
const agentDest = join(claudeDir, 'agents', 'tutorial-crafter.md');

function ask(question: string): Promise<string> {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			rl.close();
			resolve(answer.trim().toLowerCase());
		});
	});
}

function yes(answer: string): boolean {
	return answer === '' || answer === 'y' || answer === 'yes';
}

function usage() {
	console.log(`
Usage: pw-tutorial-video <command>

Commands:
  init    Install /tutorialize skill and tutorial-crafter agent into .claude/
`);
}

async function init() {
	console.log('\n  pw-tutorial-video — Claude Code Setup\n');

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

	// Skill
	const skillExists = existsSync(skillDest);
	if (skillExists) {
		const answer = await ask('Skill already exists at .claude/skills/tutorialize/. Overwrite? [Y/n] ');
		if (!yes(answer)) {
			console.log('  Skipping skill.');
		} else {
			copySkill();
		}
	} else {
		const answer = await ask('Install /tutorialize skill into .claude/skills/? [Y/n] ');
		if (yes(answer)) {
			copySkill();
		} else {
			console.log('  Skipping skill.');
		}
	}

	// Agent
	const agentExists = existsSync(agentDest);
	if (agentExists) {
		const answer = await ask('Agent already exists at .claude/agents/tutorial-crafter.md. Overwrite? [Y/n] ');
		if (!yes(answer)) {
			console.log('  Skipping agent.');
		} else {
			copyAgent();
		}
	} else {
		const answer = await ask('Install tutorial-crafter agent into .claude/agents/? [Y/n] ');
		if (yes(answer)) {
			copyAgent();
		} else {
			console.log('  Skipping agent.');
		}
	}

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

const command = process.argv[2];

if (!command || command === 'init') {
	init().catch((err) => {
		console.error(err);
		process.exit(1);
	});
} else {
	console.error(`Unknown command: ${command}`);
	usage();
	process.exit(1);
}
