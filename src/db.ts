import { readFile, writeFile, access, fstat } from "fs";

const path = "db.txt";

export function writeWatermark(watermark: number) {
  return new Promise((resolve, reject) => {
    writeFile(path, watermark.toString(), (error) => {
      if (error) {
        reject(error);
        return;
      }

      console.log("wrote watermark: ", watermark);
      resolve(undefined);
    });
  });
}

export async function readWatermark(): Promise<number> {
  return new Promise((resolve, reject) => {
    readFile(path, (error, data) => {
      if (error) {
        reject(error);
        return;
      }

      const watermark = Number(data.toString());

      console.log("read watermark: ", watermark);
      resolve(watermark);
    });
  });
}
