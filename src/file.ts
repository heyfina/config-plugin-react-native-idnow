import { XcodeProject } from "@expo/config-plugins";

export interface IFile {
  fileRelativePath: string;
  projectRoot: string;
  sourceRoot: string;
  project: XcodeProject;
  projectName: string;
}
