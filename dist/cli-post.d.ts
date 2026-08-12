export interface CliPostOptions {
    traceName: string;
    fail: boolean;
    debug: boolean;
    useSpanStore?: boolean;
}
export declare function runPost(options: CliPostOptions): Promise<void>;
