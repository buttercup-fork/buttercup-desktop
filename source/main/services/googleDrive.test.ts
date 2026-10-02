import { jest } from "@jest/globals";
import { Layerr } from "layerr";

const ERR_REFRESH_FAILED = "err/refresh/failed";
let mockHandler: (datasource: any) => Promise<void>;
let mockRefreshError: Error | null = null;
const mockSend = jest.fn();

jest.unstable_mockModule("buttercup", () => ({
    DatasourceAuthManager: {
        getSharedManager: () => ({
            registerHandler: (_type: string, handler: typeof mockHandler) => {
                mockHandler = handler;
            }
        })
    }
}));
jest.unstable_mockModule("@buttercup/google-oauth2-client", () => ({
    ERR_REFRESH_FAILED,
    OAuth2Client: class {
        refreshAccessToken() {
            return mockRefreshError
                ? Promise.reject(mockRefreshError)
                : Promise.resolve({ tokens: { access_token: "new-access" } });
        }
    }
}));
jest.unstable_mockModule("./windows", () => ({
    getMainWindow: () => ({ webContents: { send: mockSend } })
}));
jest.unstable_mockModule("./navigation", () => ({ openExternalSafely: jest.fn() }));
jest.unstable_mockModule("../library/googleLoopback", () => ({ startLoopbackAuth: jest.fn() }));
jest.unstable_mockModule("../library/log", () => ({ logInfo: jest.fn(), logWarn: jest.fn() }));

function refusal(status: number): Error {
    return new Layerr({ info: { code: ERR_REFRESH_FAILED, status } }, "Bad refresh response");
}

function makeDatasource() {
    return { sourceID: "source-1", refreshToken: "refresh-1", updateTokens: jest.fn() };
}

beforeAll(async () => {
    const { registerGoogleDriveAuthHandlers } = await import("./googleDrive");
    registerGoogleDriveAuthHandlers();
});

beforeEach(() => {
    mockSend.mockClear();
    mockRefreshError = null;
});

test("updates the access token when the refresh works", async () => {
    const datasource = makeDatasource();
    await mockHandler(datasource);
    expect(datasource.updateTokens).toHaveBeenCalledWith("new-access", "refresh-1");
    expect(mockSend).not.toHaveBeenCalled();
});

test.each([400, 401, 403])(
    "asks to sign in again when Google refuses the refresh (%i)",
    async (status) => {
        mockRefreshError = refusal(status);
        const datasource = makeDatasource();
        await mockHandler(datasource);
        expect(mockSend).toHaveBeenCalledWith("google-reauth", "source-1");
        expect(datasource.updateTokens).not.toHaveBeenCalled();
    }
);

test("still throws errors that aren't a refused refresh", async () => {
    mockRefreshError = new Error("socket hang up");
    await expect(mockHandler(makeDatasource())).rejects.toThrow("socket hang up");
    expect(mockSend).not.toHaveBeenCalled();
});
