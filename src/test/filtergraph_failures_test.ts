import {FilterGraph} from "filtergraph";
import { expect } from "@std/expect";
const {BadResource} = Deno.errors;

Deno.test("Filtergraph should fail fast on invalid configuration", async (_t: Deno.TestContext) => {
    await using graph = new FilterGraph();

    //This invalid filtergraph specification fails to parse:
    await expect(graph.open("London Bridge is falling down", 48000, 2, 48000, 2)).rejects.toThrow("Filter not found");

    //Valid specification but invalid I/O parameters:
    await expect(graph.open("amix=inputs=2", -1031, 2, 44100, 2)).rejects.toThrow(RangeError);
    await expect(graph.open("amix=inputs=2", 44100.2468, 2, 44100, 2)).rejects.toThrow(TypeError);
    await expect(graph.open("amix=inputs=2", 44100, 2, -1031, 2)).rejects.toThrow(RangeError);
    await expect(graph.open("amix=inputs=2", 44100, 2, 44100.2468, 2)).rejects.toThrow(TypeError);
    await expect(graph.open("amix=inputs=2", 44100, 255, 44100, 2)).rejects.toThrow(RangeError);
    await expect(graph.open("amix=inputs=2", 44100, 2.468, 44100, 2)).rejects.toThrow(TypeError);
    await expect(graph.open("amix=inputs=2", 44100, 2, 44100, 255)).rejects.toThrow(RangeError);
    await expect(graph.open("amix=inputs=2", 44100, 2, 44100, 2.468)).rejects.toThrow(TypeError);
      //The read-only encoder properties should still be zero because it hasn't been successfully opened.
  expect(graph.inSampleRate).toStrictEqual(0);
  expect(graph.inChannels).toBe(0);
  expect(graph.outSampleRate).toStrictEqual(0);
  expect(graph.outChannels).toBe(0);

});

Deno.test("Filtergraph should detect API abuse", async (_t: Deno.TestContext) => {
    await using graph = new FilterGraph();
    //Can't send to a graph that's not open:
    await expect(graph.send(new Float32Array(32), 0)).rejects.toThrow(BadResource);

    //Can't receive from an unopened graph either:
    await expect(graph.receive(32, 0)).rejects.toThrow(BadResource);

    //Open the graph correctly this time:
    await expect(graph.open("amix=inputs=2", 48000, 2, 48000, 2)).resolves.toBeUndefined();

      //Double open attempt:
  await expect(graph.open("amix=inputs=2", 48000, 2, 48000, 2)).rejects
    .toThrow(BadResource);

  //The read-only properties shouldn't have been changed by the previous bad call:
  expect(graph.inSampleRate).toStrictEqual(48000);
  expect(graph.inChannels).toStrictEqual(2);
  expect(graph.outSampleRate).toStrictEqual(48000);
  expect(graph.outChannels).toStrictEqual(2);

    //Attempt to send to an invalid input:
    await expect(graph.send(new Float32Array(32), 2)).rejects.toThrow(RangeError);
    await expect(graph.send(new Float32Array(32), 2.468)).rejects.toThrow(TypeError);

    //Attempt to receive from an invalid input:
    await expect(graph.receive(32, 2)).rejects.toThrow(RangeError);
    await expect(graph.receive(32, 2.468)).rejects.toThrow(TypeError);

    //It should reject a misaligned sample buffer:
    await expect(graph.send(new Float32Array(31), 0)).rejects.toThrow(RangeError);

    //Feed one of its inputs, but not the other:
    await expect(graph.send(new Float32Array(256), 0)).resolves.toBeUndefined();

    //It shouldn't return anything:

    await expect(graph.receive(64, 0)).resolves.toHaveLength(0);

    //Now feed the other one:
    await expect(graph.send(new Float32Array(256), 1)).resolves.toBeUndefined();

    //Now we can get some output:
    await expect(graph.receive(64, 0)).resolves.toHaveLength(128);
  //The graph shouldn't allow multiple operations to happen in parallel. The runtime will crash if this doesn't hold because decoders aren't threadsafe.
  for(let i = 0; i < 500; i++)
  {
    graph.send(new Float32Array(256), 0);
    graph.send(new Float32Array(256), 1);
    graph.receive(64, 0);
    await expect(graph.receive(64, 0)).resolves.toHaveLength(128);

  }

  //Close it:
  await expect(graph.close()).resolves.toBeUndefined();

  //The close() call should be idempotent:
  await expect(graph.close()).resolves.toBeUndefined();

  //The read-only properties should have been zeroed out:
  expect(graph.inSampleRate).toStrictEqual(0);
  expect(graph.inChannels).toStrictEqual(0);
  expect(graph.outSampleRate).toStrictEqual(0);
  expect(graph.outChannels).toStrictEqual(0);

  //It shouldn't accept more input:
  await expect(graph.send(new Float32Array(32), 0)).rejects.toThrow(BadResource);

  //It shouldn't try to return more output:
  await expect(graph.receive(64, 0)).rejects.toThrow(BadResource);

  //It can't be reopened:
  await expect(graph.open("amix=inputs=2", 48000, 2, 48000, 2)).rejects.toThrow(BadResource);

});
