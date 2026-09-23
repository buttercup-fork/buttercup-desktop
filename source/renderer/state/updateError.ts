import { createStateObject } from "obstate";

export const UPDATE_ERROR = createStateObject<{
    message: string | null;
}>({
    message: null
});

export function setUpdateErrorDetails(message: string | null) {
    UPDATE_ERROR.message = message;
}
