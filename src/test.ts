import { Buffer } from "node:buffer";
import { AudioEvents } from "./audio/events.ts";
import {SupportLayer} from "./audio/supportlayer.ts";

const eventHandler = SupportLayer.symbols.casturria_newEventHandler();
const callback = new Deno.UnsafeCallback(
    {parameters: ["u32", "pointer"],
        result: "void"} as const,
        (type: number, details: Deno.PointerValue <unknown>) => {
            console.log(`Got event ${type}.`);

        });

        SupportLayer.symbols.casturria_subscribeToEvent(eventHandler, AudioEvents.EVENTTYPE_DECODE_CONFIGURED_CODEC, true);

const filename = Buffer.from("/home/caturria/tempsong.flac");
const decoder = await SupportLayer.symbols.casturria_newDecoder(filename, eventHandler, callback.pointer, 48000, 2);
if(decoder == null)
{
    console.log("Failed to open decoder.");
    Deno.exit(0);
}

const samples = BigInt(1024);
const buffer = new Float32Array(Number(samples) * 2);
console.log(`Length is ${buffer.length}`);
const encoder = await SupportLayer.symbols.casturria_newEncoder(Buffer.from("/home/caturria/test.wav"), eventHandler, callback.pointer, 48000, 2, null);
if(encoder == null)
{
    console.log("Failed to open encoder.");
    Deno.exit(0);
}

while(true)
{
    const result = await SupportLayer.symbols.casturria_decode(decoder, buffer, BigInt(samples));
    await SupportLayer.symbols.casturria_encode(encoder, buffer, result);
    if(result < samples)
    {
        break;
    }
}

await SupportLayer.symbols.casturria_finalizeEncoder(encoder);
await SupportLayer.symbols.casturria_freeEncoder(encoder);
await SupportLayer.symbols.casturria_freeDecoder(decoder);

console.log("Done.");
