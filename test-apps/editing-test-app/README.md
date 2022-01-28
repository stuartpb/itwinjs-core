# Editing Test App

## About this Application

The application contained within this directory provides a test environment for developers working on authoring functionality of iTwin.js.

## Getting Started

The application may be run as an Electron app. The following steps outline the procedure for successfully building the application as part of a larger monorepo, and then starting the application via npm scripts.

1. To get started, follow the instructions to setup the entire repository, located [here](../../README.md#Build\ Instructions).
2. If you want to work online, follow the configure the [client application section](#client-configuration).
    > If you intend to use the editing-test-app offline with a standalone iModel, you can safely ignore these instructions.
3. Optionally, set other environment variables to configure the application prior to startup. The full list of supported variables is defined in [.env.template](./.env.template).

* To start the application, navigate to the root of editing-test-app, and use the command:

  ```cmd
  npm start
  ```

## Client Configuration

To use the editing-test-app with iModels and other services in the iTwin Platform, a client needs to be registered and configured within the developer portal.

If you do not already have an existing client you can register it [here](https://developer.bentley.com/my-apps/).
