import * as Logtape from "@logtape/logtape";
import { Station } from "station";
import { IcecastOutput } from "outputs/icecast";
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
  root: "c:/users/caturria/output",
}, "/output");
FS.mount(FS.filesystems.NODEFS, {
  root: "c:/users/caturria/media",
}, "/media");

const station = new Station(
  "test",
  48000,
  2,
  4096,
);
const source = Single.make("/media/tempsong.flac", station);
const _output = await IcecastOutput.make(
  "Icecast",
  "http://localhost:8000/stream.opus",
  "source",
  "hackme",
  {
    codec: "libopus",
    format: "ogg",
    bitRate: 192000,
  },
  station,
);
station.start(source);
