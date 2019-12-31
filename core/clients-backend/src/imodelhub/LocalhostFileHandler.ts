/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModelHub */

import { Logger } from "@bentley/bentleyjs-core";
import { FileHandler, AuthorizedClientRequestContext, ProgressInfo } from "@bentley/imodeljs-clients";
import { ClientsBackendLoggerCategory } from "../ClientsBackendLoggerCategory";
import * as https from "https";
import * as pathLib from "path";
import * as fs from "fs-extra";
import * as url from "url";

const loggerCategory: string = ClientsBackendLoggerCategory.IModelHub;

/**
 * Provides methods to work with the local file system. An instance of this class has to be provided to [[IModelClient]] for file upload/download methods to work.
 * @internal
 */
export class LocalhostHandler implements FileHandler {
  public agent: https.Agent;

  /**
   * Download a file.
   * @param requestContext The client request context
   * @param downloadUrl URL to download file from.
   * @param path Path to download the file to, including file name.
   * @param fileSize Size of the file that's being downloaded.
   * @param progressCallback Callback for tracking progress.
   */
  public async downloadFile(_requestContext: AuthorizedClientRequestContext, downloadUrl: string, path: string, fileSize?: number, progress?: (progress: ProgressInfo) => void): Promise<void> {
    Logger.logTrace(loggerCategory, `Downloading file from '${downloadUrl}' to '${path}'.`);
    await fs.copy(url.fileURLToPath(downloadUrl), path);
    if (progress) {
      const size = fileSize || this.getFileSize(path);
      progress({
        loaded: size,
        total: size,
        percent: 100,
      });
    }
  }

  /**
   * Upload a file.
   * @param requestContext The client request context
   * @param uploadUrl URL to upload the file to.
   * @param path Path of the file to be uploaded.
   * @param progressCallback Callback for tracking progress.
   */
  public async uploadFile(_requestContext: AuthorizedClientRequestContext, uploadUrlString: string, path: string, progress?: (progress: ProgressInfo) => void): Promise<void> {
    Logger.logTrace(loggerCategory, `Uploading file '${path}' to '${uploadUrlString}'.`);
    await fs.copy(path, url.fileURLToPath(uploadUrlString));
    if (progress) {
      const fileSize = this.getFileSize(path);
      progress({
        loaded: fileSize,
        total: fileSize,
        percent: 100,
      });
    }
  }

  /**
   * Get size of a file.
   * @param filePath Path of the file.
   * @returns Size of the file.
   */
  public getFileSize(filePath: string): number {
    return fs.statSync(filePath).size;
  }

  /**
   * Check if path is a directory.
   * @param filePath Path of the file.
   * @returns True if path is directory.
   */
  public isDirectory(filePath: string): boolean {
    return fs.statSync(filePath).isDirectory();
  }

  /**
   * Check if path exists.
   * @param filePath Path of the file.
   * @returns True if path exists.
   */
  public exists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  /**
   * Get file name from the path.
   * @param filePath Path of the file.
   * @returns File name.
   */
  public basename(filePath: string): string {
    return pathLib.basename(filePath);
  }

  /**
   * Join multiple strings into a single path.
   * @param paths Strings to join.
   * @returns Joined path.
   */
  public join(...paths: string[]): string {
    return pathLib.join(...paths);
  }
}
