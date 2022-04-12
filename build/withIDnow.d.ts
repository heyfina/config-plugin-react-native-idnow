import { ConfigPlugin, XcodeProject } from '@expo/config-plugins';
export declare function addRNIdNowFiles(projectRoot: string, { filePaths, project, projectName, }: {
    filePaths: string[];
    project: XcodeProject;
    projectName: string | undefined;
}): XcodeProject;
declare const _default: ConfigPlugin<void>;
export default _default;
