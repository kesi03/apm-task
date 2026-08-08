export interface CliPostOptions {
    traceName: string;
    fail: boolean;
    debug: boolean;
}
export declare function runPost(options: CliPostOptions): Promise<void>;
