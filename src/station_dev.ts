import * as Logtape from "@logtape/logtape";
import { Station } from "station";
import { FileOutput } from "outputs/file";
import { Single } from "sources/single";
import { instance } from "supportlayer";
import * as Support from "supportlayer";
const { FS } = instance;

await Logtape.configure({
  sinks: { console: Logtape.getConsoleSink() },
  loggers: [
    {
      category: "Stations",
      lowestLevel: "debug",
      sinks: ["console"],
    },
    {
      category: ["logtape", "meta"],
      lowestLevel: "warning",
      sinks: ["console"],
    },
  ],
});

FS.mkdir("/output");
FS.mkdir("/media");

FS.mount(FS.filesystems.NODEFS, {
  root: "/home/caturria/output",
}, "/output");
FS.mount(FS.filesystems.NODEFS, {
  root: "/home/caturria/media",
}, "/media");

Support.registerVirtualFile("/test.opus", (data: Uint8Array) => {
  console.log(`Wrote ${data.length} bytes.`);
});

const station = new Station(
  "test",
  48000,
  2,
  4096,
);
const source = Single.make("/media/tempsong.flac", station);
const _output = FileOutput.make("Opus", "/test.opus", {
  bitRate: 192000,
  pkt_size: 0,
  blocksize: 64000,
}, station);
station.start(source);

setTimeout(() => station.close(), 60000);
