// Write text to the clipboard marked as confidential, so clipboard history and
// cloud clipboard sync skip it (B-8). Windows only for now; elsewhere
// writeConcealedText returns false and the caller falls back to a normal copy.
#define NAPI_VERSION 8
#include <node_api.h>
#include <stdbool.h>
#include <stdlib.h>
#include <string.h>

#ifdef _WIN32
#include <windows.h>

// The clipboard owner: a hidden message-only window, created once
static HWND owner_window(void) {
    static HWND hwnd = NULL;
    if (hwnd == NULL) {
        hwnd = CreateWindowExW(0, L"STATIC", L"", 0, 0, 0, 0, 0, HWND_MESSAGE, NULL, NULL, NULL);
    }
    return hwnd;
}

static bool set_dword_format(const wchar_t* name, DWORD value) {
    UINT format = RegisterClipboardFormatW(name);
    if (format == 0) return false;
    HGLOBAL mem = GlobalAlloc(GMEM_MOVEABLE, sizeof(DWORD));
    if (mem == NULL) return false;
    DWORD* data = (DWORD*)GlobalLock(mem);
    *data = value;
    GlobalUnlock(mem);
    if (SetClipboardData(format, mem) == NULL) {
        GlobalFree(mem);
        return false;
    }
    return true;
}

static bool write_concealed(const char16_t* text, size_t length) {
    HGLOBAL mem = GlobalAlloc(GMEM_MOVEABLE, (length + 1) * sizeof(wchar_t));
    if (mem == NULL) return false;
    wchar_t* buffer = (wchar_t*)GlobalLock(mem);
    memcpy(buffer, text, length * sizeof(wchar_t));
    buffer[length] = 0;
    GlobalUnlock(mem);

    // Another program can hold the clipboard for a moment: retry briefly
    bool opened = false;
    for (int attempt = 0; attempt < 10 && !opened; attempt++) {
        opened = OpenClipboard(owner_window()) != 0;
        if (!opened) Sleep(10);
    }
    if (!opened) {
        GlobalFree(mem);
        return false;
    }
    bool ok = EmptyClipboard() != 0;
    if (ok && SetClipboardData(CF_UNICODETEXT, mem) == NULL) {
        ok = false;
    }
    if (!ok) {
        // Not handed to the system, so still ours to free
        GlobalFree(mem);
    } else {
        // https://learn.microsoft.com/windows/win32/dataxchg/clipboard-formats#cloud-clipboard-and-clipboard-history-formats
        set_dword_format(L"ExcludeClipboardContentFromMonitorProcessing", 0);
        set_dword_format(L"CanIncludeInClipboardHistory", 0);
        set_dword_format(L"CanUploadToCloudClipboard", 0);
    }
    CloseClipboard();
    return ok;
}
#endif

static napi_value WriteConcealedText(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value argv[1];
    napi_value result;
    bool ok = false;
    if (napi_get_cb_info(env, info, &argc, argv, NULL, NULL) != napi_ok || argc < 1) {
        napi_throw_type_error(env, NULL, "writeConcealedText(text) needs a string");
        return NULL;
    }
#ifdef _WIN32
    size_t length = 0;
    if (napi_get_value_string_utf16(env, argv[0], NULL, 0, &length) != napi_ok) {
        napi_throw_type_error(env, NULL, "writeConcealedText(text) needs a string");
        return NULL;
    }
    char16_t* text = (char16_t*)malloc((length + 1) * sizeof(char16_t));
    if (text != NULL) {
        size_t copied = 0;
        if (napi_get_value_string_utf16(env, argv[0], text, length + 1, &copied) == napi_ok) {
            ok = write_concealed(text, copied);
        }
        // Don't leave a copy of the secret in freed memory
        SecureZeroMemory(text, (length + 1) * sizeof(char16_t));
        free(text);
    }
#endif
    napi_get_boolean(env, ok, &result);
    return result;
}

static napi_value IsSupported(napi_env env, napi_callback_info info) {
    napi_value result;
#ifdef _WIN32
    napi_get_boolean(env, true, &result);
#else
    napi_get_boolean(env, false, &result);
#endif
    return result;
}

NAPI_MODULE_INIT() {
    napi_value fn;
    napi_create_function(env, "writeConcealedText", NAPI_AUTO_LENGTH, WriteConcealedText, NULL, &fn);
    napi_set_named_property(env, exports, "writeConcealedText", fn);
    napi_create_function(env, "isSupported", NAPI_AUTO_LENGTH, IsSupported, NULL, &fn);
    napi_set_named_property(env, exports, "isSupported", fn);
    return exports;
}
