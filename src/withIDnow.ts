import {
  ConfigPlugin,
  withSettingsGradle,
  withMainApplication,
  withAppBuildGradle,
  withProjectBuildGradle,
  AndroidConfig,
  withAndroidManifest,
  createRunOncePlugin,
  WarningAggregator,
  withDangerousMod,
  withXcodeProject,
  XcodeProject,
  IOSConfig,
  ExportedConfigWithProps,
} from '@expo/config-plugins';
import { Stream } from 'stream';
import { ExpoConfig } from '@expo/config-types';
import { copyFileSync, PathLike, promises } from 'fs';
import { basename, resolve, join } from 'path';
import { IFile } from './file';

const { getMainApplicationOrThrow } = AndroidConfig.Manifest;

// updating ios...
const withPodfileUpdate = (config: ExpoConfig) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      await editPodfile(config, (podfile: any) => {
        // Fix for an error taken from here
        // https://dev.to/kylefoo/xcode-12-new-build-system-warns-multiple-commands-produce-assets-car-56im
        // solution (2)
        podfile = addLines(podfile, 'platform :ios', 1, [
          "install! 'cocoapods', :disable_input_output_paths => true",
          "plugin 'cocoapods-user-defined-build-types'",
          '',
          'enable_user_defined_build_types!',
        ]);
        podfile = addLines(podfile, 'config = use_native_modules!', 1, [
          "  pod 'IDnowSDK', '6.1.0', :build_type => :static_framework",
          "  pod 'AFNetworking', '4.0.1', :modular_headers => true",
          "  pod 'FLAnimatedImage', '1.0.17', :modular_headers => true",
          "  pod 'libPhoneNumber-iOS', '0.9.15', :modular_headers => true",
          "  pod 'Masonry', '1.1.0', :modular_headers => true",
          "  pod 'SocketRocket', '0.5.1', :modular_headers => true",
          '',
        ]);

        //Fix from https://github.com/idnow/de.idnow.ios#cocoapods--xcode-9
        podfile = addLines(podfile, 'react_native_post_install', 2, [
          '',
          // 'post_install do |installer|', // this was used before a similar section started being included on the podFile
          `    copy_pods_resources_path = "Pods/Target Support Files/Pods-${config.modRequest.projectName}/Pods-${config.modRequest.projectName}-resources.sh"`, // '	string_to_replace = \'--compile "${BUILT_PRODUCTS_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}"\'',
          '    string_to_replace = \'if [[ $line != "${PODS_ROOT}*" ]]; then\'', // '	assets_compile_with_app_icon_arguments = \'--compile "${BUILT_PRODUCTS_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}" --app-icon "${ASSETCATALOG_COMPILER_APPICON_NAME}" --output-partial-info-plist "${BUILD_DIR}/assetcatalog_generated_info.plist"\'',
          '    assets_compile_with_app_icon_arguments = \'if [[ $line != "${PODS_ROOT}*" && $line != *"Sample"* ]]; then\'',
          '    text = File.read(copy_pods_resources_path)',
          '    new_contents = text.gsub(string_to_replace, assets_compile_with_app_icon_arguments)',
          '    File.open(copy_pods_resources_path, "w") {|file| file.puts new_contents }',
          // 'end', // this was used before a similar section started being included on the podFile
          '',
        ]);
        return podfile;
      });
      return config;
    },
  ]);
};

async function editPodfile(
  config: ExportedConfigWithProps<unknown>,
  action: { (podfile: any): any; (arg0: string): any }
) {
  const podfilePath = join(config.modRequest.platformProjectRoot, 'Podfile');
  try {
    const podfile = action(await readFileAsync(podfilePath));

    return await saveFileAsync(podfilePath, podfile);
  } catch (e) {
    WarningAggregator.addWarningIOS(
      'idnow',
      `Couldn't modified Podfile - ${e}.`
    );
  }
}

async function readFileAsync(path: PathLike | promises.FileHandle) {
  return promises.readFile(path, 'utf8');
}

async function saveFileAsync(
  path: PathLike | promises.FileHandle,
  content:
    | string
    | NodeJS.ArrayBufferView
    | Iterable<string | NodeJS.ArrayBufferView>
    | AsyncIterable<string | NodeJS.ArrayBufferView>
    | Stream
) {
  return promises.writeFile(path, content, 'utf8');
}

function addLines(
  content: string,
  find: string,
  offset: number,
  toAdd: string[]
) {
  const lines = content.split('\n');

  let lineIndex = lines.findIndex((line: string) => line.match(find));

  for (const newLine of toAdd) {
    lines.splice(lineIndex + offset, 0, newLine);
    lineIndex++;
  }

  return lines.join('\n');
}

const ERROR_MSG_PREFIX = 'An error occurred while configuring iOS project. ';
const filePaths = ['./RNIdnow'];

const withXCodeProjectUpdate = (config: ExpoConfig) => {
  return withXcodeProject(config, (config) => {
    addRNIdNowFiles({
      projectRoot: config.modRequest.projectRoot,
      currentDir: __dirname,
      filePaths,
      project: config.modResults,
      projectName: config.modRequest.projectName,
    });
    return config;
  });
};

export function addRNIdNowFiles({
  projectRoot,
  currentDir,
  filePaths,
  project,
  projectName,
}: {
  projectRoot: string;
  currentDir: string;
  filePaths: string[];
  project: XcodeProject;
  projectName: string | undefined;
}): XcodeProject {
  if (!projectName) {
    throw new Error(ERROR_MSG_PREFIX + `Unable to find iOS project name.`);
  }
  const sourceRoot = IOSConfig.Paths.getSourceRoot(projectRoot);
  for (const fileRelativePath of filePaths) {
    addMFile({
      fileRelativePath: fileRelativePath + ".m",
      currentDir,
      sourceRoot,
      project,
      projectName,
    });
    addHFile({
      fileRelativePath: fileRelativePath + ".h",
      currentDir,
      sourceRoot,
      project,
      projectName,
    });
  }
  return project;
}

const addMFile = (file: IFile) => {
  let { fileRelativePath, currentDir, sourceRoot, project, projectName } = file;
  const fileName = basename(fileRelativePath);
  const sourceFilepath = resolve(currentDir, fileRelativePath);
  const destinationFilepath = resolve(sourceRoot, "..", fileName);

  copyFileSync(sourceFilepath, destinationFilepath);
  if (!project.hasFile(`${projectName}/${fileName}`)) {
    project = IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
      filepath: fileName,
      groupName: projectName,
      project,
    });
  }
};
const addHFile = (file: IFile) => {
  let { fileRelativePath, currentDir, sourceRoot, project, projectName } = file;
  const fileName = basename(fileRelativePath);
  const sourceFilepath = resolve(currentDir, fileRelativePath);
  const destinationFilepath = resolve(sourceRoot, "..", fileName);

  copyFileSync(sourceFilepath, destinationFilepath);
  if (!project.hasFile(`${projectName}/${fileName}`)) {
    project = IOSConfig.XcodeUtils.addFileToGroupAndLink({
      filepath: fileName,
      groupName: projectName,
      project,
      addFileToProject({ project, file }) {
        project.addToPbxFileReferenceSection(file);
      },
    });
  }
};

// updating android...
// Update AndroidManifest by adding xmlns:tools to the manifest tag and tools:replace to the application tag
const applyManifestConfig = async (
  config: Pick<ExpoConfig, 'android'>,
  androidManifest: AndroidConfig.Manifest.AndroidManifest
): Promise<AndroidConfig.Manifest.AndroidManifest> => {
  // Get the <application /> tag and assert if it doesn't exist.
  const mainApplication = getMainApplicationOrThrow(androidManifest);
  const manifest = androidManifest.manifest;
  const xmlnsTools = {
    'xmlns:tools': 'http://schemas.android.com/tools',
  };
  const toolsReplace = {
    'tools:replace':
      'android:name,android:icon,android:theme,android:allowBackup',
  };

  // Add xmlns:tools attribute to the manifest tag
  if (!manifest.$.hasOwnProperty('xmlns:tools')) {
    manifest.$ = {
      ...manifest.$,
      ...xmlnsTools,
    };
  }

  // Add tools:replace attribute to the application tag
  if (!mainApplication.$.hasOwnProperty('tools:replace')) {
    mainApplication.$ = {
      ...mainApplication.$,
      ...toolsReplace,
    };
  }

  return androidManifest;
};

// Add import com.bitwala.idnow.RNIdnowPackage; to the imports at the top of the file
const applyPackage = (mainApplication: string) => {
  const idnowPackageImport = `import com.bitwala.idnow.RNIdnowPackage;\n`;

  // Make sure the project does not have the settings already
  if (!mainApplication.includes(idnowPackageImport)) {

    //finde the line that says package <package_name> and add idnow import afterwards
    mainApplication = mainApplication.replace(
      /package ([\w].*);/,
      `package $1;\n\n${idnowPackageImport}`
    );
  }

  return mainApplication;
};

/*
include react-native-idnow android/settings.gradle
*/
const applySettings = (gradleSettings: string) => {
  const idnowSettings = `include ':react-native-idnow'\nproject(':react-native-idnow').projectDir = new File(rootProject.projectDir, '../node_modules/react-native-idnow/android')`;
  // Make sure the project does not have the settings already
  if (!gradleSettings.includes(idnowSettings)) {
    return gradleSettings + idnowSettings;
  }

  return gradleSettings;
};

// Add react-native-idnow inside the dependencies block in android/app/build.gradle
const applyImplementation = (appBuildGradle: string) => {
  const idnowImplementation = `compile project(':react-native-idnow')\nimplementation ('de.idnow.android.sdk:idnow-platform:4.12.0')`;

  // Make sure the project does not have the dependency already
  if (!appBuildGradle.includes(idnowImplementation)) {
    return appBuildGradle.replace(
      /dependencies\s?{/,
      `dependencies {\n${idnowImplementation}`
    );
  }

  return appBuildGradle;
};

// Add the following to allprojects/repositories in android/build.gradle
const applyRepositories = (appBuildGradle: string) => {
  const idnowRepositories = `maven {
        url "https://raw.githubusercontent.com/idnow/de.idnow.android.sdk/master"
     }
     maven {
        url "https://raw.githubusercontent.com/idnow/de.idnow.android/de.idnow.android-5.0.12.1"
     }`;

  // Make sure the project does not have the repositories already
  if (!appBuildGradle.includes(idnowRepositories)) {
    return appBuildGradle.replace(
      /allprojects\s{\n\s*repositories\s{/,
      `allprojects {\nrepositories {
          ${idnowRepositories}`
    );
  }

  return appBuildGradle;
};

//exclude section
const applyPackagingOptionsAndConfigurations = (appBuildGradle: string) => {
  const idnowPackagingOptions = `\nandroid {
    packagingOptions {
        exclude "org.bouncycastle"
        exclude 'org/bouncycastle/x509/CertPathReviewerMessages_de.properties'
        exclude 'org/bouncycastle/x509/CertPathReviewerMessages.properties'
        exclude 'org.bouncycastle.LICENSE'
        exclude 'META-INF/DEPENDENCIES.txt'
        exclude 'META-INF/LICENSE.txt'
        exclude 'META-INF/NOTICE.txt'
        exclude 'META-INF/NOTICE'
        exclude 'META-INF/LICENSE'
        exclude 'META-INF/DEPENDENCIES'
        exclude 'META-INF/notice.txt'
        exclude 'META-INF/license.txt'
        exclude 'META-INF/dependencies.txt'
        exclude 'META-INF/LGPL2.1'
        exclude("META-INF/*.kotlin_module")
        exclude 'META-INF/proguard/androidx-annotations.pro'
    }
    configurations.all {
      exclude module: 'bcprov-jdk15to18'
    }
}`;

  // Make sure the project does not have the packagingOptions already
  if (!appBuildGradle.includes(idnowPackagingOptions)) {
    return appBuildGradle + idnowPackagingOptions;
  }

  return appBuildGradle;
};

const withIDnow: ConfigPlugin = (expoConfig: ExpoConfig) => {
  expoConfig = withMainApplication(expoConfig, (config) => {
    config.modResults.contents = applyPackage(config.modResults.contents);
    return config;
  });

  expoConfig = withAndroidManifest(expoConfig, async (config) => {
    // Modifiers can be async, but try to keep them fast.
    config.modResults = await applyManifestConfig(config, config.modResults);
    return config;
  });

  expoConfig = withSettingsGradle(expoConfig, (config) => {
    config.modResults.contents = applySettings(config.modResults.contents);
    return config;
  });

  expoConfig = withAppBuildGradle(expoConfig, (config) => {
    config.modResults.contents = applyImplementation(
      config.modResults.contents
    );
    config.modResults.contents = applyPackagingOptionsAndConfigurations(
      config.modResults.contents
    );
    return config;
  });

  expoConfig = withProjectBuildGradle(expoConfig, (config) => {
    config.modResults.contents = applyRepositories(config.modResults.contents);
    return config;
  });

  expoConfig = withPodfileUpdate(expoConfig);
  expoConfig = withXCodeProjectUpdate(expoConfig);

  return expoConfig;
};

export default createRunOncePlugin(withIDnow, 'IDNowSDK', '1.0.11');
