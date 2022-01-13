# Expo Config Plugin `react-native-idnow`

An [Expo config plugin](https://docs.expo.io/guides/config-plugins) for easily setting up [React Native IDnow](https://github.com/bitwala/react-native-idnow)

## Installation

#### Prerequisites

- App project using Expo SDK 43+.
- Installed `expo-cli@5.0.3` or later.
- Installed `idnow-react-native` JavaScript libraries.

#### With `expo install`

```
expo install @heyfina/config-plugin-react-native-idnow
```

#### Without `expo install`

```sh
# using yarn
yarn add @heyfina/config-plugin-react-native-idnow

# using npm
npm install @heyfina/config-plugin-react-native-idnow
```

Open your `app.json` and update your `plugins` section (`expo install` would do it for you):

```json
{
  "plugins": ["@heyfina/config-plugin-react-native-idnow"]
}
```

## Building and running

You can either:

- use `expo prebuild` or `expo run:android`/`expo run:ios` to update your native projects,
- use _[EAS Build](https://docs.expo.io/build/introduction/)_ to build your development client.

## Contributing

Contributions are very welcome! The package uses `expo-module-scripts` for most tasks. You can find detailed information [at this link](https://github.com/expo/expo/tree/master/packages/expo-module-scripts#-config-plugin).

Please make sure to run `yarn build`/`yarn rebuild` to update the `build` directory before pushing. The CI will fail otherwise.

## Credits

- [@_the heyfina team_](https://github.com/heyfina)

- <https://github.com/expo/config-plugins>

## License

MIT
