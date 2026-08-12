export interface CliMainOptions {
    traceName: string;
    debug: boolean;
    useSpanStore?: boolean;
}
export declare function runMain(options: CliMainOptions): Promise<void>;
