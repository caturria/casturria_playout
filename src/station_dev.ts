import * as Logtape from "@logtape/logtape";
import { Station } from "station";
import { Output } from "output";

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

function configureSources() {
  console.log("Configure sources.");
}

function configureOutputs() {
  console.log("Configure outputs.");
}

const station = await Station.configure(
  "test",
  48000,
  2,
  configureSources,
  configureOutputs,
);
setTimeout(() => station.close(), 60000);
