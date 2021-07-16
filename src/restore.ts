import * as cache from "@actions/cache";
import * as utils from "@actions/cache/lib/internal/cacheUtils";
import { extractTar, listTar } from "@actions/cache/lib/internal/tar";
import * as core from "@actions/core";
import * as path from "path";
import {
  findObject,
  formatSize,
  getInputAsArray,
  getInputAsBoolean,
  newMinio,
  setCacheHitOutput
} from "./utils";

process.on("uncaughtException", (e) => core.info("warning: " + e.message));

async function restoreCache() {
  try {
    const bucket = core.getInput("bucket", { required: true });
    const key = core.getInput("key", { required: true });

    try {
      const mc = newMinio();

      const compressionMethod = await utils.getCompressionMethod();
      const cacheFileName = utils.getCacheFileName(compressionMethod);
      core.info(`Cache file name: ${cacheFileName}`)
      const archivePath = path.join(
        await utils.createTempDirectory(),
        cacheFileName
      );
      core.info(`archivePath: ${archivePath}`)

      const keys = [key];

      const obj = await findObject(mc, bucket, keys, compressionMethod);
      core.info("found cache object");
      core.info(
        `Downloading cache from s3 to ${archivePath}. bucket: ${bucket}, object: ${obj.name}`
      );
      await mc.fGetObject(bucket, obj.name, archivePath);

      if (core.isDebug()) {
        await listTar(archivePath, compressionMethod);
      }

      core.info(`Cache Size: ${formatSize(obj.size)} (${obj.size} bytes)`);

      await extractTar(archivePath, compressionMethod);
      setCacheHitOutput(key, true);
      core.info("Cache restored from s3 successfully");
    } catch (e) {
      core.info("Restore s3 cache failed: " + e.message);
      setCacheHitOutput(key, false);
      core.warning("Cache item not found")
    }
  } catch (e) {
    core.setFailed(e.message);
  }
}

restoreCache();
