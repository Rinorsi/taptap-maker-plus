declare module "archiver" {
  import type { Transform } from "node:stream";

  export type ArchiverEntryData = {
    name: string;
  };

  export type ArchiverFileData = {
    name: string;
  };

  export class Archiver extends Transform {
    append(source: Buffer | string, data: ArchiverEntryData): this;
    file(filePath: string, data: ArchiverFileData): this;
    finalize(): Promise<void>;
  }

  export class ZipArchive extends Archiver {
    constructor(options?: { zlib?: { level?: number } });
  }
}
