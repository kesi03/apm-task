import { PipelineProfile } from './types';
export declare const profiles: Record<string, PipelineProfile>;
export declare function getProfile(platform: string | undefined): PipelineProfile;
