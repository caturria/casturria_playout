import { AudioEvent } from "./audio/events.ts";
import { Decoder } from "./audio/decoder.ts";
import { Encoder } from "./audio/encoder.ts";
import { FilterGraph } from "./audio/filtergraph.ts";
function specialEvent(event: Event) {
  if (!(event instanceof AudioEvent)) {
    return;
  }
  console.log(
    `Wow! It spit out an event of type ${event.type} with the message: "${event.message}"`,
  );
}
using decoder = new Decoder();
decoder.addEventListener("setupMilestone", specialEvent);
await decoder.open("/home/caturria/tempsong.flac", 48000, 2); //Production code would catch this.

using encoder = new Encoder();
encoder.addEventListener("setupMilestone", specialEvent);
await encoder.open("/home/caturria/test.opus", 48000, 2, { bitRate: 192000 }); //Production code would catch this.
using graph = new FilterGraph();
graph.addEventListener("setupMilestone", specialEvent);
await graph.open(
  "anoisesrc=color=pink:sample_rate=48000[0],anoisesrc=color=pink:sample_rate=48000[1],[0][1]amerge[2],[2]amix=inputs=2",
  48000,
  2,
  48000,
  2,
);
let eof: boolean = false;
while (true) {
  const buffer = await decoder.decode(2048);
  await graph.send(buffer, 0);
  const buffer2 = await graph.receive(2048, 0);
  if (buffer2.length != 0) {
    await encoder.encode(buffer2);
  }
  if (eof === true) {
    break;
  }
  if (buffer.length < 2048 * decoder.channels) {
    eof = true;
  }
}

await encoder.finalize();

console.log("Done.");
