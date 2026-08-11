export interface CliPreOptions {
    traceName: string;
    debug: boolean;
}
export declare function runPre(options: CliPreOptions): Promise<void>;
