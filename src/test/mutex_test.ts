import {Mutex} from "mutex";
import {expect} from "@std/expect"
import {FakeTime} from "@std/testing/time";
//Helper function to just move to the back of the microtask queue.
function bump()
{
    return new Promise <void>((res) => {
        queueMicrotask(res);
    });
}
//Promisified sleep that will use fake time.
function sleep(ms: number)
{
    return new Promise <void>((res) => {
        setTimeout(res, ms);
    });
}

Deno.test("Mutex serializes operations on shared resource", async (_t: Deno.TestContext) => {
    using fakeTime = new FakeTime();
    const mutex = new Mutex();
    let num = 100;

    const addThreeHundred = mutex.lock <void>(async () => {
        await sleep(5000);
        num += 300;
    });
    const divideByTwo = mutex.lock <void>(async () => {
        await sleep(3000);
        num /= 2;
    });

    //The tasks can't start until we yield.
    await bump();//First task gets the lock, sets the timer.
    expect(num).toStrictEqual(100);

    fakeTime.tick(4000);//Not enough time to trigger the timeout.
    await bump();

    expect(num).toStrictEqual(100);
        fakeTime.tick(3000);//First task completes here. The second task is the next microtask in line.
    await addThreeHundred;

    expect(num).toStrictEqual(400);
    await bump();//Second task is in progress.

    fakeTime.tick(4000);//Second task completes here. The number should be (100 + 300) / 2 = 200 if they ran serially.
    await divideByTwo;

    expect(num).toStrictEqual(200);
});
