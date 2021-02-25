const pulumiOutputs = require('./test-input.json');
import * as httpHelper from './http-util';


test('hello world API should return JSON', async () => {
    // example consuming code
    let response: httpHelper.HttpResponse<httpHelper.Hello>;
    let hello: httpHelper.Hello;
    let caller = new httpHelper.HttpCaller();
    try {
        response = await caller.get<httpHelper.Hello>(
            pulumiOutputs.helloApiEndpoint
        );
        // Force the unwrapping of the optional parsedBody with the postfix ! operator
        hello = response.parsedBody!;
        expect(hello.message).toBe('Hello JSON');
    } catch (response) {
        console.log("Error", response);
        fail(response);
    }
});
