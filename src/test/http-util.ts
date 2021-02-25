const fetch = require('node-fetch');
const { Response, Request, Headers } = require('node-fetch');

// Patch global refs 
if (!globalThis.fetch) {
    globalThis.fetch = fetch;
}
if (!globalThis.Response) {
    globalThis.Response = Response;
}
if (!globalThis.Request) {
    globalThis.Request = Request;
}

//
// Hello interface.
// The Hello API returns JSON with this structure.
//
export interface Hello {
    message: string;
}

//
// Typed HTTP Response
//
export interface HttpResponse<T> extends Response {
    parsedBody?: T;
}

/**
 * HttpCaller wraps node-fetch HTTP methods providing types responses and error handling
 */
export class HttpCaller {
    
    //
    // Perform an HTTP GET
    // 
    public async get<T>(
        path: string,
        args: RequestInit = { method: "get" }
    ): Promise<HttpResponse<T>> {
        return await this.http<T>(new Request(path, args));
    }

    //
    // Perform an HTTP POST
    // 
    public async post<T>(
        path: string,
        body: any,
        args: RequestInit = { method: "post", body: JSON.stringify(body) }
    ): Promise<HttpResponse<T>> {
        return await this.http<T>(new Request(path, args));
    }

    //
    // Perform an HTTP PUT
    // 
    public async put<T>(
        path: string,
        body: any,
        args: RequestInit = { method: "put", body: JSON.stringify(body) }
    ): Promise<HttpResponse<T>> {
        return await this.http<T>(new Request(path, args));
    }

    //
    // Perform an HTTP request
    // 
    private async http<T>(
        request: RequestInfo
    ): Promise<HttpResponse<T>> {
        const response: HttpResponse<T> = await fetch(
            request
        );

        try {
            // Does this work if there's no body in the response?
            response.parsedBody = await response.json();
        } catch (ex) {
            console.log("NO PARSED BODY");
        }

        return response;
    }

}
