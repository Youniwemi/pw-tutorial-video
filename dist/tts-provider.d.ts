export interface TTSResult {
    filePath: string;
    duration: number;
}
export interface TTSProvider {
    readonly name: string;
    synthesize(text: string, outputPath: string): Promise<TTSResult>;
    isAvailable(): Promise<boolean>;
}
export interface TTSProviderOptions {
    lang: string;
    voice?: string;
    rate?: number;
}
/**
 * Command-based TTS provider. Defaults to macOS `say`, can be overridden
 * via TUTORIAL_TTS_CMD env var.
 * Supports placeholders: {lang}, {text}, {output}.
 * If {text}/{output} are present they are substituted in-place; otherwise
 * the legacy "-o <output> <text>" suffix is appended automatically.
 * Examples:
 *   TUTORIAL_TTS_CMD='qsay --my-voice jadou -l {lang} {text} -o {output}'
 *   TUTORIAL_TTS_CMD='say -v Thomas'   (legacy: appends -o <out> "<text>")
 */
export declare class CommandTTSProvider implements TTSProvider {
    readonly name: string;
    private command;
    private options;
    private static VOICES;
    private static LANG_NAMES;
    private static _logged;
    constructor(options: TTSProviderOptions);
    isAvailable(): Promise<boolean>;
    synthesize(text: string, outputPath: string): Promise<TTSResult>;
}
/** Edge TTS provider using Microsoft's free TTS API */
export declare class EdgeTTSProvider implements TTSProvider {
    readonly name = "edge-tts";
    private options;
    private static VOICES;
    constructor(options: TTSProviderOptions);
    isAvailable(): Promise<boolean>;
    synthesize(text: string, outputPath: string): Promise<TTSResult>;
}
/** Auto-detect and create the best available TTS provider */
export declare function createTTSProvider(options: TTSProviderOptions): Promise<TTSProvider>;
/** Audio segment info for later merging */
export interface AudioSegment {
    filePath: string;
    timestamp: number;
    duration: number;
    text: string;
}
/** Manages TTS audio generation and tracking for tutorials */
export declare class TTSManager {
    private provider;
    private options;
    private outputDir;
    private segments;
    private recordingStartTime;
    constructor(options: TTSProviderOptions, outputDir: string);
    initialize(): Promise<void>;
    startRecording(): void;
    speak(text: string): Promise<number>;
    getSegments(): AudioSegment[];
    /** Generate a manifest file for post-processing */
    writeManifest(videoPath: string): Promise<string>;
}
//# sourceMappingURL=tts-provider.d.ts.map