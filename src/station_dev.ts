import * as Logtape from "@logtape/logtape";
import { Station } from "station";

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

const station = new Station("test", 48000, 2);
station.start();
setTimeout(() => station.stop(), 60000);
