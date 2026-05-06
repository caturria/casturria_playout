import { FilterGraph } from "filtergraph";
import { expect } from "@std/expect";
const { BadResource } = Deno.errors;

Deno.test("Filtergraph should fail fast on invalid configuration", (_t: Deno.TestContext) => {
  using graph = new FilterGraph();

  //This invalid filtergraph specification fails to parse:
  expect(() => graph.open("London Bridge is falling down", 48000, 2, 48000, 2))
    .toThrow("Filter not found");

  //Valid specification but invalid I/O parameters:
  expect(() => graph.open("amix=inputs=2", -1031, 2, 44100, 2)).toThrow(
    RangeError,
  );
  expect(() => graph.open("amix=inputs=2", 44100.2468, 2, 44100, 2)).toThrow(
    TypeError,
  );
  expect(() => graph.open("amix=inputs=2", 44100, 2, -1031, 2)).toThrow(
    RangeError,
  );
  expect(() => graph.open("amix=inputs=2", 44100, 2, 44100.2468, 2))
    .toThrow(TypeError);
  expect(() => graph.open("amix=inputs=2", 44100, 255, 44100, 2))
    .toThrow(RangeError);
  expect(() => graph.open("amix=inputs=2", 44100, 2.468, 44100, 2)).toThrow(
    TypeError,
  );
  expect(() => graph.open("amix=inputs=2", 44100, 2, 44100, 255)).toThrow(
    RangeError,
  );
  expect(() => graph.open("amix=inputs=2", 44100, 2, 44100, 2.468)).toThrow(
    TypeError,
  );
  //The read-only encoder properties should still be zero because it hasn't been successfully opened.
  expect(graph.inSampleRate).toStrictEqual(0);
  expect(graph.inChannels).toBe(0);
  expect(graph.outSampleRate).toStrictEqual(0);
  expect(graph.outChannels).toBe(0);
});

Deno.test("Filtergraph should detect API abuse", (_t: Deno.TestContext) => {
  using graph = new FilterGraph();
  //Can't send to a graph that's not open:
  expect(() => graph.send(new Float32Array(32), 0)).toThrow(
    BadResource,
  );

  //Can't receive from an unopened graph either:
  expect(() => graph.receive(32, 0)).toThrow(BadResource);

  //Open the graph correctly this time:
  expect(graph.open("amix=inputs=2", 48000, 2, 48000, 2)).toBeUndefined();

  //Double open attempt:
  expect(() => graph.open("amix=inputs=2", 48000, 2, 48000, 2)).toThrow(
    BadResource,
  );

  //The read-only properties shouldn't have been changed by the previous bad call:
  expect(graph.inSampleRate).toStrictEqual(48000);
  expect(graph.inChannels).toStrictEqual(2);
  expect(graph.outSampleRate).toStrictEqual(48000);
  expect(graph.outChannels).toStrictEqual(2);

  //Attempt to send to an invalid input:
  expect(() => graph.send(new Float32Array(32), 2)).toThrow(RangeError);
  expect(() => graph.send(new Float32Array(32), 2.468)).toThrow(
    TypeError,
  );

  //Attempt to receive from an invalid input:
  expect(() => graph.receive(32, 2)).toThrow(RangeError);
  expect(() => graph.receive(32, 2.468)).toThrow(TypeError);

  //It should reject a misaligned sample buffer:
  expect(() => graph.send(new Float32Array(31), 0)).toThrow(RangeError);

  //Feed one of its inputs, but not the other:
  expect(graph.send(new Float32Array(256), 0)).toBeUndefined();

  //It shouldn't return anything:

  expect(graph.receive(64, 0)).toHaveLength(0);

  //Now feed the other one:
  expect(graph.send(new Float32Array(256), 1)).toBeUndefined();

  //Now we can get some output:
  expect(graph.receive(64, 0)).toHaveLength(128);

  //Close it:
  expect(graph.close()).toBeUndefined();

  //The close() call should be idempotent:
  expect(graph.close()).toBeUndefined();

  //The read-only properties should have been zeroed out:
  expect(graph.inSampleRate).toStrictEqual(0);
  expect(graph.inChannels).toStrictEqual(0);
  expect(graph.outSampleRate).toStrictEqual(0);
  expect(graph.outChannels).toStrictEqual(0);

  //It shouldn't accept more input:
  expect(() => graph.send(new Float32Array(32), 0)).toThrow(
    BadResource,
  );

  //It shouldn't try to return more output:
  expect(() => graph.receive(64, 0)).toThrow(BadResource);

  //It can't be reopened:
  expect(() => graph.open("amix=inputs=2", 48000, 2, 48000, 2)).toThrow(
    BadResource,
  );
});
