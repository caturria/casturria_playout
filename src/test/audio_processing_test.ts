import { Decoder } from "decoder";
import { Encoder } from "encoder";
import { FilterGraph } from "filtergraph";
import { expect } from "@std/expect";
import { spy } from "@std/testing/mock";
Deno.test("Validate correctness of Audio processing operations", async (t: Deno.TestContext) => {
  await t.step(
    "Create one minute of pink noise at 48000Hz",
    (_t: Deno.TestContext) => {
      const noiseSource = "anoisesrc=color=pink:duration=60";
      const filterDescription =
        `${noiseSource}[0],${noiseSource}[1],[0][1]amerge`;
      using graph = new FilterGraph();

      //The graph doesn't currently have any milestone events, but it does have a completion event to track.
      const filterComplete = spy((_Event: Event) => {});
      graph.addEventListener("filterComplete", filterComplete);

      //There's also the possibility of a failure event:
      const filterFailure = spy((_Event: Event) => {});
      graph.addEventListener("operationFailure", filterFailure);

      expect(graph.open(filterDescription, 48000, 2, 48000, 2))
        .toBeUndefined();

      //This graph should have no inputs and one output.
      expect(graph.inputs).toStrictEqual(0);
      expect(graph.outputs).toStrictEqual(1);

      //Create an encoder to send it to:
      using encoder = new Encoder();

      //Catch setup milestone announcements on the encoder:
      const encoderMilestones = spy((_event: Event) => {});
      encoder.addEventListener("setupMilestone", encoderMilestones);

      expect(encoder.open("file:./pink.flac", 48000, 2, {}))
        .toBeUndefined();

      for (let i = 0; i < 48 * 60; i++) {
        const buffer = graph.receive(1000, 0);
        expect(buffer).toHaveLength(2000);
        expect(encoder.encode(buffer)).toBeUndefined();
      }

      //The graph should be depleted:
      expect(graph.receive(1000, 0)).toHaveLength(0);

      //The completion event on the graph should have fired.
      expect(filterComplete.calls).toHaveLength(1);
      //The failure event should not have:
      expect(filterFailure.calls).toHaveLength(0);

      //The encoder currently announces four setup milestones:
      expect(encoderMilestones.calls).toHaveLength(4);

      //Get the last bit of data out of the encoder:
      expect(encoder.finalize()).toBeUndefined();
      expect(encoder.close()).toBeUndefined();
    },
  );

  await t.step("Verify that pink noise file has correct duration", () => {
    using decoder = new Decoder();

    //Track milestone announcements on the decoder:
    const decoderMilestones = spy((_event: Event) => {});
    decoder.addEventListener("setupMilestone", decoderMilestones);

    //There should be completion events both for muxing and decoding:
    const decodeComplete = spy((_event: Event) => {});
    const demuxComplete = spy((_event: Event) => {});
    decoder.addEventListener("decodeComplete", decodeComplete);
    decoder.addEventListener("demuxComplete", demuxComplete);

    //There can be a failure event which shouldn't happen:
    const decoderFailure = spy((_event: Event) => {});
    decoder.addEventListener("operationFailure", decoderFailure);

    expect(decoder.open("file:./pink.flac", 48000, 2)).toBeUndefined();
    let duration = 0;
    while (true) {
      const buffer = decoder.decode(2000);
      duration += buffer.length;
      if (buffer.length < 2000) {
        break; //EOF.
      }
    }
    expect(duration).toStrictEqual(48000 * 2 * 60);

    //The decoder currently announces four setup milestones:
    expect(decoderMilestones.calls).toHaveLength(4);

    //A completion should have happened:
    expect(decodeComplete.calls).toHaveLength(1);

    //Hopefully there haven't been any operation failures:
    expect(decoderFailure.calls).toHaveLength(0);
  });

  await t.step(
    "Verify duration of pink noise file with resampling and mono mixdown",
    () => {
      using decoder = new Decoder();
      expect(decoder.open("file:./pink.flac", 44100, 1)).toBeUndefined();
      let duration = 0;
      while (true) {
        const buffer = decoder.decode(1000);
        duration += buffer.length;
        if (buffer.length < 1000) {
          break; //EOF.
        }
      }
      expect(duration).toStrictEqual(44100 * 60);
    },
  );

  await t.step("Filtergraph I/O correctness test", () => {
    const noiseSource = "anoisesrc=color=white:sample_rate=48000:duration=90";
    const mixer = "amix=inputs=2:weights=1 0.5";
    const filterDescription =
      `${noiseSource}[0],${noiseSource}[1],[0][1]amerge[2],[2]${mixer}`;
    using decoder = new Decoder();
    expect(decoder.open("file:./pink.flac", 48000, 2)).toBeUndefined();
    using graph = new FilterGraph();
    expect(graph.open(filterDescription, 48000, 2, 48000, 2)).toBeUndefined();

    //Graph should have one input and one output:
    expect(graph.inputs).toStrictEqual(1);
    expect(graph.outputs).toStrictEqual(1);

    let eof = false;
    let outDuration = 0;
    while (true) {
      if (eof === false) {
        const buffer = decoder.decode(1000);
        expect(graph.send(buffer, 0)).toBeUndefined();
        if (buffer.length < 2000) {
          //EOF, so tell the graph that no more input is coming.
          expect(graph.send(null, 0)).toBeUndefined();
          eof = true;
        }
      }
      const buffer = graph.receive(500, 0);
      outDuration += buffer.length;
      if (eof === true && buffer.length < 1000) {
        break;
      }
    }
    expect(outDuration).toStrictEqual(48000 * 2 * 90);
  });

  await t.step("cleanup", (_t: Deno.TestContext) => {
    expect(Deno.removeSync("./pink.flac")).toBeUndefined();
  });
});
