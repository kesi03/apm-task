export interface CliMainOptions {
    traceName: string;
    debug: boolean;
}
export declare function runMain(options: CliMainOptions): Promise<void>;
