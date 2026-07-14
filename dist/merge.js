import { existsSync } from 'fs';
import { join } from 'path';
const DEFAULT_OPTIONS = {
    audioDir: 'static/audio/tutorial-voice',
    musicFile: 'static/audio/tutorial-background.mp3',
    musicVolume: 0.15,
    voiceVolume: 2.5
};
/**
 * Build the ffmpeg command to merge video with audio
 */
export function buildMergeCommand(timeline, videoPath, outputPath, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const fileExists = opts.checkFileExists ?? existsSync;
    const videoDuration = (timeline.totalDurationMs / 1000).toFixed(3);
    const inputs = [videoPath];
    const filterParts = [];
    const audioLabels = [];
    let audioIdx = 1;
    // Add background music
    if (opts.musicFile && fileExists(opts.musicFile)) {
        inputs.push(opts.musicFile);
        filterParts.push(`[1:a]atrim=0:${videoDuration},asetpts=PTS-STARTPTS,volume=${opts.musicVolume}[bg]`);
        audioLabels.push('[bg]');
        audioIdx = 2;
    }
    // Add voice clips
    for (const step of timeline.steps) {
        const audioPath = join(opts.audioDir, step.audioFile);
        if (!fileExists(audioPath)) {
            console.warn(`Missing audio: ${step.audioFile}`);
            continue;
        }
        inputs.push(audioPath);
        filterParts.push(`[${audioIdx}:a]volume=${opts.voiceVolume},adelay=${step.startMs}|${step.startMs}[v${audioIdx}]`);
        audioLabels.push(`[v${audioIdx}]`);
        audioIdx++;
    }
    // Build mix filter
    const totalStreams = audioLabels.length;
    let filter;
    if (totalStreams === 0) {
        filter = 'anullsrc=r=48000:cl=stereo[aout]';
    }
    else if (totalStreams === 1) {
        filter = `${filterParts.join(';')};${audioLabels[0]}anull[aout]`;
    }
    else {
        filter = `${filterParts.join(';')};${audioLabels.join('')}amix=inputs=${totalStreams}:duration=longest:dropout_transition=0:normalize=0[aout]`;
    }
    // Build input args
    const inputArgs = inputs.map((input, i) => {
        if (i === 1 && input === opts.musicFile) {
            return `-stream_loop -1 -i "${input}"`;
        }
        return `-i "${input}"`;
    }).join(' ');
    // Trim dead time from video start (preload period)
    const trimSs = timeline.videoTrimMs ? `-ss ${(timeline.videoTrimMs / 1000).toFixed(3)}` : '';
    const command = `ffmpeg -y ${trimSs} ${inputArgs} -filter_complex "${filter}" -map 0:v -map "[aout]" -c:v copy -c:a libopus -t ${videoDuration} "${outputPath}"`;
    return { command, inputs, filter };
}
//# sourceMappingURL=merge.js.map