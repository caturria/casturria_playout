import { AudioEvent } from "./audio/events.ts";
import { Decoder } from "./audio/decoder.ts";
import { Encoder } from "./audio/encoder.ts";
using decoder = new Decoder();
decoder.addEventListener("setupMilestone", (event: Event) => {
  if (!(event instanceof AudioEvent)) {
    return;
  }
  console.log(
    `Wow! The decoder spit out an event of type ${event.type} with the message: "${event.message}"`,
  );
});

await decoder.open("/home/caturria/tempsong.flac", 48000, 2); //Production code would catch this.
using encoder = new Encoder();
encoder.addEventListener("setupMilestone", (event: Event) => {
  if (!(event instanceof AudioEvent)) {
    return;
  }
  console.log(
    `Wow! The encoder spit out an event of type ${event.type} with the message: "${event.message}"`,
  );
});

await encoder.open("/home/caturria/test.opus", 48000, 2, { bitRate: 192000 }); //Production code would catch this.

while (true) {
  const buffer = await decoder.decode(1024);
  await encoder.encode(buffer);
  if (buffer.length < 1024 * decoder.channels) {
    break;
  }
}
await encoder.finalize();

console.log("Done.");
