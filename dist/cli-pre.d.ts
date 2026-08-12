export interface CliPreOptions {
    traceName: string;
    debug: boolean;
    useSpanStore?: boolean;
}
export declare function runPre(options: CliPreOptions): Promise<void>;
