import { Decoder } from "decoder";
import { Encoder } from "encoder";
import { FilterGraph } from "filtergraph";
import { expect } from "@std/expect";
import { spy } from "@std/testing/mock";
Deno.test("Validate correctness of Audio processing operations", async (t: Deno.TestContext) => {
  await t.step(
    "Create one minute of pink noise at 48000Hz",
    async (_t: Deno.TestContext) => {
      const noiseSource = "anoisesrc=color=pink:duration=60";
      const filterDescription =
        `${noiseSource}[0],${noiseSource}[1],[0][1]amerge`;
      await using graph = new FilterGraph();

      //The graph doesn't currently have any milestone events, but it does have a completion event to track.
      const filterComplete = spy((_Event: Event) => {});
      graph.addEventListener("filterComplete", filterComplete);

      //There's also the possibility of a failure event:
      const filterFailure = spy((_Event: Event) => {});
      graph.addEventListener("operationFailure", filterFailure);

      await expect(graph.open(filterDescription, 48000, 2, 48000, 2)).resolves
        .toBeUndefined();

      //This graph should have no inputs and one output.
      expect(graph.inputs).toStrictEqual(0);
      expect(graph.outputs).toStrictEqual(1);

      //Create an encoder to send it to:
      await using encoder = new Encoder();

      //Catch setup milestone announcements on the encoder:
      const encoderMilestones = spy((_event: Event) => {});
      encoder.addEventListener("setupMilestone", encoderMilestones);

      await expect(encoder.open("file:./pink.flac", 48000, 2, {})).resolves
        .toBeUndefined();

      for (let i = 0; i < 48 * 60; i++) {
        const buffer = await graph.receive(1000, 0);
        expect(buffer).toHaveLength(2000);
        await expect(encoder.encode(buffer)).resolves.toBeUndefined();
      }

      //The graph should be depleted:
      await expect(graph.receive(1000, 0)).resolves.toHaveLength(0);

      //The completion event on the graph should have fired.
      expect(filterComplete.calls).toHaveLength(1);
      //The failure event should not have:
      expect(filterFailure.calls).toHaveLength(0);

      //The encoder currently announces four setup milestones:
      expect(encoderMilestones.calls).toHaveLength(4);

      //Get the last bit of data out of the encoder:
      await expect(encoder.finalize()).resolves.toBeUndefined();
      await expect(encoder.close()).resolves.toBeUndefined();
    },
  );

  await t.step("Verify that pink noise file has correct duration", async () => {
    await using decoder = new Decoder();

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

    await expect(decoder.open("file:./pink.flac", 48000, 2)).resolves
      .toBeUndefined();
    let duration = 0;
    while (true) {
      const buffer = await decoder.decode(2000);
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
    async () => {
      await using decoder = new Decoder();
      await expect(decoder.open("file:./pink.flac", 44100, 1)).resolves
        .toBeUndefined();
      let duration = 0;
      while (true) {
        const buffer = await decoder.decode(1000);
        duration += buffer.length;
        if (buffer.length < 1000) {
          break; //EOF.
        }
      }
      expect(duration).toStrictEqual(44100 * 60);
    },
  );

  await t.step("Filtergraph I/O correctness test", async () => {
    const noiseSource = "anoisesrc=color=white:sample_rate=48000:duration=90";
    const mixer = "amix=inputs=2:weights=1 0.5";
    const filterDescription =
      `${noiseSource}[0],${noiseSource}[1],[0][1]amerge[2],[2]${mixer}`;
    await using decoder = new Decoder();
    await expect(decoder.open("file:./pink.flac", 48000, 2)).resolves
      .toBeUndefined();
    await using graph = new FilterGraph();
    await expect(graph.open(filterDescription, 48000, 2, 48000, 2)).resolves
      .toBeUndefined();

    //Graph should have one input and one output:
    expect(graph.inputs).toStrictEqual(1);
    expect(graph.outputs).toStrictEqual(1);

    let eof = false;
    let outDuration = 0;
    while (true) {
      if (eof === false) {
        const buffer = await decoder.decode(1000);
        await expect(graph.send(buffer, 0)).resolves.toBeUndefined();
        if (buffer.length < 2000) {
          //EOF, so tell the graph that no more input is coming.
          await expect(graph.send(null, 0)).resolves.toBeUndefined();
          eof = true;
        }
      }
      const buffer = await graph.receive(500, 0);
      outDuration += buffer.length;
      if (eof === true && buffer.length < 1000) {
        break;
      }
    }
    expect(outDuration).toStrictEqual(48000 * 2 * 90);
  });
  await t.step("cleanup", async (_t: Deno.TestContext) => {
    await expect(Deno.remove("./pink.flac")).resolves.toBeUndefined();
  });
});
